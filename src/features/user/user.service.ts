import { AppError } from "../../lib/errors/app-error.js";
import { prisma } from "../../lib/prisma/prisma.js"

export const getUsers = async () => {
    const users = await prisma.user.findMany();
    if (users.length === 0) throw new AppError('No se encontraron usuarios.', 404);
    return users;
}