export function getReunionesPendientes(tracking) {
  const hoy = new Date();
  const baseHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  return (tracking?.reuniones || []).filter((reunion) => {
    if (!reunion?.fecha) return false;

    const fecha = new Date(reunion.fecha + "T12:00:00");
    const fechaBase = new Date(
      fecha.getFullYear(),
      fecha.getMonth(),
      fecha.getDate()
    );

    return fechaBase < baseHoy && !reunion.cumplio;
  });
}

export function getBitacorasPendientes(tracking) {
  const hoy = new Date();
  const baseHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  return (tracking?.bitacoras || []).filter((bitacora) => {
    if (!bitacora?.fecha) return false;

    const fecha = new Date(bitacora.fecha + "T12:00:00");
    const fechaBase = new Date(
      fecha.getFullYear(),
      fecha.getMonth(),
      fecha.getDate()
    );

    return fechaBase < baseHoy && !bitacora.cumplio;
  });
}

export function calcularDiasRetraso(fechaStr) {
  if (!fechaStr) return 0;

  const hoy = new Date();
  const fecha = new Date(fechaStr + "T12:00:00");

  const baseHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const baseFecha = new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate()
  );

  const ms = baseHoy.getTime() - baseFecha.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function getPrimeraReunionPendiente(tracking) {
  const pendientes = getReunionesPendientes(tracking);
  return pendientes.length ? pendientes[0] : null;
}

export function getPrimeraBitacoraPendiente(tracking) {
  const pendientes = getBitacorasPendientes(tracking);
  return pendientes.length ? pendientes[0] : null;
}

export function puedeNotificarVencimiento(tracking) {
  if (!tracking?.semaforo) return false;

  return (
    tracking.semaforo.label === "Próximo" ||
    tracking.semaforo.label === "Crítico" ||
    tracking.semaforo.label === "Vencido"
  );
}