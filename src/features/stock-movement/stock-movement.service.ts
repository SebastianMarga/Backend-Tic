import type { Batch, MovementReason, Prisma, Product } from "@prisma/client";
import { AppError } from "../../lib/errors/app-error.js";
import { prisma } from "../../lib/prisma/prisma.js";
import { resolveExpirationDate } from "../batch/batch.service.js";
import type { MovementCreateDTO, MovementFilters } from "./stock-movement.dto.js";

type Tx = Prisma.TransactionClient;

const IN_REASONS: readonly MovementReason[] = ["RESTOCK", "RETURN", "INVENTORY_COUNT"];
const OUT_REASONS: readonly MovementReason[] = ["SALE", "EXPIRED_DISCARD", "DAMAGED", "INVENTORY_COUNT"];

const movementInclude = {
    product: { select: { id: true, sku: true, name: true } },
    batch: { select: { id: true, batchNumber: true, expirationDate: true } },
    user: { select: { id: true, name: true } },
} as const;

// ---------------------------------------------------------------- lectura

export const getMovements = async (filters: MovementFilters) => {
    return prisma.stockMovement.findMany({
        where: {
            ...(filters.productId !== undefined ? { productId: filters.productId } : {}),
            ...(filters.batchId !== undefined ? { batchId: filters.batchId } : {}),
            ...(filters.type !== undefined ? { type: filters.type } : {}),
            ...(filters.reason !== undefined ? { reason: filters.reason } : {}),
            ...(filters.from || filters.to
                ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
                : {}),
        },
        include: movementInclude,
        orderBy: { createdAt: "desc" },
        take: filters.limit,
    });
};

export const getMovementById = async (id: number) => {
    const movement = await prisma.stockMovement.findUnique({ where: { id }, include: movementInclude });
    if (!movement) throw new AppError(`No se encontró el movimiento con ID: ${id}`, 404);
    return movement;
};

// ---------------------------------------------------------------- escritura

const getOwnBatch = async (tx: Tx, batchId: number, productId: number): Promise<Batch> => {
    const batch = await tx.batch.findUnique({ where: { id: batchId } });
    if (!batch || batch.productId !== productId) {
        throw new AppError(`El lote ${batchId} no existe o no pertenece a este producto.`, 404);
    }
    return batch;
};

const registerIn = async (tx: Tx, product: Product, dto: MovementCreateDTO, userId: number | null) => {
    const reason = dto.reason ?? "RESTOCK";
    if (!IN_REASONS.includes(reason)) {
        throw new AppError(`Motivo inválido para una entrada. Permitidos: ${IN_REASONS.join(", ")}.`, 400);
    }

    let batch: Batch;
    if (dto.batchId !== undefined) {
        const existing = await getOwnBatch(tx, dto.batchId, product.id);
        if (existing.status === "EXPIRED") throw new AppError("No se puede ingresar stock a un lote EXPIRED.", 409);
        batch = await tx.batch.update({
            where: { id: existing.id },
            data: { quantity: { increment: dto.quantity }, status: "ACTIVE" },
        });
    } else {
        if (!dto.batchNumber) {
            throw new AppError("Para una entrada indica batchId (lote existente) o batchNumber (lote nuevo).", 400);
        }
        batch = await tx.batch.create({
            data: {
                productId: product.id,
                batchNumber: dto.batchNumber,
                quantity: dto.quantity,
                expirationDate: resolveExpirationDate(product, dto.expirationDate),
            },
        });
    }

    const stockAfter = product.currentStock + dto.quantity;
    await tx.product.update({ where: { id: product.id }, data: { currentStock: stockAfter } });

    const movement = await tx.stockMovement.create({
        data: {
            productId: product.id,
            batchId: batch.id,
            userId,
            type: "IN",
            quantity: dto.quantity,
            stockAfter,
            reason,
            ...(dto.description !== undefined ? { description: dto.description } : {}),
        },
        include: movementInclude,
    });
    return [movement];
};

const registerOut = async (tx: Tx, product: Product, dto: MovementCreateDTO, userId: number | null) => {
    const reason = dto.reason ?? "SALE";
    if (!OUT_REASONS.includes(reason)) {
        throw new AppError(`Motivo inválido para una salida. Permitidos: ${OUT_REASONS.join(", ")}.`, 400);
    }

    // Lotes candidatos: el indicado, o todos los ACTIVE por vencimiento más próximo (FEFO).
    // Las ventas no consumen lotes ya vencidos; las bajas (merma/vencido) sí.
    let candidates: Batch[];
    if (dto.batchId !== undefined) {
        candidates = [await getOwnBatch(tx, dto.batchId, product.id)];
    } else {
        candidates = await tx.batch.findMany({
            where: {
                productId: product.id,
                status: "ACTIVE",
                quantity: { gt: 0 },
                ...(reason === "SALE" ? { expirationDate: { gt: new Date() } } : {}),
            },
            orderBy: { expirationDate: "asc" },
        });
    }

    const available = candidates.reduce((sum, b) => sum + b.quantity, 0);
    if (available < dto.quantity) {
        throw new AppError(`Stock insuficiente en lotes: disponible ${available}, solicitado ${dto.quantity}.`, 409);
    }

    let remaining = dto.quantity;
    let running = product.currentStock;
    const movements = [];

    for (const batch of candidates) {
        if (remaining === 0) break;
        const take = Math.min(batch.quantity, remaining);
        const newQty = batch.quantity - take;

        await tx.batch.update({
            where: { id: batch.id },
            data: { quantity: newQty, ...(newQty === 0 ? { status: "DEPLETED" as const } : {}) },
        });

        // currentStock puede venir del sensor IoT y no coincidir con los lotes: nunca baja de 0
        running = Math.max(running - take, 0);

        movements.push(
            await tx.stockMovement.create({
                data: {
                    productId: product.id,
                    batchId: batch.id,
                    userId,
                    type: "OUT",
                    quantity: take,
                    stockAfter: running,
                    reason,
                    ...(dto.description !== undefined ? { description: dto.description } : {}),
                },
                include: movementInclude,
            }),
        );
        remaining -= take;
    }

    await tx.product.update({ where: { id: product.id }, data: { currentStock: running } });
    return movements;
};

const registerAdjustment = async (tx: Tx, product: Product, dto: MovementCreateDTO, userId: number | null) => {
    if (dto.batchId === undefined) throw new AppError("Un ajuste requiere batchId (el lote que se corrige).", 400);
    const batch = await getOwnBatch(tx, dto.batchId, product.id);

    const newQty = batch.quantity + dto.quantity;
    if (newQty < 0) {
        throw new AppError(`El ajuste dejaría el lote en negativo (${batch.quantity} + ${dto.quantity} < 0).`, 409);
    }

    await tx.batch.update({
        where: { id: batch.id },
        data: {
            quantity: newQty,
            ...(newQty === 0 ? { status: "DEPLETED" as const } : {}),
            ...(newQty > 0 && batch.status === "DEPLETED" ? { status: "ACTIVE" as const } : {}),
        },
    });

    const stockAfter = Math.max(product.currentStock + dto.quantity, 0);
    await tx.product.update({ where: { id: product.id }, data: { currentStock: stockAfter } });

    const movement = await tx.stockMovement.create({
        data: {
            productId: product.id,
            batchId: batch.id,
            userId,
            type: "ADJUSTMENT",
            quantity: dto.quantity, // delta con signo
            stockAfter,
            reason: dto.reason ?? "INVENTORY_COUNT",
            ...(dto.description !== undefined ? { description: dto.description } : {}),
        },
        include: movementInclude,
    });
    return [movement];
};

/**
 * Registra una entrada, salida (con FEFO) o ajuste. Devuelve la lista de movimientos creados:
 * una salida FEFO puede repartirse en varios lotes y generar varios movimientos.
 */
export const registerMovement = async (dto: MovementCreateDTO, userId: number | null) => {
    return prisma.$transaction(
        async (tx) => {
            const product = await tx.product.findUnique({ where: { id: dto.productId } });
            if (!product) throw new AppError(`No se encontró el producto con ID: ${dto.productId}`, 404);

            switch (dto.type) {
                case "IN":
                    return registerIn(tx, product, dto, userId);
                case "OUT":
                    return registerOut(tx, product, dto, userId);
                case "ADJUSTMENT":
                    return registerAdjustment(tx, product, dto, userId);
            }
        },
        { isolationLevel: "Serializable" },
    );
};
