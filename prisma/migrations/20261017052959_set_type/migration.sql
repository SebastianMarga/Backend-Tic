-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "type" "OrderType" NOT NULL DEFAULT 'RESTOCK_ALERT';
