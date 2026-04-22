export function buildVencimientoMail(aprendiz, tracking) {
  const subject =
    tracking?.diasVencimiento < 0
      ? "Notificación de vencimiento de términos - etapa productiva"
      : tracking?.diasVencimiento <= 30
      ? "Alerta crítica - vencimiento de términos próximo"
      : "Alerta preventiva - próximo vencimiento de términos de etapa productiva";

  const diasTexto =
    tracking?.diasVencimiento < 0
      ? `El vencimiento ocurrió hace ${Math.abs(tracking.diasVencimiento)} día(s).`
      : `Días restantes: ${tracking?.diasVencimiento ?? "No disponible"}.`;

  return {
    subject,
    body: `Cordial saludo, ${aprendiz.nombre || "aprendiz"}.

Se informa que su proceso de etapa productiva presenta una novedad relacionada con el vencimiento de términos.

Programa: ${aprendiz.programa || "No registra"}
Ficha: ${aprendiz.ficha || "No registra"}
Fecha de vencimiento de términos: ${tracking?.fechaVencimientoTerminos || "No disponible"}
${diasTexto}

Por favor, valide su proceso y adelante las gestiones correspondientes dentro de los tiempos establecidos institucionalmente.

Este mensaje corresponde a una alerta generada desde el sistema de seguimiento de etapa productiva.`,
  };
}

export function buildReunionMail(aprendiz, reunion) {
  return {
    subject: "Seguimiento pendiente - reunión de etapa productiva no programada",
    body: `Cordial saludo, ${aprendiz.nombre || "aprendiz"}.

Se informa que, de acuerdo con el cronograma de seguimiento de la etapa productiva, no se evidencia programación o cumplimiento de la reunión correspondiente.

Programa: ${aprendiz.programa || "No registra"}
Ficha: ${aprendiz.ficha || "No registra"}
Empresa: ${aprendiz.empresa || "No registra"}
Reunión pendiente: ${reunion?.numero || "No disponible"}
Fecha estimada: ${reunion?.fecha || "No disponible"}

Se solicita realizar la gestión correspondiente a la mayor brevedad y compartir la información necesaria para agendar el encuentro de seguimiento.

Este mensaje corresponde a una notificación generada desde el sistema de seguimiento de etapa productiva.`,
  };
}

export function buildBitacoraMail(aprendiz, bitacora, diasRetraso) {
  return {
    subject: "Incumplimiento en entrega de bitácora de etapa productiva",
    body: `Cordial saludo, ${aprendiz.nombre || "aprendiz"}.

Se informa que en la revisión del seguimiento de la etapa productiva se evidencia incumplimiento en la entrega de la bitácora programada.

Programa: ${aprendiz.programa || "No registra"}
Ficha: ${aprendiz.ficha || "No registra"}
Bitácora pendiente: ${bitacora?.numero || "No disponible"}
Fecha programada: ${bitacora?.fecha || "No disponible"}
Días de retraso: ${diasRetraso ?? 0}

Se solicita realizar la entrega correspondiente y ponerse al día con las evidencias requeridas del proceso.

Este mensaje corresponde a una notificación generada desde el sistema de seguimiento de etapa productiva.`,
  };
}