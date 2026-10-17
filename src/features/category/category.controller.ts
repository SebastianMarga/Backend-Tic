import type { Request, Response } from "express";
import { asBody, optString, parseId, reqString } from "../../lib/validation.js";
import { createCategory, deleteCategory, getCategories, getCategoryById, updateCategory } from "./category.service.js";

export const getAll = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json(await getCategories());
};

export const getById = async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id, "ID de categoría");
    res.status(200).json(await getCategoryById(id));
};

export const create = async (req: Request, res: Response): Promise<void> => {
    const body = asBody(req.body);
    res.status(201).json(await createCategory({ name: reqString(body, "name", "El nombre") }));
};

export const update = async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id, "ID de categoría");
    const body = asBody(req.body);
    res.status(200).json(await updateCategory(id, { name: optString(body, "name", "El nombre") }));
};

export const remove = async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id, "ID de categoría");
    await deleteCategory(id);
    res.status(204).send();
};
