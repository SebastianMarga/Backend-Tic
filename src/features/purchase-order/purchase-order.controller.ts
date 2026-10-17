import type { Response } from "express";
import { OrderStatus, OrderType } from "@prisma/client";
import { AppError } from "../../lib/errors/app-error.js";
import {
    asBody, optInt, optString, optDate, parseId, qEnum, qInt, reqEnum, reqInt,
} from "../../lib/validation.js";
import type { AuthRequest } from "../auth/auth.middleware.js";
import type { ApproveRestockLineDTO, OrderItemInputDTO, ReceiveItemDTO } from "./purchase-order.dto.js";
import {
    addItem, approveRestock, changeOrderStatus, confirmOrder, createOrder, deleteOrder, getOrderById, getOrders, receiveOrder,
    removeItem, updateItem,
} from "./purchase-order.service.js";

const STATUSES = Object.values(OrderStatus);
const TYPES = Object.values(OrderType);

const parseItem = (raw: unknown): OrderItemInputDTO => {
    const body = asBody(raw);
    return {
        productId: reqInt(body, "productId", "El producto", 1),
        quantity: reqInt(body, "quantity", "La cantidad", 1),
    };
};

export const getAll = async (req: AuthRequest, res: Response): Promise<void> => {
    const orders = await getOrders({
        status: qEnum(req.query.status, STATUSES, "status"),
        type: qEnum(req.query.type, TYPES, "type"),
        supplierId: qInt(req.query.supplierId, "supplierId"),
    });
    res.status(200).json(orders);
};

export const getById = async (req: AuthRequest, res: Response): Promise<void> => {
    res.status(200).json(await getOrderById(parseId(req.params.id, "ID de orden")));
};

export const create = async (req: AuthRequest, res: Response): Promise<void> => {
    const body = asBody(req.body);
    if (!Array.isArray(body.items) || body.items.length === 0) {
        throw new AppError("items debe ser una lista con al menos un producto.", 400);
    }
    const order = await createOrder({
        supplierId: reqInt(body, "supplierId", "El proveedor", 1),
        items: body.items.map(parseItem),
    });
    res.status(201).json(order);
};

export const remove = async (req: AuthRequest, res: Response): Promise<void> => {
    await deleteOrder(parseId(req.params.id, "ID de orden"));
    res.status(204).send();
};

// ---- líneas

export const addOrderItem = async (req: AuthRequest, res: Response): Promise<void> => {
    const order = await addItem(parseId(req.params.id, "ID de orden"), parseItem(req.body));
    res.status(201).json(order);
};

export const updateOrderItem = async (req: AuthRequest, res: Response): Promise<void> => {
    const body = asBody(req.body);
    const order = await updateItem(
        parseId(req.params.id, "ID de orden"),
        parseId(req.params.itemId, "ID de línea"),
        reqInt(body, "quantity", "La cantidad", 1),
    );
    res.status(200).json(order);
};

export const removeOrderItem = async (req: AuthRequest, res: Response): Promise<void> => {
    const order = await removeItem(parseId(req.params.id, "ID de orden"), parseId(req.params.itemId, "ID de línea"));
    res.status(200).json(order);
};

// ---- ciclo de vida

export const confirm = async (req: AuthRequest, res: Response): Promise<void> => {
    res.status(200).json(await confirmOrder(parseId(req.params.id, "ID de orden")));
};

/** El admin aprueba una alerta de reestock: fija cantidad + cotización y dispara la compra del RPA. */
export const approveRestockOrder = async (req: AuthRequest, res: Response): Promise<void> => {
    const id = parseId(req.params.id, "ID de orden");
    const body = asBody(req.body);
    if (!Array.isArray(body.items) || body.items.length === 0) {
        throw new AppError("items debe ser una lista con al menos una línea.", 400);
    }
    const lines: ApproveRestockLineDTO[] = body.items.map((raw: unknown) => {
        const line = asBody(raw);
        return {
            itemId: reqInt(line, "itemId", "La línea", 1),
            quantity: reqInt(line, "quantity", "La cantidad", 1),
            selectedUrl: optString(line, "selectedUrl", "La cotización"),
        };
    });
    res.status(200).json(await approveRestock(id, lines));
};

export const changeStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    const body = asBody(req.body);
    const status = reqEnum(body, "status", STATUSES, "El estado");
    res.status(200).json(await changeOrderStatus(parseId(req.params.id, "ID de orden"), status));
};

export const receive = async (req: AuthRequest, res: Response): Promise<void> => {
    const id = parseId(req.params.id, "ID de orden");
    const body = req.body === undefined ? {} : asBody(req.body);

    let items: ReceiveItemDTO[] | undefined;
    if (body.items !== undefined) {
        if (!Array.isArray(body.items)) throw new AppError("items debe ser una lista.", 400);
        items = body.items.map((raw: unknown) => {
            const item = asBody(raw);
            return {
                productId: reqInt(item, "productId", "El producto", 1),
                quantityReceived: optInt(item, "quantityReceived", "La cantidad recibida", 0),
                batchNumber: optString(item, "batchNumber", "El número de lote"),
                expirationDate: optDate(item, "expirationDate", "La fecha de vencimiento"),
            };
        });
    }

    res.status(200).json(await receiveOrder(id, { items }, req.user?.id ?? null));
};
