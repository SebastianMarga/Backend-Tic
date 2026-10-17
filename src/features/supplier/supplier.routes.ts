import { Router } from "express";
import { requireAdmin, verifyToken } from "../auth/auth.middleware.js";
import { create, getAll, getById, remove, update } from "./supplier.controller.js";

const router = Router();

router.get("/", verifyToken, requireAdmin, getAll);
router.get("/:id", verifyToken, requireAdmin, getById);
router.post("/", verifyToken, requireAdmin, create);
router.patch("/:id", verifyToken, requireAdmin, update);
router.delete("/:id", verifyToken, requireAdmin, remove);

export default router;