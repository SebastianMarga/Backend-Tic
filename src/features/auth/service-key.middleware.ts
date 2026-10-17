import { createHash, timingSafeEqual } from 'crypto';
import type { Response, NextFunction } from 'express';
import { verifyToken, requireAdmin, type AuthRequest } from './auth.middleware.js';

const digest = (value: string) => createHash('sha256').update(value).digest();

const safeEqual = (a: string, b: string): boolean => timingSafeEqual(digest(a), digest(b));

/**
 * Deja pasar a:
 *  - un ADMIN con sesión (cookie), o
 *  - un servicio interno (el RPA) que envíe el header `x-api-key` igual a RPA_API_KEY.
 * Si RPA_API_KEY no está definida, solo funciona la vía de ADMIN.
 */
export const adminOrServiceKey = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const expected = process.env.RPA_API_KEY;
    const provided = req.header('x-api-key');

    if (expected && provided && safeEqual(provided, expected)) {
        next();
        return;
    }

    verifyToken(req, res, (err?: unknown) => {
        if (err) {
            next(err);
            return;
        }
        requireAdmin(req, res, next);
    });
};
