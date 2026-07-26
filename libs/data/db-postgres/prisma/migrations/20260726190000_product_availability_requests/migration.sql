-- Availability requests: "tell me when this is buyable in my market".
--
-- The availability notice on catalogue-only product pages promises to tell the
-- shopper when a local offer appears. Until now there was nowhere to write that
-- request down, which made the promise impossible to keep rather than merely
-- unfulfilled.

CREATE TABLE "product_availability_request" (
    "id"         TEXT NOT NULL,
    "productId"  TEXT NOT NULL,
    "email"      TEXT NOT NULL,
    "marketCode" CHAR(2) NOT NULL,
    "locale"     VARCHAR(5) NOT NULL DEFAULT 'es',
    "customerId" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_availability_request_pkey" PRIMARY KEY ("id")
);

-- Asking twice is not two requests. Without this, a shopper who resubmits gets
-- mailed twice for one product.
CREATE UNIQUE INDEX "product_availability_request_productId_email_marketCode_key"
    ON "product_availability_request" ("productId", "email", "marketCode");

-- Demand signal for seller acquisition: how many shoppers in a market want a
-- product nobody there sells yet.
CREATE INDEX "product_availability_request_marketCode_productId_idx"
    ON "product_availability_request" ("marketCode", "productId");

-- Finding who still needs telling.
CREATE INDEX "product_availability_request_marketCode_notifiedAt_idx"
    ON "product_availability_request" ("marketCode", "notifiedAt");

ALTER TABLE "product_availability_request"
    ADD CONSTRAINT "product_availability_request_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "MktProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SetNull, not Cascade: if an account is deleted the request itself is still a
-- real demand signal, and the email column stands on its own.
ALTER TABLE "product_availability_request"
    ADD CONSTRAINT "product_availability_request_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "MktCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
