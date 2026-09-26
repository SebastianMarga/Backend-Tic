import type { Request, Response } from 'express';
import * as trendsService from './trends.service.js';
import { AppError } from '../../lib/errors/app-error.js';

export const triggerRpaScraping = async (req: Request, res: Response): Promise<void> => {
    try {
        const { keyword } = req.body;

        if (!keyword) {
            res.status(400).json({ error: 'keyword requerida.' });
            return;
        }

        trendsService.startRpaTask(keyword);

        res.status(202).json({
            message: `Búsqueda de tendencias para '${keyword}' iniciada en segundo plano.`
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const receiveRpaResults = async (req: Request, res: Response): Promise<void> => {
    try {
        const { products } = req.body;

        if (!Array.isArray(products)) {
            res.status(400).json({ error: 'Falta la lista de productos.' });
            return;
        }

        const savedTrends = await trendsService.saveTrendResults(products);

        res.status(201).json({ message: 'Tendencias guardadas exitosamente', data: savedTrends });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getAll = async (req: Request, res: Response): Promise<void> => {
    const trendProducts = await trendsService.getTrendProducts();
    res.status(200).json(trendProducts);
}

export const approve = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!id) throw new AppError('El ID es requerido.', 400);
    const idTrend = Number(id)
    if (isNaN(idTrend)) throw new AppError('El ID debe ser un número válido.', 400);
    await trendsService.approveStatus(idTrend);
    res.status(204).send();
}

export const reject = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!id) throw new AppError('El ID es requerido.', 400);
    const idTrend = Number(id)
    if (isNaN(idTrend)) throw new AppError('El ID debe ser un número válido.', 400);
    await trendsService.rejectStatus(idTrend);
    res.status(204).send();
}