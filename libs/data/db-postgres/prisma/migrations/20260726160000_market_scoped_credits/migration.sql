-- Cashback credits become market-scoped.
--
-- `CustomerWallet.platformCreditsMinor` was a single market-blind integer, so a
-- credit earned on an MXN purchase was redeemable against an ARS one. That makes
-- the platform absorb the FX spread and moves value across a tax border with no
-- corresponding transaction. Credits are a real liability, so they now carry the
-- market and currency they were earned in — the same reasoning that already
-- scopes StoreCredit to a single seller.

CREATE TABLE "market_credit" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "marketCode" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "balanceMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "market_credit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "market_credit_walletId_marketCode_key" ON "market_credit"("walletId", "marketCode");
CREATE INDEX "market_credit_walletId_idx" ON "market_credit"("walletId");

ALTER TABLE "market_credit" ADD CONSTRAINT "market_credit_walletId_fkey"
    FOREIGN KEY ("walletId") REFERENCES "CustomerWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A balance can never be negative: redeeming more than was earned would mint
-- platform liability out of nothing. Enforced in the database because service
-- code is not the only writer.
ALTER TABLE "market_credit" ADD CONSTRAINT "market_credit_balance_non_negative"
    CHECK ("balanceMinor" >= 0);

-- Ledger rows record which market and currency a movement happened in.
-- Nullable: rows written before credits were market-scoped genuinely do not
-- know, and backfilling a guess would fabricate an audit trail.
ALTER TABLE "WalletTransaction" ADD COLUMN "marketCode" TEXT;
ALTER TABLE "WalletTransaction" ADD COLUMN "currency" CHAR(3);

-- A seller trades in one market, so its store credit has one currency.
ALTER TABLE "StoreCredit" ADD COLUMN "currency" CHAR(3);

-- Backfill: every existing balance was earned while the platform served Mexico
-- only, so MX/MXN is the accurate attribution rather than an assumption.
INSERT INTO "market_credit" ("id", "walletId", "marketCode", "currency", "balanceMinor", "updatedAt")
SELECT
    'mc_' || "id",
    "id",
    'MX',
    'MXN',
    "platformCreditsMinor",
    CURRENT_TIMESTAMP
FROM "CustomerWallet"
WHERE "platformCreditsMinor" > 0;

UPDATE "WalletTransaction" SET "marketCode" = 'MX', "currency" = 'MXN';
UPDATE "StoreCredit" SET "currency" = 'MXN';
