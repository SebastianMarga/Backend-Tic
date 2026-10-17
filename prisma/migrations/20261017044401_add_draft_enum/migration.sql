/*
  Warnings:

  - A unique constraint covering the columns `[purchaseOrderId,productId]` on the table `OrderItem` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'DRAFT';

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_purchaseOrderId_productId_key" ON "OrderItem"("purchaseOrderId", "productId");
