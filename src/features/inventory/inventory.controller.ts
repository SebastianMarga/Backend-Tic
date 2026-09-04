import type { Request, Response } from "express";
import {
  analyzeInventoryIntent,
  generateNaturalResponse,
} from "./inventory.service.js";
import { saveTrendResults } from "../trends/trends.service.js";

const RPA_SERVICE_URL = process.env.RPA_SERVICE_URL;
if (!RPA_SERVICE_URL) throw new Error('No se encuentra URL del RPA.')

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

    const aiAnalysis = await analyzeInventoryIntent(prompt);
    let rpaData = null;
    let respuestaFinal = aiAnalysis.mensajeParaUsuario;
    let datosResumidos: any;

    if (aiAnalysis.requiereRpa && aiAnalysis.productoABuscar) {
      console.log(`[RPA] Buscando: ${aiAnalysis.productoABuscar}`);
      const rpaApiUrl = `${RPA_SERVICE_URL}buscar`;

      try {
        const rpaResponse = await fetch(rpaApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ producto: aiAnalysis.productoABuscar }),
        });

        if (rpaResponse.ok) {
          rpaData = await rpaResponse.json();
          console.log(
            "[RPA] ✅ Scraping completado. Resumiendo datos para la IA...",
          );

          datosResumidos = rpaData;

          // 1. Verificamos que el JSON contenga la lista de "resultados"
          if (rpaData && Array.isArray(rpaData.resultados)) {
            // 2. Mapeamos usando las llaves reales de tu bot en Python
            const listaMapeada = rpaData.resultados.map((item: any) => ({
              suggestedName: item.producto_evaluado,
              suggestedPrice: item.precio_soles,
              hasStock: item.tiene_stock_inmediato,
              urlProduct: item.url_producto,
              urlImage: item.url_imagen,
              notes: item.especificaciones_crudas,
            }));

            // 3. Ordenamos matemáticamente de menor a mayor precio
            listaMapeada.sort(
              (a: any, b: any) => a.suggestedPrice - b.suggestedPrice,
            );
            console.log(listaMapeada);

            // 4. Tomamos solo los 5 más baratos para no saturar los tokens
            datosResumidos = listaMapeada.slice(0, 5);
          } else {
            // Fallback de seguridad si el JSON llega con otra estructura
            const stringData = JSON.stringify(rpaData);
            datosResumidos =
              stringData.length > 2500
                ? stringData.substring(0, 2500) + "... [datos truncados]"
                : stringData;
          }
          const resultados = await saveTrendResults(datosResumidos);
          console.log(
            "[RPA] Resultados guardados en la base de datos:",
            resultados,
          );
          // Le pasamos SOLAMENTE los datos resumidos a la segunda IA
          respuestaFinal = await generateNaturalResponse(
            prompt,
            datosResumidos,
          );
        } else {
          respuestaFinal =
            "Hubo un problema consultando el catálogo en este momento.";
        }
      } catch (error) {
        console.error("[RPA]  Error conectando con FastAPI:", error);
        respuestaFinal =
          "El sistema de búsqueda no está disponible en este momento.";
      }
    }

    // Devolvemos la estructura limpia al Frontend
    res.status(200).json({
      respuesta_ia: respuestaFinal,
      productos: datosResumidos
    });
  } catch (error) {
    console.error("Error en controlador:", error);
    res.status(500).json({ error: "Error procesando la solicitud" });
  }
};
