import { AppError } from '../../lib/errors/app-error.js';
import { prisma } from '../../lib/prisma/prisma.js';

const RPA_SERVICE_URL = process.env.RPA_SERVICE_URL;
if (!RPA_SERVICE_URL) throw new Error('No se encuentra URL del RPA.')

export const startRpaTask = async (keyword: string): Promise<void> => {
    fetch(`${RPA_SERVICE_URL}buscar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producto: keyword })
    }).catch(err => console.error('Error contactando al contenedor RPA:', err.message));
};

export const saveTrendResults = async (products: any[]) => {
    const savedTrends = await Promise.all(
        products.map(product =>
            prisma.trendingProduct.create({
                data: {
                    suggestedName: product.suggestedName,
                    notes: product.notes,
                    urlProduct: product.urlProduct,
                    urlImage: product.urlImage,
                    suggestedPrice: product.suggestedPrice,
                    hasStock: product.hasStock,
                    source: product.source
                }
            })
        )
    );

    return savedTrends;
};

export const getTrendProducts = async () => {
    return prisma.trendingProduct.findMany();
};

export const approveStatus = async (ids: number[]) => {
    const listProducts = await prisma.$transaction(async tx => {
        return Promise.all(
            ids.map(async id => {
                const row = await tx.trendingProduct.findUnique({
                    where: { id }
                })
                if (!row) throw new AppError(`El producto sugerido con ID: ${id} no se encuentra registrado.`, 404);
                await tx.trendingProduct.update({
                    where: { id },
                    data: {
                        status: 'APPROVED',
                    }
                })
                return row.urlProduct;
            })
        )
    })

    const rpaResponse = await fetch(`${RPA_SERVICE_URL}comprar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productos: listProducts }),
    });
    console.log(rpaResponse)
}

export const rejectStatus = async (ids: number[]) => {
    await prisma.$transaction(async tx => {
        await Promise.all(
            ids.map(async id => {
                const row = await tx.trendingProduct.findUnique({
                    where: { id }
                })
                if (!row) throw new AppError(`El producto sugerido con ID: ${id} no se encuentra registrado.`, 404);
                await tx.trendingProduct.update({
                    where: { id },
                    data: {
                        status: 'REJECTED',
                    }
                })
            })
        )
    })
    console.log("productos rechazados correctamente")
}