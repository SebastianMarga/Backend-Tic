import type { Request, Response } from "express";
import { BatchStatus } from "@prisma/client";
import { asBody, optDate, optEnum, optString, parseId, qBool, qEnum, qInt } from "../../lib/validation.js";
import { getBatchById, getBatches, updateBatch } from "./batch.service.js";

const BATCH_STATUSES = Object.values(BatchStatus);

export const getAll = async (req: Request, res: Response): Promise<void> => {
    const batches = await getBatches({
        productId: qInt(req.query.productId, "productId"),
        status: qEnum(req.query.status, BATCH_STATUSES, "status"),
        onlyWithStock: qBool(req.query.onlyWithStock),
        expiringInDays: qInt(req.query.expiringInDays, "expiringInDays", 0),
    });
    res.status(200).json(batches);
};

export const getById = async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id, "ID de lote");
    res.status(200).json(await getBatchById(id));
};

export const update = async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id, "ID de lote");
    const body = asBody(req.body);
    const batch = await updateBatch(id, {
        batchNumber: optString(body, "batchNumber", "El número de lote"),
        expirationDate: optDate(body, "expirationDate", "La fecha de vencimiento"),
        status: optEnum(body, "status", BATCH_STATUSES, "El estado"),
    });
    res.status(200).json(batch);
};
