import { AppError } from "../../lib/errors/app-error.js";
import { prisma } from "../../lib/prisma/prisma.js";
import { stripUndefined } from "../../lib/validation.js";
import type { BatchFilters, BatchUpdateDTO } from "./batch.dto.js";

/** Fecha "sin vencimiento" para productos no perecibles (Batch.expirationDate es obligatorio). */
export const NO_EXPIRY_DATE = new Date("9999-12-31T00:00:00.000Z");

/**
 * Decide la fecha de vencimiento de un lote nuevo:
 *  1. la que envíe el usuario,
 *  2. hoy + shelfLifeDays del producto,
 *  3. si es perecible y no hay dato → error,
 *  4. si no es perecible → NO_EXPIRY_DATE.
 */
export const resolveExpirationDate = (
    product: { name: string; isPerishable: boolean; shelfLifeDays: number | null },
    provided?: Date,
): Date => {
    if (provided) return provided;
    if (product.shelfLifeDays) {
        const date = new Date();
        date.setDate(date.getDate() + product.shelfLifeDays);
        return date;
    }
    if (product.isPerishable) {
        throw new AppError(
            `"${product.name}" es perecible: indica expirationDate o define shelfLifeDays en el producto.`,
            400,
        );
    }
    return NO_EXPIRY_DATE;
};

const batchInclude = {
    product: { select: { id: true, sku: true, name: true } },
} as const;

export const getBatches = async (filters: BatchFilters) => {
    const limitDate = filters.expiringInDays !== undefined ? new Date(Date.now() + filters.expiringInDays * 86_400_000) : undefined;

    return prisma.batch.findMany({
        where: {
            ...(filters.productId !== undefined ? { productId: filters.productId } : {}),
            ...(filters.status !== undefined ? { status: filters.status } : {}),
            ...(filters.onlyWithStock ? { quantity: { gt: 0 } } : {}),
            ...(limitDate ? { status: "ACTIVE" as const, quantity: { gt: 0 }, expirationDate: { lte: limitDate } } : {}),
        },
        include: batchInclude,
        orderBy: { expirationDate: "asc" },
    });
};

export const getBatchById = async (id: number) => {
    const batch = await prisma.batch.findUnique({
        where: { id },
        include: {
            ...batchInclude,
            movements: {
                orderBy: { createdAt: "desc" },
                take: 50,
                include: { user: { select: { id: true, name: true } } },
            },
        },
    });
    if (!batch) throw new AppError(`No se encontró el lote con ID: ${id}`, 404);
    return batch;
};

/**
 * La cantidad del lote NO se edita aquí (rompería el historial):
 * se cambia con movimientos en /api/stock-movements.
 */
export const updateBatch = async (id: number, dto: BatchUpdateDTO) => {
    const batch = await prisma.batch.findUnique({ where: { id } });
    if (!batch) throw new AppError(`No se encontró el lote con ID: ${id}`, 404);

    if (dto.status === "DEPLETED" && batch.quantity > 0) {
        throw new AppError("El lote aún tiene unidades: registra una salida (OUT) para agotarlo.", 409);
    }
    if (dto.status === "ACTIVE" && batch.quantity === 0) {
        throw new AppError("Un lote sin unidades no puede estar ACTIVE.", 409);
    }

    return prisma.batch.update({ where: { id }, data: stripUndefined(dto), include: batchInclude });
};
