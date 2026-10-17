import type { OrderStatus, OrderType } from "@prisma/client";

export interface OrderItemInputDTO {
    productId: number;
    quantity: number;
}

export interface OrderCreateDTO {
    supplierId: number;
    items: OrderItemInputDTO[];
}

export interface OrderFilters {
    status?: OrderStatus | undefined;
    type?: OrderType | undefined;
    supplierId?: number | undefined;
}

export interface ReceiveItemDTO {
    productId: number;
    /** Si no se envía, se asume la cantidad pedida. 0 = ese producto no llegó. */
    quantityReceived?: number | undefined;
    batchNumber?: string | undefined;
    expirationDate?: Date | undefined;
}

export interface ReceiveOrderDTO {
    /** Si se omite, se recibe todo tal como se pidió. */
    items?: ReceiveItemDTO[] | undefined;
}
