import type { MovementReason, MovementType } from "@prisma/client";

export interface MovementCreateDTO {
    productId: number;
    type: MovementType;
    /** IN / OUT: entero > 0. ADJUSTMENT: delta con signo (+/-), distinto de 0. */
    quantity: number;
    reason?: MovementReason | undefined;
    description?: string | undefined;
    /** IN: lote existente al que sumar. OUT: lote específico (si no, se aplica FEFO). ADJUSTMENT: obligatorio. */
    batchId?: number | undefined;
    /** IN con lote nuevo */
    batchNumber?: string | undefined;
    expirationDate?: Date | undefined;
}

export interface MovementFilters {
    productId?: number | undefined;
    batchId?: number | undefined;
    type?: MovementType | undefined;
    reason?: MovementReason | undefined;
    from?: Date | undefined;
    to?: Date | undefined;
    limit: number;
}
