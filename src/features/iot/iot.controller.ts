import type { Request, Response } from "express";
import { validarPayloadIoT, procesarAlertaStock } from "./iot.service.js";

export const handleStockAlert = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const errorValidacion = validarPayloadIoT(req.body);
    if (errorValidacion) {
      res.status(400).json({ error: errorValidacion });
      return;
    }

    const resultado = await procesarAlertaStock(req.body);

    res.status(resultado.status).json({
      tipo: "REABASTECIMIENTO", // Etiqueta diferenciadora
      message: resultado.message,
      ordenBorrador: resultado.ordenBorrador ?? null,
    });
  } catch (error: any) {
    if (error.status === 429) {
      res.status(429).json({ message: error.message });
      return;
    }
    console.error("Error en IoT Controller:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor procesando alerta IoT." });
  }
};
