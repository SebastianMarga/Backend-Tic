import { getIO } from "../../lib/socket.js";
import { processInventoryPipeline, crearSugerenciaReabastecimiento } from "../inventory/inventory.service.js";

// Memoria temporal para evitar que el sensor sature el bot RPA (Spam)
const alertCooldowns = new Map<string, number>();
const COOLDOWN_MINUTES = 5;

export const validarPayloadIoT = (data: any): string | null => {
  const {
    sensorId,
    producto,
    pesoBrutoKg,
    pesoUnitarioKg,
    stockFisico,
    umbralMinimo,
  } = data || {};

  if (!sensorId || typeof sensorId !== "string")
    return "sensorId es requerido y debe ser texto.";
  if (!producto || typeof producto !== "string")
    return "producto es requerido y debe ser texto.";
  if (typeof pesoBrutoKg !== "number" || typeof pesoUnitarioKg !== "number")
    return "Los pesos deben ser numéricos.";
  if (typeof stockFisico !== "number" || typeof umbralMinimo !== "number")
    return "Stock y umbral deben ser numéricos.";

  return null;
};

export const procesarAlertaStock = async (payload: any) => {
  const { sensorId, producto, stockFisico, umbralMinimo } = payload;

  if (stockFisico > umbralMinimo) {
    return {
      status: 200,
      message: "Stock en niveles normales. No se requiere acción.",
    };
  }

  // Verificar Cooldown
  const cooldownKey = `${sensorId}_${producto}`;
  const lastAlertTime = alertCooldowns.get(cooldownKey);
  const now = Date.now();

  if (lastAlertTime && now - lastAlertTime < COOLDOWN_MINUTES * 60 * 1000) {
    console.log(`[IoT] Alerta ignorada por cooldown para: ${producto}`);
    const error: any = new Error(
      `Alerta en enfriamiento. El bot ya está procesando ${producto}.`,
    );
    error.status = 429;
    throw error;
  }

  alertCooldowns.set(cooldownKey, now);
  console.log(
    `[IoT] ALERTA CRÍTICA: ${producto} (Stock: ${stockFisico}). Registrando reabastecimiento...`,
  );

  // 1. Guardar inmediatamente la sugerencia de REABASTECIMIENTO en PurchaseOrder (DRAFT + RESTOCK_ALERT)
  const ordenSugerida = await crearSugerenciaReabastecimiento(
    producto,
    stockFisico,
  );

  // 2. Ejecutar el pipeline con origen "IOT" (no ensucia TrendingProduct)
  const promptAutomatico = `ALERTA DE SENSOR: El stock físico de "${producto}" ha caído a ${stockFisico} unidades. Por favor, busca proveedores urgentemente y cotiza las mejores opciones para reabastecer.`;

  processInventoryPipeline(promptAutomatico, "IOT")
    .then((resultado) => {
      const io = getIO();
      io.emit("alerta-stock", {
        tipo: "RESTOCK_ALERT", // <-- Etiqueta unificada con el type de la BD
        producto: producto,
        stockActual: stockFisico,
        umbralMinimo: umbralMinimo,
        ordenBorrador: ordenSugerida, // Datos de PurchaseOrder con su tipo RESTOCK_ALERT
        alerta: true,
        datos: resultado, // Cotización del RPA como apoyo visual
      });
      console.log(
        `[IoT] ✅ Alerta de reabastecimiento de ${producto} enviada por WebSocket.`,
      );
    })
    .catch((err) => {
      console.error(
        `[IoT] ❌ Error procesando alerta automática para ${producto}:`,
        err,
      );
      alertCooldowns.delete(cooldownKey);
    });

  return {
    status: 202,
    message: "Alerta de reabastecimiento registrada en BD y procesando cotización...",
    ordenBorrador: ordenSugerida,
  };
};