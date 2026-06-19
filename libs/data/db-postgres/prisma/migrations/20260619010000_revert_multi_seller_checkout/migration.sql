-- Revert multi-seller checkout: enforce MercadoPago's documented 1:1 split model
-- (one payment belongs to exactly one seller) instead of a Merchant-of-Record
-- fan-out. CheckoutSession had no real-world rows when this was reverted.
ALTER TABLE "MarketplaceOrder" DROP CONSTRAINT IF EXISTS "MarketplaceOrder_sessionId_fkey";
DROP INDEX IF EXISTS "MarketplaceOrder_sessionId_idx";
ALTER TABLE "MarketplaceOrder" DROP COLUMN IF EXISTS "sessionId";
DROP TABLE IF EXISTS "CheckoutSession";
