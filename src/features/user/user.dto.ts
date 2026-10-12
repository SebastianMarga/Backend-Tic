import { UserRole } from "@prisma/client";

export interface UserCreateDTO {
    name: string;
    email: string;
    password: string;
    role: UserRole;
}

export interface UserUpdateDTO extends Partial<UserCreateDTO> { }