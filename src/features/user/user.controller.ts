import type { Request, Response } from "express";
import { getUsers } from "./user.service.js";

export const getAll = async (req: Request, res: Response): Promise<void> => {
    const users = await getUsers();
    res.status(200).json(users);
}