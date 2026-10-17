import { Router } from "express";
import { requireAdmin, verifyToken } from "../auth/auth.middleware.js";
import { getAll, getById, update } from "./batch.controller.js";

const router = Router();

// Los lotes nacen de una entrada (IN) o de la recepción de una orden:
// por eso no hay POST ni DELETE aquí (el lote siempre tiene movimientos asociados).
router.get("/", verifyToken, getAll);
router.get("/:id", verifyToken, getById);
router.patch("/:id", verifyToken, requireAdmin, update);

export default router;
