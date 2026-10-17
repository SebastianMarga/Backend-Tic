import type { Request, Response } from "express";
import {
  processInventoryPipeline,
  obtenerSugerenciasReabastecimiento,
} from "./inventory.service.js";

// 1. Endpoint para el Chatbot (Guarda en TrendingProduct)
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

    res.status(200).json({
      tipo: "TENDENCIA_IA", // Etiqueta clara para diferenciar las sugerencias del chat
      ...resultado,
    });
  } catch (error) {
    console.error("Error en controlador (processUserQuery):", error);
    res.status(500).json({ error: "Error procesando la solicitud" });
  }
};

// 2. Endpoint para listar en la web los productos por reabastecer (PurchaseOrder con DRAFT + RESTOCK_ALERT)
export const getRestockSuggestions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const sugerencias = await obtenerSugerenciasReabastecimiento();
    res.status(200).json({
      tipo: "RESTOCK_ALERT", // Etiqueta unificada para las alertas de inventario
      data: sugerencias,
    });
  } catch (error) {
    console.error("Error obteniendo sugerencias de reabastecimiento:", error);
    res
      .status(500)
      .json({ error: "Error obteniendo productos por reabastecer" });
  }
};
