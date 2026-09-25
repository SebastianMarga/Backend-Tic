import { Router } from "express";
import { requireAdmin, verifyToken } from "../auth/auth.middleware.js";
import { getAll } from "./user.controller.js";

const router = Router();

router.get(
    "/users",
    verifyToken,
    requireAdmin,
    getAll,
);

export default router;