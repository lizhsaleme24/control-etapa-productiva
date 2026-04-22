import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

const historialCorreosCollection = collection(db, "historial_correos");

export async function registrarCorreoHistorial({
  aprendizId,
  tipo,
  asunto,
  correo,
  resultado,
  detalle = "",
  body = "",
}) {
  await addDoc(historialCorreosCollection, {
    aprendizId,
    tipo,
    asunto,
    correo,
    resultado,
    detalle,
    body,
    fechaEnvio: new Date().toISOString(),
    createdAt: Date.now(),
  });
}

export async function enviarCorreoManual({ to, subject, body }) {
  if (!to) {
    return {
      ok: false,
      message: "El aprendiz no tiene correo registrado.",
    };
  }

  try {
    const gmailUrl =
      `https://mail.google.com/mail/?view=cm&fs=1` +
      `&to=${encodeURIComponent(to)}` +
      `&su=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    window.open(gmailUrl, "_blank", "noopener,noreferrer");

    return {
      ok: true,
      message: "Se abrió Gmail con el correo listo para enviar.",
    };
  } catch (error) {
    console.error(error);

    return {
      ok: false,
      message: "No fue posible abrir Gmail para preparar el correo.",
    };
  }
}

export async function obtenerHistorialCorreos(aprendizId) {
  const q = query(
    historialCorreosCollection,
    where("aprendizId", "==", aprendizId),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));
}

export async function obtenerUltimoCorreoPorTipo(aprendizId, tipo) {
  const q = query(
    historialCorreosCollection,
    where("aprendizId", "==", aprendizId),
    where("tipo", "==", tipo),
    orderBy("createdAt", "desc"),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const docItem = snapshot.docs[0];
  return {
    id: docItem.id,
    ...docItem.data(),
  };
}