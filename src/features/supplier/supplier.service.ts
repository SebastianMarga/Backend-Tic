import { AppError } from "../../lib/errors/app-error.js";
import { prisma } from "../../lib/prisma/prisma.js";
import { stripUndefined } from "../../lib/validation.js";
import type { SupplierCreateDTO, SupplierUpdateDTO } from "./supplier.dto.js";

export const getSuppliers = async (search?: string) => {
    return prisma.supplier.findMany({
        where: search
            ? {
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { email: { contains: search, mode: "insensitive" } },
                ],
            }
            : {},
        include: { _count: { select: { products: true, orders: true } } },
        orderBy: { name: "asc" },
    });
};

export const getSupplierById = async (id: number) => {
    const supplier = await prisma.supplier.findUnique({
        where: { id },
        include: {
            products: {
                select: { id: true, sku: true, name: true, currentStock: true, dynamicThreshold: true },
                orderBy: { name: "asc" },
            },
            _count: { select: { orders: true } },
        },
    });
    if (!supplier) throw new AppError(`No se encontró al proveedor con ID: ${id}`, 404);
    return supplier;
};

export const createSupplier = async (dto: SupplierCreateDTO) => {
    return prisma.supplier.create({ data: stripUndefined(dto) });
};

export const updateSupplier = async (id: number, dto: SupplierUpdateDTO) => {
    const exists = await prisma.supplier.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new AppError(`No se encontró al proveedor con ID: ${id}`, 404);
    return prisma.supplier.update({ where: { id }, data: stripUndefined(dto) });
};

export const deleteSupplier = async (id: number) => {
    const supplier = await prisma.supplier.findUnique({
        where: { id },
        include: { _count: { select: { products: true, orders: true } } },
    });
    if (!supplier) throw new AppError(`No se encontró al proveedor con ID: ${id}`, 404);
    if (supplier._count.products > 0 || supplier._count.orders > 0) {
        throw new AppError(
            `No se puede eliminar: el proveedor tiene ${supplier._count.products} producto(s) y ${supplier._count.orders} orden(es) asociados.`,
            409,
        );
    }
    await prisma.supplier.delete({ where: { id } });
};
