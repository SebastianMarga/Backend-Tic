import type { BatchStatus } from "@prisma/client";

export interface BatchUpdateDTO {
    batchNumber?: string | undefined;
    expirationDate?: Date | undefined;
    status?: BatchStatus | undefined;
}

export interface BatchFilters {
    productId?: number | undefined;
    status?: BatchStatus | undefined;
    onlyWithStock?: boolean | undefined;
    /** Lotes ACTIVE que vencen dentro de N días (incluye los ya vencidos) */
    expiringInDays?: number | undefined;
}
