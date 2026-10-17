import type { Request, Response } from "express";
import { processInventoryPipeline } from "./inventory.service.js";

export const processUserQuery = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "El prompt es requerido" });
      return;
    }
    const resultado = await processInventoryPipeline(prompt, "CHAT");
    res.status(200).json(resultado);
  } catch (error) {
    console.error("Error en controlador:", error);
    res.status(500).json({ error: "Error procesando la solicitud" });
  }
};
