import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import type { SaleIngestionRequest, SaleIngestionResponse } from '@retail-os/shared-types';

interface SaleSnapshot {
  saleId: string;
  storeId: string;
  deviceId: string;
  customerId?: string;
  status: string;
  currency: string;
  totalMinorUnits: number;
  taxMinorUnits: number;
  items: Array<{
    productId?: string;
    name: string;
    sku?: string;
    quantity: number;
    unitPriceMinorUnits: number;
    discountMinorUnits: number;
    taxRatePercent: number;
    lineTotalMinorUnits: number;
  }>;
  payments: Array<{
    id: string;
    provider: string;
    method: string;
    amountMinorUnits: number;
    status: string;
    providerRef?: string;
  }>;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ingest(req: SaleIngestionRequest, idempotencyKey: string): Promise<SaleIngestionResponse> {
    // Idempotency: if we've already processed this key, return the original result.
    const existing = await this.prisma.ingestionKey.findUnique({ where: { key: idempotencyKey } });
    if (existing) {
      this.logger.debug(`Duplicate ingest ignored — key ${idempotencyKey}`);
      return { accepted: true, saleId: existing.saleId, serverReceivedAt: existing.receivedAt.toISOString() };
    }

    const snapshot = req.sale as SaleSnapshot;
    const tenantId = 'tenant-demo'; // TODO: resolve from device auth token
    const saleId = snapshot.saleId ?? req.outboxId;
    const now = new Date();

    try {
      await this.prisma.$transaction(async (tx) => {
        // Ensure the store exists (create stub if unknown — will be resolved by onboarding flow).
        await tx.store.upsert({
          where: { id: snapshot.storeId },
          update: {},
          create: { id: snapshot.storeId, tenantId, name: snapshot.storeId },
        });

        // Write the sale.
        await tx.sale.upsert({
          where: { id: saleId },
          update: {},
          create: {
            id: saleId,
            tenantId,
            storeId: snapshot.storeId,
            deviceId: snapshot.deviceId ?? req.deviceId,
            customerId: snapshot.customerId,
            status: snapshot.status ?? 'completed',
            currency: snapshot.currency ?? 'MXN',
            totalMinorUnits: snapshot.totalMinorUnits ?? 0,
            taxMinorUnits: snapshot.taxMinorUnits ?? 0,
            snapshot: req.sale as object,
            committedAt: new Date(req.occurredAt),
            ingestedAt: now,
          },
        });

        // Write sale lines.
        if (Array.isArray(snapshot.items)) {
          for (const item of snapshot.items) {
            await tx.saleLine.create({
              data: {
                saleId,
                productId: item.productId ?? null,
                name: item.name,
                sku: item.sku ?? null,
                quantity: item.quantity,
                unitPriceMinor: item.unitPriceMinorUnits,
                discountMinor: item.discountMinorUnits ?? 0,
                taxRatePercent: item.taxRatePercent ?? 16,
                lineTotalMinor: item.lineTotalMinorUnits,
              },
            });
          }
        }

        // Write payments.
        if (Array.isArray(snapshot.payments)) {
          for (const payment of snapshot.payments) {
            await tx.payment.upsert({
              where: { id: payment.id },
              update: { status: payment.status, providerRef: payment.providerRef },
              create: {
                id: payment.id,
                saleId,
                tenantId,
                provider: payment.provider,
                method: payment.method,
                amountMinor: payment.amountMinorUnits,
                status: payment.status,
                providerRef: payment.providerRef,
              },
            });
          }
        }

        // Mark idempotency key.
        await tx.ingestionKey.create({ data: { key: idempotencyKey, tenantId, saleId, receivedAt: now } });
      });

      this.logger.log(`Sale ${saleId} ingested from device ${req.deviceId}`);
      return { accepted: true, saleId, serverReceivedAt: now.toISOString() };
    } catch (err) {
      this.logger.error(`Failed to ingest sale ${saleId}`, err);
      throw err;
    }
  }
}
