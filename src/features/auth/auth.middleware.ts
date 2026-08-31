import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    role: string;
  };
}

export const verifyToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Acceso denegado. Token no proporcionado." });
    return;
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    res.status(401).json({ error: "Acceso denegado. Token no proporcionado." });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    req.user = {
      id: decoded.id as number,
      role: decoded.role as string,
    };
    next();
  } catch (error) {
    res.status(401).json({ error: "Token inválido o expirado." });
  }
};

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  console.log(
    "Verificando permisos de administrador para el usuario:",
    req.user,
  );
  if (!req.user || req.user.role !== "ADMIN") {
    res.status(403).json({
      error: "Acceso denegado. Se requieren permisos de administrador.",
    });
    return;
  }
  next();
};
