import { AppError } from "../../lib/errors/app-error.js";
import { prisma } from "../../lib/prisma/prisma.js";
import type { CategoryCreateDTO, CategoryUpdateDTO } from "./category.dto.js";

const assertNameAvailable = async (name: string, ignoreId?: number) => {
    const duplicated = await prisma.category.findFirst({
        where: {
            name: { equals: name, mode: "insensitive" },
            ...(ignoreId !== undefined ? { NOT: { id: ignoreId } } : {}),
        },
        select: { id: true },
    });
    if (duplicated) throw new AppError(`Ya existe una categoría llamada "${name}".`, 409);
};

export const getCategories = async () => {
    return prisma.category.findMany({
        include: { _count: { select: { products: true } } },
        orderBy: { name: "asc" },
    });
};

export const getCategoryById = async (id: number) => {
    const category = await prisma.category.findUnique({
        where: { id },
        include: {
            products: { select: { id: true, sku: true, name: true, currentStock: true }, orderBy: { name: "asc" } },
        },
    });
    if (!category) throw new AppError(`No se encontró la categoría con ID: ${id}`, 404);
    return category;
};

export const createCategory = async (dto: CategoryCreateDTO) => {
    await assertNameAvailable(dto.name);
    return prisma.category.create({ data: { name: dto.name } });
};

export const updateCategory = async (id: number, dto: CategoryUpdateDTO) => {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) throw new AppError(`No se encontró la categoría con ID: ${id}`, 404);
    if (dto.name === undefined) return category;
    await assertNameAvailable(dto.name, id);
    return prisma.category.update({ where: { id }, data: { name: dto.name } });
};

export const deleteCategory = async (id: number) => {
    const category = await prisma.category.findUnique({
        where: { id },
        include: { _count: { select: { products: true, trendingProducts: true } } },
    });
    if (!category) throw new AppError(`No se encontró la categoría con ID: ${id}`, 404);
    if (category._count.products > 0 || category._count.trendingProducts > 0) {
        throw new AppError(
            `No se puede eliminar: la categoría tiene ${category._count.products} producto(s) y ${category._count.trendingProducts} tendencia(s) asociados.`,
            409,
        );
    }
    await prisma.category.delete({ where: { id } });
};
