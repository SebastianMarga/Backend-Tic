export interface ProductCreateDTO {
    sku: string;
    name: string;
    categoryId: number;
    supplierId: number;
    currentStock?: number | undefined;
    dynamicThreshold?: number | undefined;
    optimalOrderQty?: number | undefined;
    leadTimeDays?: number | undefined;
    isPerishable?: boolean | undefined;
    shelfLifeDays?: number | null | undefined;
}

/**
 * currentStock NO se puede editar aquí a propósito: el stock solo cambia con
 * movimientos (/api/stock-movements), recepciones de órdenes o el sensor IoT.
 */
export interface ProductUpdateDTO {
    sku?: string | undefined;
    name?: string | undefined;
    categoryId?: number | undefined;
    supplierId?: number | undefined;
    dynamicThreshold?: number | undefined;
    optimalOrderQty?: number | undefined;
    leadTimeDays?: number | undefined;
    isPerishable?: boolean | undefined;
    shelfLifeDays?: number | null | undefined;
}

export interface ProductFilters {
    q?: string | undefined;
    categoryId?: number | undefined;
    supplierId?: number | undefined;
    lowStock?: boolean | undefined;
}
