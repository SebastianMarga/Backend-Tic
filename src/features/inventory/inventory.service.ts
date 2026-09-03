import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';

dotenv.config();
const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export interface RpaIntentResponse {
  requiereRpa: boolean;
  accionRpa: 'AUDITAR_STOCK' | 'CREAR_ORDEN' | 'NINGUNA';
  mensajeParaUsuario: string;
}

export const analyzeInventoryIntent = async (prompt: string): Promise<RpaIntentResponse> => {
  const chatCompletion = await groqClient.chat.completions.create({
    model: "openai/gpt-oss-120b", 
    messages: [
      {
        role: "system",
        content: `Eres un asistente virtual experto en gestión de inventarios. Tienes dos tareas principales:
        1. Responder dudas generales del usuario de forma clara, amable y conversacional.
        2. Detectar si el usuario te está pidiendo ejecutar una acción operativa (como pedir stock o auditar el sistema).

        SIEMPRE debes responder en este formato JSON estricto:
        {
          "requiereRpa": boolean, // true SOLO si pide ejecutar una acción operativa
          "accionRpa": "AUDITAR_STOCK" | "CREAR_ORDEN" | "NINGUNA",
          "mensajeParaUsuario": "Tu respuesta detallada para el usuario. Aquí respondes su duda teórica o le confirmas que iniciarás la acción."
        }`
      },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3 
  });

  return JSON.parse(chatCompletion.choices[0]?.message?.content || '{}') as RpaIntentResponse;
};