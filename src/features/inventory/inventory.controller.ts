import type { Request, Response } from "express";
import { analyzeInventoryIntent } from "./inventory.service.js";

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

    // 1. La IA analiza el prompt y extrae el producto
    const aiAnalysis = await analyzeInventoryIntent(prompt);
    let rpaData = null;

    // 2. Si la IA detecta que hay que buscar, llamamos a tu endpoint exacto de FastAPI
    if (aiAnalysis.requiereRpa && aiAnalysis.productoABuscar) {
      console.log(
        `[RPA] Solicitando búsqueda de: ${aiAnalysis.productoABuscar} en el puerto 3001`,
      );

      const rpaApiUrl =
        process.env.RPA_SERVICE_URL || "http://rpa-service:3001/api/buscar";

      try {
        const rpaResponse = await fetch(rpaApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            producto: aiAnalysis.productoABuscar, // Este es el formato exacto que pide tu clase OrdenBusqueda
          }),
        });

        if (!rpaResponse.ok) {
          throw new Error(`El bot falló con status: ${rpaResponse.status}`);
        }

        // 3. Capturamos el resultado_json que devuelve tu bot.py
        rpaData = await rpaResponse.json();
        console.log("[RPA] ✅ Scraping completado con éxito.");
      } catch (error) {
        console.error(
          "[RPA] ❌ Error conectando con el scraper FastAPI:",
          error,
        );
      }
    }

    // 4. Respondemos al frontend de React con el mensaje de la IA y los datos del scraping
    res.status(200).json({
      aiContext: aiAnalysis,
      datosInfotec: rpaData,
    });
  } catch (error) {
    console.error("Error en controlador:", error);
    res.status(500).json({ error: "Error procesando la solicitud" });
  }
};
