import { getIO } from "../../lib/socket.js";
import { processInventoryPipeline } from "../inventory/inventory.service.js";

// Memoria temporal para evitar que el sensor sature el bot RPA (Spam)
const alertCooldowns = new Map<string, number>();
const COOLDOWN_MINUTES = 5;

export const validarPayloadIoT = (data: any): string | null => {
    const { sensorId, producto, pesoBrutoKg, pesoUnitarioKg, stockFisico, umbralMinimo } = data || {};

    if (!sensorId || typeof sensorId !== 'string') return "sensorId es requerido y debe ser texto.";
    if (!producto || typeof producto !== 'string') return "producto es requerido y debe ser texto.";
    if (typeof pesoBrutoKg !== 'number' || typeof pesoUnitarioKg !== 'number') return "Los pesos deben ser numéricos.";
    if (typeof stockFisico !== 'number' || typeof umbralMinimo !== 'number') return "Stock y umbral deben ser numéricos.";

    return null;
};

export const procesarAlertaStock = async (payload: any) => {
    const { sensorId, producto, stockFisico, umbralMinimo } = payload;

    if (stockFisico > umbralMinimo) {
        return { status: 200, message: "Stock en niveles normales. No se requiere acción." };
    }

    // Verificar Cooldown
    const cooldownKey = `${sensorId}_${producto}`;
    const lastAlertTime = alertCooldowns.get(cooldownKey);
    const now = Date.now();

    if (lastAlertTime && (now - lastAlertTime) < COOLDOWN_MINUTES * 60 * 1000) {
        console.log(`[IoT] Alerta ignorada por cooldown para: ${producto}`);
        const error: any = new Error(`Alerta en enfriamiento. El bot ya está cotizando ${producto}.`);
        error.status = 429;
        throw error;
    }

    alertCooldowns.set(cooldownKey, now);
    console.log(`[IoT] ALERTA CRÍTICA: ${producto} (Stock: ${stockFisico}). Disparando RPA...`);

    // Probar el siguiente prompt para ver como lo interpreta la IA
    const promptAutomatico = `ALERTA DE SENSOR: El stock físico de "${producto}" ha caído a ${stockFisico} unidades. Por favor, busca proveedores urgentemente y cotiza las mejores opciones para reabastecer.`;

    processInventoryPipeline(promptAutomatico, "IOT")
        .then((resultado) => {
            // Aquí inyectamos el Socket: Obtenemos la instancia y emitimos
            const io = getIO();
            io.emit('alerta-stock', {
                producto: producto,
                alerta: true,
                datos: resultado // Contiene respuesta_ia y productos
            });
            console.log(`[IoT] ✅ Cotización de ${producto} enviada por WebSocket a los clientes.`);
        })
        .catch((err) => {
            console.error(`[IoT] ❌ Error procesando alerta automática para ${producto}:`, err);
            alertCooldowns.delete(cooldownKey);
        });

    return { status: 202, message: "Alerta recibida. Procesando cotización de emergencia..." };
};