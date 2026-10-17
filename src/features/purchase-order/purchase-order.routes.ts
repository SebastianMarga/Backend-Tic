import { Router } from "express";
import { requireAdmin, verifyToken } from "../auth/auth.middleware.js";
import { adminOrServiceKey } from "../auth/service-key.middleware.js";
import {
    addOrderItem, approveRestockOrder, changeStatus, confirm, create, getAll, getById, receive, remove, removeOrderItem, updateOrderItem,
} from "./purchase-order.controller.js";

const router = Router();

// CRUD de órdenes (solo ADMIN)
router.get("/", verifyToken, requireAdmin, getAll);
router.get("/:id", verifyToken, requireAdmin, getById);
router.post("/", verifyToken, requireAdmin, create);
router.delete("/:id", verifyToken, requireAdmin, remove);

// Líneas de la orden (solo mientras está en DRAFT)
router.post("/:id/items", verifyToken, requireAdmin, addOrderItem);
router.patch("/:id/items/:itemId", verifyToken, requireAdmin, updateOrderItem);
router.delete("/:id/items/:itemId", verifyToken, requireAdmin, removeOrderItem);

// Ciclo de vida
router.post("/:id/confirm", verifyToken, requireAdmin, confirm);           // botón "Comprar": DRAFT → PENDING_RPA
router.post("/:id/approve-restock", verifyToken, requireAdmin, approveRestockOrder); // el admin aprueba la alerta: DRAFT → PENDING_RPA + compra del RPA
router.patch("/:id/status", adminOrServiceKey, changeStatus);              // el RPA reporta PROCESSING / SENT / FAILED
router.post("/:id/receive", verifyToken, requireAdmin, receive);           // SENT → DELIVERED + stock + socket

export default router;
