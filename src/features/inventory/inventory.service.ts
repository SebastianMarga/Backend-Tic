import Groq from "groq-sdk";
import { saveTrendResults } from "../trends/trends.service.js";
import { prisma } from "../../lib/prisma/prisma.js";

const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });

const RPA_SERVICE_URL = process.env.RPA_SERVICE_URL;
if (!RPA_SERVICE_URL) throw new Error("No se encuentra URL del RPA.");

export interface RpaIntentResponse {
  requiereRpa: boolean;
  productoABuscar: string | null; // Nuevo campo para enviar a FastAPI
  mensajeParaUsuario: string;
}

export interface InventoryProcessResult {
  respuesta_ia: string;
  productos: any;
}

export const getDomainName = (url: string): string => {
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  return hostname.split(".")[0] ?? "";
};

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

export const generateNaturalResponse = async (
  prompt: string,
  rpaData: any,
): Promise<string> => {
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
        - Nunca menciones que estás leyendo un JSON, una base de datos o un sistema automatizado.`,
      },
      {
        role: "user",
        content: `Pregunta: "${prompt}"\n\nDatos reales: ${JSON.stringify(rpaData)}`,
      },
    ],
    temperature: 0.2, // Reducimos la temperatura para que no invente datos
  });

  return (
    chatCompletion.choices[0]?.message?.content ||
    "Aquí tienes la información de tu búsqueda."
  );
};

export const processInventoryPipeline = async (
  prompt: string,
  origen: "CHAT" | "IOT" = "CHAT",
): Promise<InventoryProcessResult> => {
  console.log(`[Pipeline] Procesando solicitud desde origen: ${origen}`);

  const aiAnalysis = await analyzeInventoryIntent(prompt);
  let rpaData: any = null;
  let respuestaFinal = aiAnalysis.mensajeParaUsuario;
  let datosResumidos: any = null;

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
        console.log("[RPA] ✅ Scraping completado. Resumiendo datos...");

        if (rpaData && Array.isArray(rpaData.resultados)) {
          const listaMapeada = rpaData.resultados.map((item: any) => ({
            suggestedName: item.producto_evaluado,
            suggestedPrice: item.precio_soles,
            hasStock: item.tiene_stock_inmediato,
            urlProduct: item.url_producto,
            urlImage: item.url_imagen,
            notes: item.especificaciones_crudas,
            source: getDomainName(item.url_producto),
            originType: origen === "CHAT" ? "TENDENCIA_IA" : "RESTOCK_ALERT",
          }));

          listaMapeada.sort(
            (a: any, b: any) => a.suggestedPrice - b.suggestedPrice,
          );
          datosResumidos = listaMapeada.slice(0, 5);

          // 🔥 SEPARACIÓN CLAVE: Solo guardamos en TrendingProduct si viene del CHAT
          if (origen === "CHAT") {
            const datosParaPrisma = datosResumidos.map(
              ({ originType, ...rest }: any) => rest,
            );
            const resultados = await saveTrendResults(datosParaPrisma);
            console.log(
              "[RPA - CHAT] ✅ Tendencias guardadas en TrendingProduct:",
              resultados,
            );
          } else {
            console.log(
              "[RPA - IOT] 📦 Cotización de reabastecimiento lista (no se guarda en TrendingProduct).",
            );
          }
        } else {
          const stringData = JSON.stringify(rpaData);
          datosResumidos =
            stringData.length > 2500
              ? stringData.substring(0, 2500) + "... [datos truncados]"
              : stringData;
        }

        respuestaFinal = await generateNaturalResponse(prompt, datosResumidos);
      } else {
        respuestaFinal =
          "Hubo un problema consultando el catálogo en este momento.";
      }
    } catch (error) {
      console.error("[RPA] Error conectando con FastAPI:", error);
      respuestaFinal =
        "El sistema de búsqueda no está disponible en este momento.";
    }
  }

  return {
    respuesta_ia: respuestaFinal,
    productos: datosResumidos,
  };
};

export const crearSugerenciaReabastecimiento = async (
  nombreProducto: string,
  stockFisico: number,
) => {
  // 1. Buscar el producto en tu catálogo real
  const product = await prisma.product.findFirst({
    where: {
      name: { contains: nombreProducto, mode: "insensitive" },
    },
  });

  if (!product) {
    console.warn(
      `[IoT -> BD] El producto "${nombreProducto}" no existe en la tabla Product.`,
    );
    return null;
  }

  // 2. Actualizar el stock actual con lo que reportó el sensor
  await prisma.product.update({
    where: { id: product.id },
    data: { currentStock: stockFisico },
  });

  // 3. Verificar si ya existe una sugerencia u orden activa para este producto
  const existingItem = await prisma.orderItem.findFirst({
    where: {
      productId: product.id,
      order: {
        status: { in: ["DRAFT", "PENDING_RPA", "PROCESSING", "SENT"] },
      },
    },
  });

  if (existingItem) {
    console.log(
      `[IoT -> BD] "${product.name}" ya tiene una sugerencia de reabastecimiento activa.`,
    );
    return existingItem;
  }

  // 4. Una orden borrador por producto: así el admin aprueba o rechaza cada alerta por separado
  const draftOrder = await prisma.purchaseOrder.create({
    data: {
      supplierId: product.supplierId,
      status: "DRAFT",
      type: "RESTOCK_ALERT", // <-- Diferenciador permanente de reabastecimiento
    },
  });

  // 5. Insertar el producto en OrderItem
  const newOrderItem = await prisma.orderItem.create({
    data: {
      purchaseOrderId: draftOrder.id,
      productId: product.id,
      quantity: 0,
    },
    include: {
      product: { include: { supplier: true } },
      order: true,
    },
  });

  console.log(
    `[IoT -> BD] ✅ Sugerencia de REABASTECIMIENTO creada para: ${product.name}`,
  );
  return newOrderItem;
};

export const obtenerSugerenciasReabastecimiento = async () => {
  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        status: "DRAFT",
        type: "RESTOCK_ALERT", // <-- Filtramos solo las que son alertas de reabastecimiento IoT
      },
    },
    include: {
      product: {
        include: { supplier: true, category: true },
      },
      order: true,
    },
    orderBy: {
      order: { createdAt: "desc" },
    },
  });

  return items.map((item) => ({
    orderItemId: item.id,
    purchaseOrderId: item.purchaseOrderId,
    productId: item.product.id,
    sku: item.product.sku,
    name: item.product.name,
    currentStock: item.product.currentStock,
    threshold: item.product.dynamicThreshold,
    supplierName: item.product.supplier.name,
    quantity: item.quantity,
    optimalOrderQty: item.product.optimalOrderQty,
    quotes: item.quotes ?? [], // Cotizaciones del RPA (vacío mientras el bot aún busca)
    selectedUrl: item.selectedUrl,
    tipo: "RESTOCK_ALERT", // Etiqueta diferenciadora para las tarjetas en el Frontend
    createdAt: item.order.createdAt,
  }));
};
