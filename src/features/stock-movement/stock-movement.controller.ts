import type { Response } from "express";
import { MovementReason, MovementType } from "@prisma/client";
import { AppError } from "../../lib/errors/app-error.js";
import {
    asBody, optDate, optEnum, optInt, optString, parseId, qDate, qEnum, qInt, reqEnum, reqInt,
} from "../../lib/validation.js";
import type { AuthRequest } from "../auth/auth.middleware.js";
import type { MovementCreateDTO } from "./stock-movement.dto.js";
import { getMovementById, getMovements, registerMovement } from "./stock-movement.service.js";

const TYPES = Object.values(MovementType);
const REASONS = Object.values(MovementReason);
const MAX_LIMIT = 500;

export const getAll = async (req: AuthRequest, res: Response): Promise<void> => {
    const limit = Math.min(qInt(req.query.limit, "limit") ?? 100, MAX_LIMIT);
    const movements = await getMovements({
        productId: qInt(req.query.productId, "productId"),
        batchId: qInt(req.query.batchId, "batchId"),
        type: qEnum(req.query.type, TYPES, "type"),
        reason: qEnum(req.query.reason, REASONS, "reason"),
        from: qDate(req.query.from, "from"),
        to: qDate(req.query.to, "to"),
        limit,
    });
    res.status(200).json(movements);
};

export const getById = async (req: AuthRequest, res: Response): Promise<void> => {
    const id = parseId(req.params.id, "ID de movimiento");
    res.status(200).json(await getMovementById(id));
};

export const create = async (req: AuthRequest, res: Response): Promise<void> => {
    const body = asBody(req.body);
    const dto: MovementCreateDTO = {
        productId: reqInt(body, "productId", "El producto", 1),
        type: reqEnum(body, "type", TYPES, "El tipo"),
        quantity: reqInt(body, "quantity", "La cantidad"),
        reason: optEnum(body, "reason", REASONS, "El motivo"),
        description: optString(body, "description", "La descripción"),
        batchId: optInt(body, "batchId", "El lote", 1),
        batchNumber: optString(body, "batchNumber", "El número de lote"),
        expirationDate: optDate(body, "expirationDate", "La fecha de vencimiento"),
    };

    if (dto.type === "ADJUSTMENT" ? dto.quantity === 0 : dto.quantity <= 0) {
        throw new AppError(
            dto.type === "ADJUSTMENT"
                ? "En un ajuste la cantidad es un delta (+/-) distinto de 0."
                : "La cantidad debe ser un entero mayor a 0.",
            400,
        );
    }

    // Se guarda quién lo hizo: el historial alimenta el dashboard y entrena a la IA
    const movements = await registerMovement(dto, req.user?.id ?? null);
    res.status(201).json(movements);
};
