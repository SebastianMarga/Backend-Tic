import { Router } from "express";
import { verifyToken } from "../auth/auth.middleware.js";
import { create, getAll, getById } from "./stock-movement.controller.js";

const router = Router();

// El operador registra entradas/salidas (según el schema), así que no exige ADMIN.
// El historial es un libro contable: no hay PATCH ni DELETE (se corrige con un ADJUSTMENT).
router.get("/", verifyToken, getAll);
router.get("/:id", verifyToken, getById);
router.post("/", verifyToken, create);

export default router;
