import { AppError } from './errors/app-error.js';

export type Body = Record<string, unknown>;

// ---------- Body ----------

export const asBody = (value: unknown): Body => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new AppError('El cuerpo de la petición debe ser un objeto JSON.', 400);
    }
    return value as Body;
};

export const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// ---------- IDs ----------

export const parseId = (value: unknown, label = 'ID'): number => {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) throw new AppError(`${label} inválido o inexistente.`, 400);
    return id;
};

// ---------- Strings ----------

export const reqString = (body: Body, key: string, label: string): string => {
    const v = body[key];
    if (typeof v !== 'string' || v.trim() === '') throw new AppError(`${label} es obligatorio.`, 400);
    return v.trim();
};

export const optString = (body: Body, key: string, label: string): string | undefined => {
    const v = body[key];
    if (v === undefined) return undefined;
    if (typeof v !== 'string' || v.trim() === '') throw new AppError(`${label} debe ser un texto no vacío.`, 400);
    return v.trim();
};

/** undefined = no viene, null = limpiar el valor, string = nuevo valor */
export const optNullableString = (body: Body, key: string, label: string): string | null | undefined => {
    const v = body[key];
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (typeof v !== 'string') throw new AppError(`${label} debe ser texto.`, 400);
    const trimmed = v.trim();
    return trimmed === '' ? null : trimmed;
};

// ---------- Números ----------

const toInt = (v: unknown, label: string, min?: number): number => {
    if (typeof v !== 'number' || !Number.isInteger(v)) throw new AppError(`${label} debe ser un número entero.`, 400);
    if (min !== undefined && v < min) throw new AppError(`${label} debe ser mayor o igual a ${min}.`, 400);
    return v;
};

export const reqInt = (body: Body, key: string, label: string, min?: number): number => {
    if (body[key] === undefined || body[key] === null) throw new AppError(`${label} es obligatorio.`, 400);
    return toInt(body[key], label, min);
};

export const optInt = (body: Body, key: string, label: string, min?: number): number | undefined => {
    if (body[key] === undefined) return undefined;
    return toInt(body[key], label, min);
};

export const optNullableInt = (body: Body, key: string, label: string, min?: number): number | null | undefined => {
    if (body[key] === undefined) return undefined;
    if (body[key] === null) return null;
    return toInt(body[key], label, min);
};

// ---------- Booleanos, fechas, enums ----------

export const optBool = (body: Body, key: string, label: string): boolean | undefined => {
    const v = body[key];
    if (v === undefined) return undefined;
    if (typeof v !== 'boolean') throw new AppError(`${label} debe ser true o false.`, 400);
    return v;
};

export const toDate = (v: unknown, label: string): Date => {
    if (typeof v !== 'string' && typeof v !== 'number') throw new AppError(`${label} debe ser una fecha válida.`, 400);
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw new AppError(`${label} debe ser una fecha válida.`, 400);
    return d;
};

export const reqDate = (body: Body, key: string, label: string): Date => {
    if (body[key] === undefined || body[key] === null) throw new AppError(`${label} es obligatorio.`, 400);
    return toDate(body[key], label);
};

export const optDate = (body: Body, key: string, label: string): Date | undefined => {
    if (body[key] === undefined) return undefined;
    return toDate(body[key], label);
};

export const toEnum = <T extends string>(v: unknown, allowed: readonly T[], label: string): T => {
    if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
        throw new AppError(`${label} inválido. Valores permitidos: ${allowed.join(', ')}.`, 400);
    }
    return v as T;
};

export const reqEnum = <T extends string>(body: Body, key: string, allowed: readonly T[], label: string): T => {
    if (body[key] === undefined || body[key] === null) throw new AppError(`${label} es obligatorio.`, 400);
    return toEnum(body[key], allowed, label);
};

export const optEnum = <T extends string>(body: Body, key: string, allowed: readonly T[], label: string): T | undefined => {
    if (body[key] === undefined) return undefined;
    return toEnum(body[key], allowed, label);
};

// ---------- Query string (todo llega como texto) ----------

export const qString = (v: unknown): string | undefined => {
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

export const qInt = (v: unknown, label: string, min = 1): number | undefined => {
    const s = qString(v);
    if (s === undefined) return undefined;
    const n = Number(s);
    if (!Number.isInteger(n) || n < min) throw new AppError(`${label} debe ser un entero mayor o igual a ${min}.`, 400);
    return n;
};

export const qBool = (v: unknown): boolean => {
    const s = qString(v);
    return s === 'true' || s === '1';
};

export const qEnum = <T extends string>(v: unknown, allowed: readonly T[], label: string): T | undefined => {
    const s = qString(v);
    return s === undefined ? undefined : toEnum(s, allowed, label);
};

export const qDate = (v: unknown, label: string): Date | undefined => {
    const s = qString(v);
    return s === undefined ? undefined : toDate(s, label);
};

// ---------- Utilidad para Prisma + exactOptionalPropertyTypes ----------

/** Quita las claves con valor undefined para poder pasar el objeto a Prisma. */
export const stripUndefined = <T extends object>(obj: T): { [K in keyof T]: Exclude<T[K], undefined> } => {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as {
        [K in keyof T]: Exclude<T[K], undefined>;
    };
};
