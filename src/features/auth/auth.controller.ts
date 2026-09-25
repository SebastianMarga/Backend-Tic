import type { Request, Response } from 'express';
import type { RegisterDTO, LoginDTO, ResponseDTO } from './auth.dto.js';
import * as authService from './auth.service.js';
import { AppError } from '../../lib/errors/app-error.js';

export const register = async (req: Request<{}, {}, RegisterDTO>, res: Response<any>): Promise<void> => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) throw new AppError('Nombre, Email y Password son obligatorios.', 400);

    const result = await authService.registerUser({ name, email, password });
    res.status(201).json({ message: 'Usuario registrado con éxito', data: result });
};

export const login = async (req: Request<{}, {}, LoginDTO>, res: Response): Promise<void> => {
    const { email, password } = req.body;

    if (!email || !password) throw new AppError('Email y Password son obligatorios.', 400);

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
};

export const refreshSession = async (req: Request, res: Response): Promise<void> => {
    try {
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

        if (!refreshToken) throw new AppError('No se proporcionó token de renovación.', 401);

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
        throw error;
    }
};

export const logout = (req: Request, res: Response): void => {
    res.clearCookie('token');
    res.clearCookie('refreshToken');
    res.status(200).json({ message: 'Sesión cerrada exitosamente' });
};