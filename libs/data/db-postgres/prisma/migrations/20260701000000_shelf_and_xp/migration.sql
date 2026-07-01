-- CreateTable
CREATE TABLE "ShelfItem" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShelfItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerXp" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerXp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpEvent" (
    "id" TEXT NOT NULL,
    "customerXpId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShelfItem_customerId_productId_key" ON "ShelfItem"("customerId", "productId");

-- CreateIndex
CREATE INDEX "ShelfItem_customerId_status_idx" ON "ShelfItem"("customerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerXp_customerId_key" ON "CustomerXp"("customerId");

-- CreateIndex
CREATE INDEX "XpEvent_customerXpId_createdAt_idx" ON "XpEvent"("customerXpId", "createdAt");

-- AddForeignKey
ALTER TABLE "ShelfItem" ADD CONSTRAINT "ShelfItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "MktCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShelfItem" ADD CONSTRAINT "ShelfItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MktProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerXp" ADD CONSTRAINT "CustomerXp_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "MktCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpEvent" ADD CONSTRAINT "XpEvent_customerXpId_fkey" FOREIGN KEY ("customerXpId") REFERENCES "CustomerXp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
