import { prisma } from '../../lib/prisma.js';

const RPA_SERVICE_URL = process.env.RPA_SERVICE_URL || 'http://localhost:8000';
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
                    hasStock: product.hasStock
                }
            })
        )
    );

    return savedTrends;
};