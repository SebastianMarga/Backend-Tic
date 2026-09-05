import { Router, type Response } from "express";
import { register, login, logout, refreshSession } from "./auth.controller.js";
import {
  verifyToken,
  requireAdmin,
  type AuthRequest,
} from "./auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post('/logout', logout);
router.post('/refresh', refreshSession);

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
