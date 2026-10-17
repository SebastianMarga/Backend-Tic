import { AppError } from "../../lib/errors/app-error.js";
import { prisma } from "../../lib/prisma/prisma.js";
import { stripUndefined } from "../../lib/validation.js";
import type { ProductCreateDTO, ProductFilters, ProductUpdateDTO } from "./product.dto.js";

const productInclude = {
    category: { select: { id: true, name: true } },
    supplier: { select: { id: true, name: true, email: true } },
} as const;

/** Agrega el flag que usa el dashboard para pintar la alerta de stock bajo. */
const withRestockFlag = <T extends { currentStock: number; dynamicThreshold: number }>(product: T) => ({
    ...product,
    needsRestock: product.currentStock <= product.dynamicThreshold,
});

const assertRelations = async (categoryId?: number, supplierId?: number) => {
    if (categoryId !== undefined) {
        const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
        if (!category) throw new AppError(`La categoría con ID: ${categoryId} no existe.`, 404);
    }
    if (supplierId !== undefined) {
        const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true } });
        if (!supplier) throw new AppError(`El proveedor con ID: ${supplierId} no existe.`, 404);
    }
};

const assertSkuAvailable = async (sku: string, ignoreId?: number) => {
    const duplicated = await prisma.product.findUnique({ where: { sku }, select: { id: true } });
    if (duplicated && duplicated.id !== ignoreId) throw new AppError(`Ya existe un producto con el SKU "${sku}".`, 409);
};

export const getProducts = async (filters: ProductFilters) => {
    const products = await prisma.product.findMany({
        where: {
            ...(filters.q
                ? {
                    OR: [
                        { name: { contains: filters.q, mode: "insensitive" as const } },
                        { sku: { contains: filters.q, mode: "insensitive" as const } },
                    ],
                }
                : {}),
            ...(filters.categoryId !== undefined ? { categoryId: filters.categoryId } : {}),
            ...(filters.supplierId !== undefined ? { supplierId: filters.supplierId } : {}),
        },
        include: productInclude,
        orderBy: { name: "asc" },
    });

    const result = products.map(withRestockFlag);
    // Prisma no compara dos columnas entre sí, así que se filtra aquí (catálogo pequeño).
    return filters.lowStock ? result.filter((p) => p.needsRestock) : result;
};

export const getProductById = async (id: number) => {
    const product = await prisma.product.findUnique({
        where: { id },
        include: {
            ...productInclude,
            batches: {
                where: { status: "ACTIVE" },
                orderBy: { expirationDate: "asc" },
            },
            _count: { select: { movements: true, orderItems: true } },
        },
    });
    if (!product) throw new AppError(`No se encontró el producto con ID: ${id}`, 404);
    return withRestockFlag(product);
};

export const createProduct = async (dto: ProductCreateDTO) => {
    await assertSkuAvailable(dto.sku);
    await assertRelations(dto.categoryId, dto.supplierId);
    const created = await prisma.product.create({
        data: stripUndefined(dto),
        include: productInclude,
    });
    return withRestockFlag(created);
};

export const updateProduct = async (id: number, dto: ProductUpdateDTO) => {
    const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) throw new AppError(`No se encontró el producto con ID: ${id}`, 404);

    if (dto.sku !== undefined) await assertSkuAvailable(dto.sku, id);
    await assertRelations(dto.categoryId, dto.supplierId);

    const updated = await prisma.product.update({
        where: { id },
        data: stripUndefined(dto),
        include: productInclude,
    });
    return withRestockFlag(updated);
};

export const deleteProduct = async (id: number) => {
    const product = await prisma.product.findUnique({
        where: { id },
        include: { _count: { select: { batches: true, movements: true, orderItems: true } }, originTrend: { select: { id: true } } },
    });
    if (!product) throw new AppError(`No se encontró el producto con ID: ${id}`, 404);

    const { batches, movements, orderItems } = product._count;
    if (batches > 0 || movements > 0 || orderItems > 0 || product.originTrend) {
        throw new AppError(
            `No se puede eliminar: el producto tiene historial (${batches} lote(s), ${movements} movimiento(s), ${orderItems} línea(s) de orden).`,
            409,
        );
    }
    await prisma.product.delete({ where: { id } });
};
