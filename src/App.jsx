import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { aprendicesCollection, db } from "./firebase";
import { buildTracking, formatDate } from "./utils/date";
import {
  calcularDiasRetraso,
  getBitacorasPendientes,
  getReunionesPendientes,
  puedeNotificarVencimiento,
} from "./utils/mailHelpers";
import {
  buildBitacoraMail,
  buildReunionMail,
  buildVencimientoMail,
} from "./utils/mailTemplates";
import {
  enviarCorreoManual,
  obtenerHistorialCorreos,
  registrarCorreoHistorial,
} from "./mailService";
import "./App.css";

const initialForm = {
  nombre: "",
  documento: "",
  programa: "ADSO",
  ficha: "",
  empresa: "",
  correoAprendiz: "",
  correoEmpresa: "",
  modalidad: "Contrato de aprendizaje",
  fechaInicio: "",
  fechaSalidaFichaProductiva: "",
  estado: "En seguimiento",
  observaciones: "",
};

async function exportExcel(data) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Etapa Productiva");

  worksheet.columns = [
    { header: "Nombre", key: "nombre", width: 28 },
    { header: "Documento", key: "documento", width: 18 },
    { header: "Programa", key: "programa", width: 28 },
    { header: "Ficha", key: "ficha", width: 14 },
    { header: "Empresa", key: "empresa", width: 24 },
    { header: "Correo aprendiz", key: "correoAprendiz", width: 28 },
    { header: "Correo empresa", key: "correoEmpresa", width: 28 },
    { header: "Modalidad", key: "modalidad", width: 22 },
    { header: "Fecha inicio", key: "fechaInicio", width: 16 },
    { header: "Fecha salida ficha", key: "fechaSalidaFichaProductiva", width: 20 },
    { header: "Vence términos", key: "fechaVencimientoTerminos", width: 18 },
    { header: "Estado", key: "estado", width: 18 },
    { header: "Bitácoras cumplidas", key: "bitacorasCumplidas", width: 18 },
    { header: "Reuniones cumplidas", key: "reunionesCumplidas", width: 18 },
    { header: "Avance %", key: "avance", width: 12 },
    { header: "Semáforo", key: "semaforo", width: 14 },
    { header: "Observaciones", key: "observaciones", width: 32 },
  ];

  data.forEach((a) => {
    const t = buildTracking(a);

    worksheet.addRow({
      nombre: a.nombre || "",
      documento: a.documento || "",
      programa: a.programa || "",
      ficha: a.ficha || "",
      empresa: a.empresa || "",
      correoAprendiz: a.correoAprendiz || "",
      correoEmpresa: a.correoEmpresa || "",
      modalidad: a.modalidad || "",
      fechaInicio: a.fechaInicio || "",
      fechaSalidaFichaProductiva: a.fechaSalidaFichaProductiva || "",
      fechaVencimientoTerminos: t.fechaVencimientoTerminos || "",
      estado: a.estado || "",
      bitacorasCumplidas: `${t.bitacorasCumplidas}/12`,
      reunionesCumplidas: `${t.reunionesCumplidas}/3`,
      avance: t.avance ?? 0,
      semaforo: t.semaforo?.label || "",
      observaciones: a.observaciones || "",
    });
  });

  const headerRow = worksheet.getRow(1);
  headerRow.height = 22;

  headerRow.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "1D4ED8" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    cell.border = {
      top: { style: "thin", color: { argb: "D1D5DB" } },
      left: { style: "thin", color: { argb: "D1D5DB" } },
      bottom: { style: "thin", color: { argb: "D1D5DB" } },
      right: { style: "thin", color: { argb: "D1D5DB" } },
    };
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    row.eachCell((cell) => {
      cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "E5E7EB" } },
        left: { style: "thin", color: { argb: "E5E7EB" } },
        bottom: { style: "thin", color: { argb: "E5E7EB" } },
        right: { style: "thin", color: { argb: "E5E7EB" } },
      };
    });

    const semaforoCell = row.getCell(16);
    const valor = String(semaforoCell.value || "");

    if (valor === "Al día") {
      semaforoCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "DCFCE7" },
      };
      semaforoCell.font = { bold: true, color: { argb: "166534" } };
    } else if (valor === "Próximo") {
      semaforoCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FEF3C7" },
      };
      semaforoCell.font = { bold: true, color: { argb: "92400E" } };
    } else if (valor === "Crítico" || valor === "Vencido") {
      semaforoCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FEE2E2" },
      };
      semaforoCell.font = { bold: true, color: { argb: "991B1B" } };
    }
  });

  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: "A1",
    to: "Q1",
  };

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "control_etapa_productiva.xlsx"
  );
}

function getBadgeClass(label) {
  if (label === "Vencido") return "badge badge-danger";
  if (label === "Crítico") return "badge badge-danger";
  if (label === "Próximo") return "badge badge-warning";
  return "badge badge-success";
}

function getNoticeClass(type) {
  if (type === "success") return "notice notice-success";
  if (type === "warning") return "notice notice-warning";
  return "notice notice-error";
}

export default function App() {
  const [aprendices, setAprendices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queryText, setQueryText] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [openAprendizId, setOpenAprendizId] = useState(null);

  const [notice, setNotice] = useState({
    message: "",
    type: "",
  });

  const [historialDialogOpen, setHistorialDialogOpen] = useState(false);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialCorreos, setHistorialCorreos] = useState([]);
  const [aprendizHistorial, setAprendizHistorial] = useState(null);
  const [historialFiltroTipo, setHistorialFiltroTipo] = useState("todos");

  function showNotice(message, type = "success") {
    setNotice({ message, type });
    window.clearTimeout(window.__noticeTimer);
    window.__noticeTimer = window.setTimeout(() => {
      setNotice({ message: "", type: "" });
    }, 3500);
  }

  useEffect(() => {
    const q = query(aprendicesCollection, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));
        setAprendices(items);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        showNotice("No fue posible conectar con Firestore.", "error");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const enriched = useMemo(() => {
    return aprendices.map((a) => ({
      ...a,
      tracking: buildTracking(a),
    }));
  }, [aprendices]);

  const filtered = useMemo(() => {
    return enriched.filter((a) => {
      const text =
        `${a.nombre} ${a.documento} ${a.programa} ${a.ficha} ${a.empresa}`.toLowerCase();

      const matchQuery = text.includes(queryText.toLowerCase());
      const label = a.tracking.semaforo?.label;

      const matchEstado =
        filtroEstado === "todos" ||
        (filtroEstado === "aldia" && label === "Al día") ||
        (filtroEstado === "proximo" && label === "Próximo") ||
        (filtroEstado === "critico" && label === "Crítico") ||
        (filtroEstado === "vencido" && label === "Vencido");

      return matchQuery && matchEstado;
    });
  }, [enriched, queryText, filtroEstado]);

  const stats = useMemo(() => {
    return {
      total: enriched.length,
      alDia: enriched.filter((a) => a.tracking.semaforo?.label === "Al día").length,
      proximos: enriched.filter((a) => a.tracking.semaforo?.label === "Próximo").length,
      criticos: enriched.filter((a) => a.tracking.semaforo?.label === "Crítico").length,
      vencidos: enriched.filter((a) => a.tracking.semaforo?.label === "Vencido").length,
    };
  }, [enriched]);

  const historialCorreosFiltrado =
    historialFiltroTipo === "todos"
      ? historialCorreos
      : historialCorreos.filter((item) => item.tipo === historialFiltroTipo);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.nombre || !form.documento || !form.fechaInicio) {
      showNotice("Debes diligenciar nombre, documento y fecha de inicio.", "error");
      return;
    }

    try {
      const payload = {
        ...form,
        bitacoras:
          editingId
            ? form.bitacoras || Array.from({ length: 12 }, () => ({ cumplio: false }))
            : Array.from({ length: 12 }, () => ({ cumplio: false })),
        reuniones:
          editingId
            ? form.reuniones || Array.from({ length: 3 }, () => ({ cumplio: false }))
            : Array.from({ length: 3 }, () => ({ cumplio: false })),
      };

      if (editingId) {
        await updateDoc(doc(db, "aprendices_etapa_productiva", editingId), {
          ...payload,
        });
        showNotice("Aprendiz actualizado correctamente.", "success");
      } else {
        await addDoc(aprendicesCollection, {
          ...payload,
          createdAt: Date.now(),
        });
        showNotice("Aprendiz registrado correctamente.", "success");
      }

      setForm(initialForm);
      setEditingId(null);
    } catch (err) {
      console.error(err);
      showNotice("No fue posible guardar el aprendiz.", "error");
    }
  }

  function handleEdit(aprendiz) {
    setEditingId(aprendiz.id);
    setOpenAprendizId(aprendiz.id);
    setForm({
      nombre: aprendiz.nombre || "",
      documento: aprendiz.documento || "",
      programa: aprendiz.programa || "ADSO",
      ficha: aprendiz.ficha || "",
      empresa: aprendiz.empresa || "",
      correoAprendiz: aprendiz.correoAprendiz || "",
      correoEmpresa: aprendiz.correoEmpresa || "",
      modalidad: aprendiz.modalidad || "Contrato de aprendizaje",
      estado: aprendiz.estado || "En seguimiento",
      fechaInicio: aprendiz.fechaInicio || "",
      fechaSalidaFichaProductiva: aprendiz.fechaSalidaFichaProductiva || "",
      observaciones: aprendiz.observaciones || "",
      bitacoras: aprendiz.bitacoras || Array.from({ length: 12 }, () => ({ cumplio: false })),
      reuniones: aprendiz.reuniones || Array.from({ length: 3 }, () => ({ cumplio: false })),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(initialForm);
  }

  async function handleDelete(id) {
    const ok = window.confirm("¿Deseas eliminar este aprendiz?");
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "aprendices_etapa_productiva", id));
      if (openAprendizId === id) setOpenAprendizId(null);
      showNotice("Aprendiz eliminado correctamente.", "success");
    } catch (err) {
      console.error(err);
      showNotice("No fue posible eliminar el aprendiz.", "error");
    }
  }

  async function toggleCheck(aprendiz, type, index) {
    try {
      const items = [...(aprendiz[type] || [])];
      items[index] = {
        ...items[index],
        cumplio: !items[index]?.cumplio,
      };

      await updateDoc(doc(db, "aprendices_etapa_productiva", aprendiz.id), {
        [type]: items,
      });

      showNotice("Seguimiento actualizado correctamente.", "success");
    } catch (err) {
      console.error(err);
      showNotice("No fue posible actualizar el seguimiento.", "error");
    }
  }

  async function handleSendVencimiento(aprendiz) {
    try {
      const tracking = buildTracking(aprendiz);

      if (!aprendiz.correoAprendiz) {
        showNotice("No se puede enviar la alerta porque el aprendiz no tiene correo registrado.", "warning");
        return;
      }

      if (!puedeNotificarVencimiento(tracking)) {
        showNotice("Este aprendiz no tiene alerta activa de vencimiento.", "warning");
        return;
      }

      const mail = buildVencimientoMail(aprendiz, tracking);

      const result = await enviarCorreoManual({
        to: aprendiz.correoAprendiz,
        subject: mail.subject,
        body: mail.body,
      });

      await registrarCorreoHistorial({
        aprendizId: aprendiz.id,
        tipo: "vencimiento",
        asunto: mail.subject,
        correo: aprendiz.correoAprendiz,
        resultado: result.ok ? "enviado" : "fallido",
        detalle: result.message,
        body: mail.body,
      });

      if (!result.ok) {
        showNotice(result.message || "No fue posible preparar el correo de vencimiento.", "error");
        return;
      }

      showNotice("Se registró en historial una alerta de vencimiento.", "success");
    } catch (err) {
      console.error(err);
      showNotice("No fue posible preparar el correo de vencimiento.", "error");
    }
  }

  async function handleSendReunion(aprendiz) {
    try {
      const tracking = buildTracking(aprendiz);
      const pendientes = getReunionesPendientes(tracking);

      if (!aprendiz.correoAprendiz) {
        showNotice("No se puede enviar la alerta porque el aprendiz no tiene correo registrado.", "warning");
        return;
      }

      if (!pendientes.length) {
        showNotice("Este aprendiz no tiene reuniones pendientes para notificar.", "warning");
        return;
      }

      const reunion = pendientes[0];
      const mail = buildReunionMail(aprendiz, reunion);

      const result = await enviarCorreoManual({
        to: aprendiz.correoAprendiz,
        subject: mail.subject,
        body: mail.body,
      });

      await registrarCorreoHistorial({
        aprendizId: aprendiz.id,
        tipo: "reunion",
        asunto: mail.subject,
        correo: aprendiz.correoAprendiz,
        resultado: result.ok ? "enviado" : "fallido",
        detalle: `Reunión ${reunion.numero}. ${result.message}`,
        body: mail.body,
      });

      if (!result.ok) {
        showNotice(result.message || "No fue posible preparar el correo por reunión pendiente.", "error");
        return;
      }

      showNotice("Se registró en historial una alerta por reunión pendiente.", "success");
    } catch (err) {
      console.error(err);
      showNotice("No fue posible preparar el correo por reunión pendiente.", "error");
    }
  }

  async function handleSendBitacora(aprendiz) {
    try {
      const tracking = buildTracking(aprendiz);
      const pendientes = getBitacorasPendientes(tracking);

      if (!aprendiz.correoAprendiz) {
        showNotice("No se puede enviar la alerta porque el aprendiz no tiene correo registrado.", "warning");
        return;
      }

      if (!pendientes.length) {
        showNotice("Este aprendiz no tiene bitácoras pendientes para notificar.", "warning");
        return;
      }

      const bitacora = pendientes[0];
      const diasRetraso = calcularDiasRetraso(bitacora.fecha);
      const mail = buildBitacoraMail(aprendiz, bitacora, diasRetraso);

      const result = await enviarCorreoManual({
        to: aprendiz.correoAprendiz,
        subject: mail.subject,
        body: mail.body,
      });

      await registrarCorreoHistorial({
        aprendizId: aprendiz.id,
        tipo: "bitacora",
        asunto: mail.subject,
        correo: aprendiz.correoAprendiz,
        resultado: result.ok ? "enviado" : "fallido",
        detalle: `Bitácora ${bitacora.numero}. ${result.message}`,
        body: mail.body,
      });

      if (!result.ok) {
        showNotice(result.message || "No fue posible preparar el correo por bitácora incumplida.", "error");
        return;
      }

      showNotice("Se registró en historial una alerta por bitácora incumplida.", "success");
    } catch (err) {
      console.error(err);
      showNotice("No fue posible preparar el correo por bitácora incumplida.", "error");
    }
  }

  async function handleOpenHistorial(aprendiz) {
    try {
      setHistorialLoading(true);
      setAprendizHistorial(aprendiz);
      setHistorialDialogOpen(true);

      const historial = await obtenerHistorialCorreos(aprendiz.id);
      setHistorialCorreos(historial);
    } catch (err) {
      console.error(err);
      setHistorialCorreos([]);
      showNotice("No fue posible consultar el historial de correos.", "error");
    } finally {
      setHistorialLoading(false);
    }
  }

  function handleCloseHistorial() {
    setHistorialDialogOpen(false);
    setHistorialCorreos([]);
    setAprendizHistorial(null);
    setHistorialFiltroTipo("todos");
  }

  function toggleOpenAprendiz(id) {
    setOpenAprendizId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="app-shell">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>Control de Etapa Productiva</h1>
            <p>Seguimiento de aprendices, bitácoras, reuniones y alertas.</p>
          </div>
        </div>

        {notice.message && (
          <div className={getNoticeClass(notice.type)}>
            {notice.message}
          </div>
        )}

        <form className="panel form-panel" onSubmit={handleSubmit}>
          <div className="panel-header">
            <h2>{editingId ? "Editar aprendiz" : "Registrar aprendiz"}</h2>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit">
                {editingId ? "Guardar cambios" : "Guardar aprendiz"}
              </button>
              {editingId && (
                <button className="btn btn-secondary" type="button" onClick={handleCancelEdit}>
                  Cancelar
                </button>
              )}
              <button className="btn btn-outline" type="button" onClick={() => exportExcel(enriched)}>
                Exportar Excel
              </button>
            </div>
          </div>

          <div className="form-grid">
            <input name="nombre" placeholder="Nombre completo" value={form.nombre} onChange={handleChange} />
            <input name="documento" placeholder="Documento" value={form.documento} onChange={handleChange} />
            <input name="programa" placeholder="Programa" value={form.programa} onChange={handleChange} />
            <input name="ficha" placeholder="Ficha" value={form.ficha} onChange={handleChange} />
            <input name="empresa" placeholder="Empresa" value={form.empresa} onChange={handleChange} />
            <input name="correoAprendiz" placeholder="Correo aprendiz" value={form.correoAprendiz} onChange={handleChange} />
            <input name="correoEmpresa" placeholder="Correo empresa" value={form.correoEmpresa} onChange={handleChange} />
            <select name="modalidad" value={form.modalidad} onChange={handleChange}>
            <option value="Contrato de Aprendizaje">Contrato de Aprendizaje</option>
            <option value="Vínculo Formativo">Vínculo Formativo</option>
            <option value="Proyecto Productivo">Proyecto Productivo</option>
            <option value="Vínculo Laboral">Vínculo Laboral</option>
            <option value="Monitoria">Monitoria</option>
          </select> 
            <input name="estado" placeholder="Estado" value={form.estado} onChange={handleChange} />

            <div className="field">
              <label>Fecha inicio</label>
              <input type="date" name="fechaInicio" value={form.fechaInicio} onChange={handleChange} />
            </div>

            <div className="field">
              <label>Fecha salida ficha a productiva</label>
              <input
                type="date"
                name="fechaSalidaFichaProductiva"
                value={form.fechaSalidaFichaProductiva}
                onChange={handleChange}
              />
            </div>

            <input name="observaciones" placeholder="Observaciones" value={form.observaciones} onChange={handleChange} />
          </div>
        </form>

        <div className="stats-grid">
          <div className="stat-card">
            <span>Total</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="stat-card">
            <span>Al día</span>
            <strong>{stats.alDia}</strong>
          </div>
          <div className="stat-card">
            <span>Próximos</span>
            <strong>{stats.proximos}</strong>
          </div>
          <div className="stat-card">
            <span>Críticos</span>
            <strong>{stats.criticos}</strong>
          </div>
          <div className="stat-card">
            <span>Vencidos</span>
            <strong>{stats.vencidos}</strong>
          </div>
        </div>

        <div className="filters-bar panel">
          <input
            className="search-input"
            placeholder="Buscar por nombre, documento, ficha, programa o empresa"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
          />
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="aldia">Al día</option>
            <option value="proximo">Próximo</option>
            <option value="critico">Crítico</option>
            <option value="vencido">Vencido</option>
          </select>
        </div>

        {loading ? (
          <div className="panel empty-state">Cargando aprendices...</div>
        ) : filtered.length === 0 ? (
          <div className="panel empty-state">No hay aprendices registrados o no coinciden con el filtro.</div>
        ) : (
          <div className="cards-list list-mode">
            {filtered.map((a) => {
              const isOpen = openAprendizId === a.id;

              return (
                <div key={a.id} className="panel apprentice-card list-card">
                  <div className="list-row">
                    <div className="list-main">
                      <h3>{a.nombre}</h3>
                      <p>{a.programa}</p>
                      <p>Documento: {a.documento}</p>
                      <p>Ficha: {a.ficha || "-"}</p>
                    </div>

                    <div className="list-status">
                      <span className={getBadgeClass(a.tracking.semaforo?.label)}>
                        {a.tracking.semaforo?.label || "Sin estado"}
                      </span>
                      <p>Vence: {formatDate(a.tracking.fechaVencimientoTerminos)}</p>
                      <p>Días: {a.tracking.diasVencimiento ?? "-"}</p>
                    </div>

                    <div className="list-actions">
                      <button className="btn btn-primary" onClick={() => toggleOpenAprendiz(a.id)}>
                        {isOpen ? "Cerrar" : "Abrir"}
                      </button>
                      <button className="btn btn-secondary" onClick={() => handleEdit(a)}>
                        Editar
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="opened-detail">
                      <div className="card-top">
                        <div>
                          <div className="info-list">
                            <p><strong>Empresa:</strong> {a.empresa || "-"}</p>
                            <p><strong>Correo aprendiz:</strong> {a.correoAprendiz || "-"}</p>
                            <p><strong>Correo empresa:</strong> {a.correoEmpresa || "-"}</p>
                            <p><strong>Inicio:</strong> {formatDate(a.fechaInicio)}</p>
                            <p><strong>Vence términos:</strong> {formatDate(a.tracking.fechaVencimientoTerminos)}</p>
                            <p><strong>Estado:</strong> {a.estado || "-"}</p>
                            <p><strong>Modalidad:</strong> {a.modalidad || "-"}</p>
                            <p><strong>Observaciones:</strong> {a.observaciones || "-"}</p>
                          </div>
                        </div>

                        <div className="card-side">
                          <div className="summary-list">
                            <p><strong>Bitácoras cumplidas:</strong> {a.tracking.bitacorasCumplidas}/12</p>
                            <p><strong>Reuniones cumplidas:</strong> {a.tracking.reunionesCumplidas}/3</p>
                            <p><strong>Avance:</strong> {a.tracking.avance}%</p>
                          </div>

                          {a.tracking.semaforo?.alert && a.tracking.semaforo?.label !== "Al día" && (
                            <div className="warning-box">{a.tracking.semaforo.alert}</div>
                          )}
                        </div>
                      </div>

                      <div className="actions-row">
                        <button className="btn btn-danger" onClick={() => handleDelete(a.id)}>Eliminar</button>
                        <button className="btn btn-outline" onClick={() => handleSendVencimiento(a)}>Alerta vencimiento</button>
                        <button className="btn btn-outline" onClick={() => handleSendReunion(a)}>Alerta reunión</button>
                        <button className="btn btn-outline" onClick={() => handleSendBitacora(a)}>Alerta bitácora</button>
                        <button className="btn btn-primary" onClick={() => handleOpenHistorial(a)}>Historial correos</button>
                      </div>

                      <div className="tables-grid">
                        <div className="table-card">
                          <h4>Bitácoras</h4>
                          <div className="table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th>Fecha</th>
                                  <th>Cumplió</th>
                                </tr>
                              </thead>
                              <tbody>
                                {a.tracking.bitacoras.map((b, idx) => (
                                  <tr key={idx}>
                                    <td>{b.numero}</td>
                                    <td>{formatDate(b.fecha)}</td>
                                    <td>
                                      <input
                                        type="checkbox"
                                        checked={b.cumplio}
                                        onChange={() => toggleCheck(a, "bitacoras", idx)}
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="table-card">
                          <h4>Reuniones</h4>
                          <div className="table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th>Fecha</th>
                                  <th>Cumplió</th>
                                </tr>
                              </thead>
                              <tbody>
                                {a.tracking.reuniones.map((r, idx) => (
                                  <tr key={idx}>
                                    <td>{r.numero}</td>
                                    <td>{formatDate(r.fecha)}</td>
                                    <td>
                                      <input
                                        type="checkbox"
                                        checked={r.cumplio}
                                        onChange={() => toggleCheck(a, "reuniones", idx)}
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {historialDialogOpen && (
          <div className="modal-backdrop">
            <div className="modal-card">
              <div className="modal-header">
                <div>
                  <h3>Historial de correos</h3>
                  {aprendizHistorial && <p>{aprendizHistorial.nombre}</p>}
                </div>
                <button className="btn btn-secondary" onClick={handleCloseHistorial}>Cerrar</button>
              </div>

              {aprendizHistorial && (
                <div className="modal-summary">
                  <p><strong>Aprendiz:</strong> {aprendizHistorial.nombre || "-"}</p>
                  <p><strong>Correo:</strong> {aprendizHistorial.correoAprendiz || "-"}</p>
                  <p><strong>Programa:</strong> {aprendizHistorial.programa || "-"}</p>
                  <p><strong>Ficha:</strong> {aprendizHistorial.ficha || "-"}</p>
                </div>
              )}

              {!historialLoading && historialCorreos.length > 0 && (
                <div className="modal-filter">
                  <span>Total registros: {historialCorreosFiltrado.length}</span>
                  <select
                    value={historialFiltroTipo}
                    onChange={(e) => setHistorialFiltroTipo(e.target.value)}
                  >
                    <option value="todos">Todos</option>
                    <option value="vencimiento">Vencimiento</option>
                    <option value="reunion">Reunión</option>
                    <option value="bitacora">Bitácora</option>
                  </select>
                </div>
              )}

              <div className="history-list">
                {historialLoading ? (
                  <div className="empty-state">Cargando historial...</div>
                ) : historialCorreos.length === 0 ? (
                  <div className="empty-state">No hay correos registrados para este aprendiz.</div>
                ) : historialCorreosFiltrado.length === 0 ? (
                  <div className="empty-state">No hay correos del tipo seleccionado.</div>
                ) : (
                  historialCorreosFiltrado.map((item) => (
                    <div key={item.id} className="history-card">
                      <p><strong>Asunto:</strong> {item.asunto || "-"}</p>
                      <p><strong>Tipo:</strong> {item.tipo || "-"}</p>
                      <p><strong>Correo:</strong> {item.correo || "-"}</p>
                      <p>
                        <strong>Fecha:</strong>{" "}
                        {item.fechaEnvio ? new Date(item.fechaEnvio).toLocaleString("es-CO") : "-"}
                      </p>
                      <p><strong>Resultado:</strong> {item.resultado || "-"}</p>

                      {item.detalle && (
                        <div className="history-detail">
                          <strong>Detalle:</strong> {item.detalle}
                        </div>
                      )}

                      {item.body && (
                        <div className="history-body">
                          <strong>Contenido del correo:</strong>
                          <pre>{item.body}</pre>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}