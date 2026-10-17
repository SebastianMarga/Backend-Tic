import type { Request, Response } from "express";
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "./supplier.service.js"; // Importamos las funciones del service que me compartiste

export const getAll = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const suppliers = await getSuppliers(search as string);
    res.status(200).json(suppliers);
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

    const supplier = await getSupplierById(id);
    res.status(200).json(supplier);
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const dto = req.body;
    const newSupplier = await createSupplier(dto);
    res.status(201).json(newSupplier);
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

    const dto = req.body;
    const updatedSupplier = await updateSupplier(id, dto);
    res.status(200).json(updatedSupplier);
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

    await deleteSupplier(id);
    res.status(204).send(); // 204 No Content indica éxito al eliminar
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
};