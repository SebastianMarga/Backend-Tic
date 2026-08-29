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
        res.status(200).json({ message: 'Login exitoso', data: result });
    } catch (error: any) {
        res.status(401).json({ error: error.message });
    }
};