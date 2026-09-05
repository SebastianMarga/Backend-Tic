import type { Request, Response } from 'express';
import type { RegisterDTO, LoginDTO, ResponseDTO } from './auth.dto.js';
import * as authService from './auth.service.js';

export const register = async (req: Request<{}, {}, RegisterDTO>, res: Response<any>): Promise<void> => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            res.status(400).json({ error: 'Nombre, Email y Password son obligatorios.' });
            return;
        }

        const result = await authService.registerUser({ name, email, password });
        res.status(201).json({ message: 'Usuario registrado con éxito', data: result });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};

export const login = async (req: Request<{}, {}, LoginDTO>, res: Response<any>): Promise<void> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'Email y Password son obligatorios.' });
            return;
        }

        const result = await authService.loginUser({ email, password });

        res.cookie('token', result.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 900000
        });

        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.status(200).json({
            message: 'Login exitoso',
            user: {
                id: result.user.id,
                email: result.user.email,
                role: result.user.role,
                name: result.user.name
            }
        });
    } catch (error: any) {
        res.status(401).json({ error: error.message });
    }
};

export const refreshSession = async (req: Request, res: Response): Promise<void> => {
    try {
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

        if (!refreshToken) {
            res.status(401).json({ error: 'No se proporcionó token de renovación.' });
            return;
        }

        const result = await authService.refreshUserSession(refreshToken);

        res.cookie('token', result.newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 900000
        });

        res.cookie('refreshToken', result.newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.status(200).json({
            message: 'Sesión renovada con éxito',
            data: {
                accessToken: result.newAccessToken,
                refreshToken: result.newRefreshToken
            }
        });
    } catch (error: any) {
        res.clearCookie('token');
        res.clearCookie('refreshToken');
        res.status(401).json({ error: error.message || 'Token expirado o inválido.' });
    }
};

export const logout = (req: Request, res: Response<any>): void => {
    res.clearCookie('token');
    res.clearCookie('refreshToken');
    res.status(200).json({ message: 'Sesión cerrada exitosamente' });
};