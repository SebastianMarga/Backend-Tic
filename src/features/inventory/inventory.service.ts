import Groq from "groq-sdk";

const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface RpaIntentResponse {
  requiereRpa: boolean;
  productoABuscar: string | null; // Nuevo campo para enviar a FastAPI
  mensajeParaUsuario: string;
}

export const analyzeInventoryIntent = async (
  prompt: string,
): Promise<RpaIntentResponse> => {
  const chatCompletion = await groqClient.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      {
        role: "system",
        content: `Eres un asistente que analiza si el usuario quiere buscar un producto en el catálogo de Infotec.
        
        SIEMPRE responde en este formato JSON estricto:
        {
          "requiereRpa": boolean, // true si pide buscar un producto
          "productoABuscar": string | null, // el nombre del producto que quiere buscar, o null si no aplica
          "mensajeParaUsuario": "Respuesta breve confirmando la búsqueda o respondiendo su duda general."
        }`,
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  return JSON.parse(
    chatCompletion.choices[0]?.message?.content || "{}",
  ) as RpaIntentResponse;
};
