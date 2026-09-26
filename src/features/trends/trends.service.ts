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
    const trendProducts = await prisma.trendingProduct.findMany();
    if (trendProducts.length === 0) throw new AppError('No se encontraron usuarios.', 404);
    return trendProducts;
}

export const approveStatus = async (id: number) => {
    const row = await prisma.trendingProduct.findUnique({
        where: { id }
    })
    if (!row) throw new AppError('El producto sugerido no se encuentra registrado.', 404);
    await prisma.trendingProduct.update({
        where: { id },
        data: {
            status: 'APPROVED',
        }
    })
}

export const rejectStatus = async (id: number) => {
    const row = await prisma.trendingProduct.findUnique({
        where: { id }
    })
    if (!row) throw new AppError('El producto sugerido no se encuentra registrado.', 404);
    await prisma.trendingProduct.update({
        where: { id },
        data: {
            status: 'REJECTED',
        }
    })
}