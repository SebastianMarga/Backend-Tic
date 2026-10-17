import type { Request, Response } from "express";
import { AppError } from "../../lib/errors/app-error.js";
import {
    asBody, optBool, optInt, optNullableInt, optString, parseId, qBool, qInt, qString, reqInt, reqString,
} from "../../lib/validation.js";
import type { ProductCreateDTO, ProductUpdateDTO } from "./product.dto.js";
import { createProduct, deleteProduct, getProductById, getProducts, updateProduct } from "./product.service.js";

export const getAll = async (req: Request, res: Response): Promise<void> => {
    const products = await getProducts({
        q: qString(req.query.q),
        categoryId: qInt(req.query.categoryId, "categoryId"),
        supplierId: qInt(req.query.supplierId, "supplierId"),
        lowStock: qBool(req.query.lowStock),
    });
    res.status(200).json(products);
};

export const getById = async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id, "ID de producto");
    res.status(200).json(await getProductById(id));
};

export const create = async (req: Request, res: Response): Promise<void> => {
    const body = asBody(req.body);
    const dto: ProductCreateDTO = {
        sku: reqString(body, "sku", "El SKU"),
        name: reqString(body, "name", "El nombre"),
        categoryId: reqInt(body, "categoryId", "La categoría", 1),
        supplierId: reqInt(body, "supplierId", "El proveedor", 1),
        currentStock: optInt(body, "currentStock", "El stock inicial", 0),
        dynamicThreshold: optInt(body, "dynamicThreshold", "El umbral", 0),
        optimalOrderQty: optInt(body, "optimalOrderQty", "La cantidad óptima de pedido", 1),
        leadTimeDays: optInt(body, "leadTimeDays", "El lead time", 0),
        isPerishable: optBool(body, "isPerishable", "isPerishable"),
        shelfLifeDays: optNullableInt(body, "shelfLifeDays", "La vida útil", 1),
    };
    if (dto.isPerishable && (dto.shelfLifeDays === undefined || dto.shelfLifeDays === null)) {
        throw new AppError("Un producto perecible requiere shelfLifeDays (vida útil en días).", 400);
    }
    res.status(201).json(await createProduct(dto));
};

export const update = async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id, "ID de producto");
    const body = asBody(req.body);
    if (body.currentStock !== undefined) {
        throw new AppError("currentStock no se edita directamente: usa POST /api/stock-movements.", 400);
    }
    const dto: ProductUpdateDTO = {
        sku: optString(body, "sku", "El SKU"),
        name: optString(body, "name", "El nombre"),
        categoryId: optInt(body, "categoryId", "La categoría", 1),
        supplierId: optInt(body, "supplierId", "El proveedor", 1),
        dynamicThreshold: optInt(body, "dynamicThreshold", "El umbral", 0),
        optimalOrderQty: optInt(body, "optimalOrderQty", "La cantidad óptima de pedido", 1),
        leadTimeDays: optInt(body, "leadTimeDays", "El lead time", 0),
        isPerishable: optBool(body, "isPerishable", "isPerishable"),
        shelfLifeDays: optNullableInt(body, "shelfLifeDays", "La vida útil", 1),
    };
    res.status(200).json(await updateProduct(id, dto));
};

export const remove = async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id, "ID de producto");
    await deleteProduct(id);
    res.status(204).send();
};
