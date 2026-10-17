import { Router } from "express";
import { requireAdmin, verifyToken } from "../auth/auth.middleware.js";
import { create, getAll, getById, remove, update } from "./category.controller.js";

const router = Router();

// Lectura: cualquier usuario autenticado (el operador necesita ver categorías)
router.get("/", verifyToken, getAll);
router.get("/:id", verifyToken, getById);

// Escritura: solo ADMIN
router.post("/", verifyToken, requireAdmin, create);
router.patch("/:id", verifyToken, requireAdmin, update);
router.delete("/:id", verifyToken, requireAdmin, remove);

export default router;
