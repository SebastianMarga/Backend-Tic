import { Router } from "express";
import { requireAdmin, verifyToken } from "../auth/auth.middleware.js";
import { create, getAll, remove, update } from "./user.controller.js";

const router = Router();

router.get(
    "/users",
    verifyToken,
    requireAdmin,
    getAll,
);

router.post(
    "/users",
    verifyToken,
    requireAdmin,
    create,
)

router.patch(
    "/users/:idUser",
    verifyToken,
    requireAdmin,
    update,
)

router.delete(
    "/users/:idUser",
    verifyToken,
    requireAdmin,
    remove,
)

export default router;