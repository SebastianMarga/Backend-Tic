import type { Request, Response } from 'express';
import { analyzeInventoryIntent } from './inventory.service.js';

export const processUserQuery = async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      res.status(400).json({ error: "El prompt es requerido" });
      return;
    }

    const aiAnalysis = await analyzeInventoryIntent(prompt);

    if (aiAnalysis.requiereRpa) {
      const rpaApiUrl = process.env.RPA_API_URL || 'http://localhost:8000/api/run-bot'; // Apunta al FastAPI de api.py
      
      try {
        await fetch(rpaApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: aiAnalysis.accionRpa,
            context: aiAnalysis.mensajeParaUsuario
          })
        });
        console.log(`[RPA] Orden enviada exitosamente a FastAPI.`);
      } catch (error) {
        console.error("[RPA] Error conectando con el bot de Playwright:", error);
      }
    }
    
    res.status(200).json(aiAnalysis);

  } catch (error: any) {
    console.error("Error detallado en el servidor:", error);
    res.status(500).json({ 
      error: "Error procesando la solicitud", 
      detalle: error.message || "Revisa la terminal para más detalles" 
    });
  }
};