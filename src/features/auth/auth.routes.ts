import { Router, type Response } from "express";
import { register, login } from "./auth.controller.js";
import {
  verifyToken,
  requireAdmin,
  type AuthRequest,
} from "./auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);

// Ruta protegida de prueba
router.get(
  "/me",
  verifyToken,
  requireAdmin,
  (req: AuthRequest, res: Response) => {
    res.status(200).json({
      message: "Tienes acceso a esta ruta protegida",
      user: req.user,
    });
  },
);

export default router;
