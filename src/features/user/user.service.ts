import bcrypt from 'bcrypt';
import { AppError } from "../../lib/errors/app-error.js";
import { prisma } from "../../lib/prisma/prisma.js"
import type { UserCreateDTO, UserUpdateDTO } from "./user.dto.js";

export const getUsers = async () => {
    const users = await prisma.user.findMany();
    if (users.length === 0) throw new AppError('No se encontraron usuarios.', 404);
    return users;
}

export const createUser = async (userCreateDTO: UserCreateDTO) => {
    const hashedPassword = await bcrypt.hash(userCreateDTO.password, 10);
    const newUser = await prisma.user.create({
        data: {
            name: userCreateDTO.name,
            email: userCreateDTO.email,
            password: hashedPassword,
            role: userCreateDTO.role
        }
    });
    return newUser;
}

export const updateUser = async (userUpdateDTO: UserUpdateDTO, idUser: number) => {
    const user = await prisma.user.findUnique({
        where: { id: idUser }
    })
    if (!user) throw new AppError(`No se encontró al usuario con ID: ${idUser}`, 404);
    let hashedPassword;
    if (userUpdateDTO.password) {
        hashedPassword = await bcrypt.hash(userUpdateDTO.password, 10);
    }
    const userUpdate = await prisma.user.update({
        where: { id: idUser },
        data: {
            name: userUpdateDTO.name ?? user.name,
            email: userUpdateDTO.email ?? user.email,
            password: hashedPassword ?? user.password,
            role: userUpdateDTO.role ?? user.role,
        }
    })
    return userUpdate;
}

export const deleteUser = async (idUser: number) => {
    const user = await prisma.user.findUnique({
        where: { id: idUser }
    })
    if (!user) throw new AppError(`No se encontró al usuario con ID: ${idUser}`, 404);
    await prisma.user.delete({
        where: { id: idUser }
    })
}