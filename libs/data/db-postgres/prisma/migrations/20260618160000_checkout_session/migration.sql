-- Rename: this column always stored the MercadoPago preference id, not a real
-- session reference. Renamed to make room for the new CheckoutSession FK below.
ALTER TABLE "MarketplaceOrder" RENAME COLUMN "checkoutSessionId" TO "mpPreferenceId";

-- CreateTable
CREATE TABLE "CheckoutSession" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "customerEmail" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "subtotalMinorUnits" INTEGER NOT NULL,
    "totalMinorUnits" INTEGER NOT NULL,
    "amountDueMinorUnits" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "mpPreferenceId" TEXT,
    "paymentId" TEXT,
    "paymentProvider" TEXT,
    "deliveryAddress" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "MarketplaceOrder" ADD COLUMN "sessionId" TEXT;

-- CreateIndex
CREATE INDEX "MarketplaceOrder_sessionId_idx" ON "MarketplaceOrder"("sessionId");

-- AddForeignKey
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CheckoutSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
