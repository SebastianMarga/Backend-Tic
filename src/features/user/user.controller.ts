import type { Request, Response } from "express";
import { createUser, deleteUser, getUsers, updateUser } from "./user.service.js";
import type { UserCreateDTO, UserUpdateDTO } from "./user.dto.js";
import { AppError } from "../../lib/errors/app-error.js";

export const getAll = async (req: Request, res: Response): Promise<void> => {
    const users = await getUsers();
    res.status(200).json(users);
}

export const create = async (req: Request<{}, {}, UserCreateDTO>, res: Response): Promise<void> => {
    const userCreateDTO = req.body;
    if (!userCreateDTO.name || !userCreateDTO.email || !userCreateDTO.password || !userCreateDTO.role) throw new AppError('Nombre, Email, Password y Rol son obligatorios.', 400);
    const user = await createUser(userCreateDTO);
    res.status(201).json(user);
}

export const update = async (req: Request<{ idUser: string }, {}, UserUpdateDTO>, res: Response): Promise<void> => {
    const id = Number(req.params.idUser);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('ID de usuario inválido o inexistente.', 400);
    const userUpdateDTO = req.body;
    const user = await updateUser(userUpdateDTO, id);
    res.status(200).json(user);
}

export const remove = async (req: Request<{ idUser: string }>, res: Response): Promise<void> => {
    const id = Number(req.params.idUser);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('ID de usuario inválido o inexistente.', 400);
    await deleteUser(id);
    res.status(204).send();
}