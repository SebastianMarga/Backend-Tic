import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma/prisma.js';
import type { RegisterDTO, LoginDTO } from './auth.dto.js';
import { AppError } from '../../lib/errors/app-error.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'super_refresh_secret_key';

export const registerUser = async (data: RegisterDTO) => {
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) throw new AppError('El correo ya está registrado', 400);

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const newUser = await prisma.user.create({
        data: {
            name: data.name,
            email: data.email,
            password: hashedPassword,
        },
    });

    return { id: newUser.id, name: newUser.name, email: newUser.email };
};

export const loginUser = async (data: LoginDTO) => {
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user || !user.isActive) throw new AppError('Email incorrecto o usuario inactivo', 400);

    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) throw new AppError('Credenciales inválidas', 401);

    const accessToken = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    await prisma.user.update({
        where: { id: user.id },
        data: {
            refreshToken,
            lastLogin: new Date()
        },
    });

    return { user: { id: user.id, email: user.email, name: user.name, role: user.role }, accessToken, refreshToken };
};

export const refreshUserSession = async (currentRefreshToken: string) => {
    const decoded = jwt.verify(currentRefreshToken, JWT_REFRESH_SECRET) as jwt.JwtPayload;

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user || !user.isActive || user.refreshToken !== currentRefreshToken) throw new AppError('Sesión inválida o revocada.', 401);

    const newAccessToken = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '15m' });
    const newRefreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: newRefreshToken }
    });

    return { newAccessToken, newRefreshToken };
};