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

export const generateNaturalResponse = async (prompt: string, rpaData: any): Promise<string> => {
  const chatCompletion = await groqClient.chat.completions.create({
    model: "openai/gpt-oss-120b", 
    messages: [
      {
        role: "system",
        content: `Eres un asistente de ventas amigable y conversacional. Tu objetivo es leer los resultados de búsqueda y responder al usuario de forma cálida, fluida y directa.
        
        Reglas ESTRICTAS:
        - Escribe en párrafos naturales. PROHIBIDO usar tablas (Markdown como |---|) o fichas técnicas robóticas.
        - Usa viñetas simples (*) solo si necesitas listar 2 o 3 opciones.
        - NUNCA inventes precios, stock ni modelos. Si el dato no está, di que no tienes esa información.
        - Si te piden el más económico, revisa cuidadosamente todos los precios de la lista que recibas antes de responder.
        - Nunca menciones que estás leyendo un JSON, una base de datos o un sistema automatizado.`
      },
      { 
        role: "user", 
        content: `Pregunta: "${prompt}"\n\nDatos reales: ${JSON.stringify(rpaData)}` 
      }
    ],
    temperature: 0.2 // Reducimos la temperatura para que no invente datos
  });

  return chatCompletion.choices[0]?.message?.content || "Aquí tienes la información de tu búsqueda.";
};
