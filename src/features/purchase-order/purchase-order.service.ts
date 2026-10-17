import type { OrderStatus } from "@prisma/client";
import { AppError } from "../../lib/errors/app-error.js";
import { prisma } from "../../lib/prisma/prisma.js";
import { getIO } from "../../lib/socket.js";
import { resolveExpirationDate } from "../batch/batch.service.js";
import type {
    ApproveRestockLineDTO, OrderCreateDTO, OrderFilters, OrderItemInputDTO, ReceiveOrderDTO,
} from "./purchase-order.dto.js";

const orderInclude = {
    supplier: { select: { id: true, name: true, email: true } },
    items: {
        include: {
            product: { select: { id: true, sku: true, name: true, currentStock: true, optimalOrderQty: true } },
        },
        orderBy: { id: "asc" },
    },
} as const;

/**
 * Máquina de estados. DELIVERED no aparece como destino porque solo se alcanza
 * con receiveOrder(), que además genera lotes y movimientos de stock.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
    DRAFT: ["PENDING_RPA"],
    PENDING_RPA: ["PROCESSING", "SENT", "FAILED", "DRAFT"],
    PROCESSING: ["SENT", "FAILED"],
    SENT: ["FAILED"],
    DELIVERED: [],
    FAILED: ["DRAFT", "PENDING_RPA"],
};

// ---------------------------------------------------------------- helpers

const findOrderOrFail = async (id: number) => {
    const order = await prisma.purchaseOrder.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new AppError(`No se encontró la orden de compra con ID: ${id}`, 404);
    return order;
};

const assertDraft = (status: OrderStatus) => {
    if (status !== "DRAFT") {
        throw new AppError(`Solo se puede modificar una orden en DRAFT (estado actual: ${status}).`, 409);
    }
};

/** Valida que los productos existan y pertenezcan al proveedor de la orden. */
const assertProductsBelongToSupplier = async (supplierId: number, productIds: number[]) => {
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, supplierId: true },
    });

    const found = new Set(products.map((p) => p.id));
    const missing = productIds.filter((id) => !found.has(id));
    if (missing.length > 0) throw new AppError(`Producto(s) inexistente(s): ${missing.join(", ")}.`, 404);

    const foreign = products.filter((p) => p.supplierId !== supplierId);
    if (foreign.length > 0) {
        throw new AppError(
            `Estos productos no pertenecen al proveedor ${supplierId}: ${foreign.map((p) => p.name).join(", ")}.`,
            400,
        );
    }
};

// ---------------------------------------------------------------- CRUD

export const getOrders = async (filters: OrderFilters) => {
    return prisma.purchaseOrder.findMany({
        where: {
            ...(filters.status !== undefined ? { status: filters.status } : {}),
            ...(filters.type !== undefined ? { type: filters.type } : {}),
            ...(filters.supplierId !== undefined ? { supplierId: filters.supplierId } : {}),
        },
        include: orderInclude,
        orderBy: { createdAt: "desc" },
    });
};

export const getOrderById = findOrderOrFail;

/** Orden creada a mano por un admin (type MANUAL). Las RESTOCK_ALERT las crea el sensor IoT. */
export const createOrder = async (dto: OrderCreateDTO) => {
    const supplier = await prisma.supplier.findUnique({ where: { id: dto.supplierId }, select: { id: true } });
    if (!supplier) throw new AppError(`El proveedor con ID: ${dto.supplierId} no existe.`, 404);

    const productIds = dto.items.map((i) => i.productId);
    if (new Set(productIds).size !== productIds.length) {
        throw new AppError("Hay productos repetidos en la orden.", 400);
    }
    await assertProductsBelongToSupplier(dto.supplierId, productIds);

    return prisma.purchaseOrder.create({
        data: {
            supplierId: dto.supplierId,
            type: "MANUAL",
            status: "DRAFT",
            items: { create: dto.items.map((i) => ({ productId: i.productId, quantity: i.quantity })) },
        },
        include: orderInclude,
    });
};

export const deleteOrder = async (id: number) => {
    const order = await findOrderOrFail(id);
    if (order.status !== "DRAFT" && order.status !== "FAILED") {
        throw new AppError(`Solo se pueden eliminar órdenes en DRAFT o FAILED (estado actual: ${order.status}).`, 409);
    }
    await prisma.$transaction([
        prisma.orderItem.deleteMany({ where: { purchaseOrderId: id } }),
        prisma.purchaseOrder.delete({ where: { id } }),
    ]);
};

// ---------------------------------------------------------------- líneas de la orden

export const addItem = async (orderId: number, dto: OrderItemInputDTO) => {
    const order = await findOrderOrFail(orderId);
    assertDraft(order.status);

    if (order.items.some((i) => i.productId === dto.productId)) {
        throw new AppError("Ese producto ya está en la orden: edita su cantidad en lugar de agregarlo.", 409);
    }
    await assertProductsBelongToSupplier(order.supplierId, [dto.productId]);

    await prisma.orderItem.create({
        data: { purchaseOrderId: orderId, productId: dto.productId, quantity: dto.quantity },
    });
    return findOrderOrFail(orderId);
};

export const updateItem = async (orderId: number, itemId: number, quantity: number) => {
    const order = await findOrderOrFail(orderId);
    assertDraft(order.status);

    if (!order.items.some((i) => i.id === itemId)) {
        throw new AppError(`La línea ${itemId} no pertenece a la orden ${orderId}.`, 404);
    }
    await prisma.orderItem.update({ where: { id: itemId }, data: { quantity } });
    return findOrderOrFail(orderId);
};

export const removeItem = async (orderId: number, itemId: number) => {
    const order = await findOrderOrFail(orderId);
    assertDraft(order.status);

    if (!order.items.some((i) => i.id === itemId)) {
        throw new AppError(`La línea ${itemId} no pertenece a la orden ${orderId}.`, 404);
    }
    await prisma.orderItem.delete({ where: { id: itemId } });
    return findOrderOrFail(orderId);
};

// ---------------------------------------------------------------- ciclo de vida

/**
 * Cambia el estado respetando TRANSITIONS.
 * Al pasar a PENDING_RPA, las líneas con cantidad 0 (las que crea el sensor IoT)
 * se completan con la cantidad óptima de pedido del producto.
 */
export const changeOrderStatus = async (id: number, target: OrderStatus) => {
    if (target === "DELIVERED") {
        throw new AppError("Para marcar DELIVERED usa POST /:id/receive: crea los lotes y movimientos de stock.", 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
        const order = await tx.purchaseOrder.findUnique({
            where: { id },
            include: { items: { include: { product: true } } },
        });
        if (!order) throw new AppError(`No se encontró la orden de compra con ID: ${id}`, 404);

        const allowed = TRANSITIONS[order.status];
        if (!allowed.includes(target)) {
            throw new AppError(
                `Transición no permitida: ${order.status} → ${target}. Permitidas: ${allowed.join(", ") || "ninguna"}.`,
                409,
            );
        }

        if (target === "PENDING_RPA") {
            if (order.items.length === 0) throw new AppError("No se puede confirmar una orden sin productos.", 400);
            for (const item of order.items) {
                if (item.quantity <= 0) {
                    await tx.orderItem.update({ where: { id: item.id }, data: { quantity: item.product.optimalOrderQty } });
                }
            }
        }

        return tx.purchaseOrder.update({ where: { id }, data: { status: target }, include: orderInclude });
    });

    // Modo demo: al terminar la compra de una alerta del sensor, la mercancía "llega" sola.
    if (target === "SENT" && updated.type === "RESTOCK_ALERT") scheduleDemoReceive(updated.id);

    return updated;
};

/** Botón "Comprar" del chat/web: DRAFT → PENDING_RPA. */
export const confirmOrder = (id: number) => changeOrderStatus(id, "PENDING_RPA");

/**
 * Aprobación del admin sobre una alerta de reestock (orden RESTOCK_ALERT en DRAFT):
 * fija cantidad y cotización elegida por línea, pasa a PENDING_RPA y le pide al RPA que compre.
 * La respuesta es inmediata; la compra sigue en segundo plano (PROCESSING → SENT / FAILED).
 */
export const approveRestock = async (id: number, lines: ApproveRestockLineDTO[]) => {
    const order = await findOrderOrFail(id);
    assertDraft(order.status);
    if (order.type !== "RESTOCK_ALERT") {
        throw new AppError("Esta orden no es una alerta de reabastecimiento.", 400);
    }

    const byId = new Map(order.items.map((i) => [i.id, i]));
    for (const line of lines) {
        if (!byId.has(line.itemId)) throw new AppError(`La línea ${line.itemId} no pertenece a la orden ${id}.`, 404);
    }

    const urlFor = (itemId: number) =>
        lines.find((l) => l.itemId === itemId)?.selectedUrl ?? byId.get(itemId)?.selectedUrl ?? null;

    for (const item of order.items) {
        const url = urlFor(item.id);
        if (!url) throw new AppError(`Elige una cotización para: ${item.product.name}.`, 400);

        // Solo se compra en URLs que realmente trajo el RPA
        const quotes = Array.isArray(item.quotes) ? (item.quotes as Array<{ urlProduct?: string }>) : [];
        if (!quotes.some((q) => q?.urlProduct === url)) {
            throw new AppError(`La cotización elegida para ${item.product.name} no es una de las sugeridas.`, 400);
        }
    }

    await prisma.$transaction(
        lines.map((l) =>
            prisma.orderItem.update({
                where: { id: l.itemId },
                data: { quantity: l.quantity, ...(l.selectedUrl ? { selectedUrl: l.selectedUrl } : {}) },
            }),
        ),
    );

    const confirmed = await changeOrderStatus(id, "PENDING_RPA");
    void dispatchToRpa(id);
    return confirmed;
};

/**
 * Le pide al RPA que haga la compra (POST {RPA_SERVICE_URL}comprar) y refleja el resultado:
 * PENDING_RPA → PROCESSING → SENT, o FAILED si algo falla. Al llegar a SENT, el modo demo
 * (DEMO_AUTO_RECEIVE) recibe la mercancía y repone el stock del almacén.
 */
const dispatchToRpa = async (orderId: number) => {
    try {
        const order = await findOrderOrFail(orderId);
        const productos = order.items.map((i) => i.selectedUrl).filter((u): u is string => !!u);
        if (productos.length === 0) throw new Error("La orden no tiene URLs de compra.");

        const rpaUrl = process.env.RPA_SERVICE_URL;
        if (!rpaUrl) throw new Error("RPA_SERVICE_URL no está definida.");

        await changeOrderStatus(orderId, "PROCESSING");

        const res = await fetch(`${rpaUrl}comprar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productos }),
        });
        if (!res.ok) throw new Error(`El RPA respondió ${res.status}.`);

        await changeOrderStatus(orderId, "SENT");
        console.log(`[Orden #${orderId}] 🤖 Compra enviada por el RPA.`);
    } catch (err) {
        console.error(`[Orden #${orderId}] ❌ Falló la compra con el RPA:`, err);
        await changeOrderStatus(orderId, "FAILED").catch(() => undefined);
    }
};

/**
 * DEMO_AUTO_RECEIVE=true  → al pasar a SENT, la orden se recibe sola tras
 * DEMO_AUTO_RECEIVE_DELAY_MS (5000 por defecto). Solo aplica a órdenes RESTOCK_ALERT.
 * En producción déjalo apagado y recibe con POST /:id/receive cuando llegue la mercancía.
 */
const scheduleDemoReceive = (orderId: number) => {
    if (process.env.DEMO_AUTO_RECEIVE !== "true") return;

    const configured = Number(process.env.DEMO_AUTO_RECEIVE_DELAY_MS);
    const delay = Number.isFinite(configured) && configured >= 0 ? configured : 5000;

    setTimeout(() => {
        receiveOrder(orderId, {}, null).catch((err) =>
            console.error(`[Orden #${orderId}] ❌ Falló la recepción automática (demo):`, err),
        );
    }, delay);
};

/**
 * SENT → DELIVERED. En una sola transacción: crea un lote por producto, suma al stock
 * y registra el movimiento IN (motivo RESTOCK). Si la orden nació de una alerta del
 * sensor, avisa por socket ('reabastecimiento') para que la estantería se rellene.
 */
export const receiveOrder = async (id: number, dto: ReceiveOrderDTO, userId: number | null) => {
    const { order, received } = await prisma.$transaction(
        async (tx) => {
            const order = await tx.purchaseOrder.findUnique({
                where: { id },
                include: { items: { include: { product: true } } },
            });
            if (!order) throw new AppError(`No se encontró la orden de compra con ID: ${id}`, 404);
            if (order.status !== "SENT") {
                throw new AppError(`Solo se puede recibir una orden en estado SENT (estado actual: ${order.status}).`, 409);
            }

            const overrides = new Map((dto.items ?? []).map((i) => [i.productId, i]));
            const orderProductIds = new Set(order.items.map((i) => i.productId));
            for (const productId of overrides.keys()) {
                if (!orderProductIds.has(productId)) {
                    throw new AppError(`El producto ${productId} no forma parte de la orden ${id}.`, 400);
                }
            }

            const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
            const received = [];

            for (const item of order.items) {
                const override = overrides.get(item.productId);
                const quantity = override?.quantityReceived ?? item.quantity;
                if (quantity === 0) continue; // ese producto no llegó

                const batch = await tx.batch.create({
                    data: {
                        productId: item.productId,
                        batchNumber: override?.batchNumber ?? `OC${order.id}-${item.product.sku}-${today}`,
                        quantity,
                        expirationDate: resolveExpirationDate(item.product, override?.expirationDate),
                    },
                });

                const product = await tx.product.update({
                    where: { id: item.productId },
                    data: { currentStock: { increment: quantity } },
                    select: { currentStock: true },
                });

                await tx.stockMovement.create({
                    data: {
                        productId: item.productId,
                        batchId: batch.id,
                        userId,
                        type: "IN",
                        quantity,
                        stockAfter: product.currentStock,
                        reason: "RESTOCK",
                        description: `Recepción de la orden de compra #${order.id}`,
                    },
                });

                received.push({
                    productId: item.productId,
                    sku: item.product.sku,
                    name: item.product.name,
                    batchId: batch.id,
                    quantityReceived: quantity,
                    stockAfter: product.currentStock,
                });
            }

            if (received.length === 0) throw new AppError("No se recibió ninguna unidad: revisa las cantidades.", 400);

            await tx.purchaseOrder.update({ where: { id }, data: { status: "DELIVERED" } });
            return { order, received };
        },
        { timeout: 15_000 },
    );

    // Fuera de la transacción: un fallo del socket no debe deshacer la recepción ya guardada.
    if (order.type === "RESTOCK_ALERT") {
        try {
            getIO().emit("reabastecimiento", {
                tipo: "RESTOCK_DELIVERED",
                purchaseOrderId: order.id,
                items: received.map((r) => ({
                    productId: r.productId,
                    sku: r.sku,
                    producto: r.name,
                    cantidadRecibida: r.quantityReceived,
                    stockActual: r.stockAfter,
                })),
            });
            console.log(`[Orden #${order.id}] 📦 Reabastecimiento notificado por WebSocket.`);
        } catch (err) {
            console.warn(`[Orden #${order.id}] No se pudo emitir 'reabastecimiento':`, err);
        }
    }

    return { order: await findOrderOrFail(id), received };
};
