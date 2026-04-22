// Suma días a una fecha
export function addDays(dateStr, days) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Suma meses a una fecha
export function addMonths(dateStr, months) {
  const d = new Date(dateStr + "T12:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// Diferencia en días entre hoy y una fecha
export function diffDays(dateStr) {
  const today = new Date();
  const target = new Date(dateStr + "T12:00:00");

  const baseToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const baseTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  );

  const ms = baseTarget.getTime() - baseToday.getTime();

  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// Formatea fecha para mostrar
export function formatDate(dateStr) {
  if (!dateStr) return "-";

  return new Date(dateStr + "T12:00:00").toLocaleDateString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// Semáforo según días restantes
export function semaforoFromDays(days) {
  if (days < 0) {
    return {
      label: "Vencido",
      color: "red",
      alert: "La ficha ya se encuentra en vencimiento de términos.",
    };
  }

  if (days <= 30) {
    return {
      label: "Crítico",
      color: "red",
      alert: `Alerta crítica: vence en ${days} día(s).`,
    };
  }

  if (days <= 60) {
    return {
      label: "Próximo",
      color: "yellow",
      alert: `Alerta preventiva: vence en ${days} día(s).`,
    };
  }

  return {
    label: "Al día",
    color: "green",
    alert: "Sin alertas.",
  };
}

// Construye TODO el seguimiento del aprendiz
export function buildTracking(aprendiz) {
  // BITÁCORAS (cada 15 días - 12 en total)
  const bitacoras = aprendiz.fechaInicio
    ? Array.from({ length: 12 }, (_, i) => ({
        numero: i + 1,
        fecha: addDays(aprendiz.fechaInicio, i * 15),
        cumplio: aprendiz.bitacoras?.[i]?.cumplio || false,
      }))
    : [];

  // REUNIONES (cada 3 meses - 3 en total)
  const reuniones = aprendiz.fechaInicio
    ? Array.from({ length: 3 }, (_, i) => ({
        numero: i + 1,
        fecha: addMonths(aprendiz.fechaInicio, i * 3),
        cumplio: aprendiz.reuniones?.[i]?.cumplio || false,
      }))
    : [];

  // VENCIMIENTO DE TÉRMINOS (18 meses desde salida ficha)
  const fechaVencimientoTerminos = aprendiz.fechaSalidaFichaProductiva
    ? addMonths(aprendiz.fechaSalidaFichaProductiva, 18)
    : "";

  const diasVencimiento = fechaVencimientoTerminos
    ? diffDays(fechaVencimientoTerminos)
    : null;

  const semaforo =
    diasVencimiento !== null ? semaforoFromDays(diasVencimiento) : null;

  // AVANCE
  const bitacorasCumplidas = bitacoras.filter((b) => b.cumplio).length;
  const reunionesCumplidas = reuniones.filter((r) => r.cumplio).length;

  const total = 15; // 12 bitácoras + 3 reuniones
  const avance =
    total > 0
      ? Math.round(((bitacorasCumplidas + reunionesCumplidas) / total) * 100)
      : 0;

  return {
    bitacoras,
    reuniones,
    fechaVencimientoTerminos,
    diasVencimiento,
    semaforo,
    bitacorasCumplidas,
    reunionesCumplidas,
    avance,
  };
}