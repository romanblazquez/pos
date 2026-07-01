import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import type { ProductFilters, UpsertProductDto } from './catalog.dto.js';
import { DEFAULT_CURRENCY_CODE } from '../markets/default-market.constants.js';

@Injectable()
export class CatalogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listProducts(tenantId: string, filters: ProductFilters = {}) {
    return this.prisma.product.findMany({
      where: {
        tenantId,
        ...(filters.active !== undefined && { active: filters.active }),
        ...(filters.category && { category: filters.category }),
        ...(filters.sourceType && { sourceType: filters.sourceType }),
        ...(filters.search && {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { sku: { contains: filters.search, mode: 'insensitive' } },
            { barcode: { contains: filters.search } },
          ],
        }),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async getProduct(tenantId: string, id: string) {
    return this.prisma.product.findFirst({ where: { id, tenantId } });
  }

  async createProduct(tenantId: string, dto: UpsertProductDto) {
    return this.prisma.product.create({
      data: { tenantId, ...dto, currency: dto.currency ?? DEFAULT_CURRENCY_CODE, taxRatePercent: dto.taxRatePercent ?? 16 },
    });
  }

  async updateProduct(_tenantId: string, id: string, dto: Partial<UpsertProductDto>) {
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async deactivateProduct(_tenantId: string, id: string) {
    return this.prisma.product.update({ where: { id }, data: { active: false } });
  }

  /**
   * Bulk upsert from any external source (Tiendanube, Shopify, CSV, etc.).
   * Matches on tenantId + sku. Products become first-class Retail OS catalog
   * entries with optional sourceType/sourceId provenance — the caller can later
   * clear sourceType to "own" the product natively.
   */
  async importProducts(tenantId: string, products: UpsertProductDto[]): Promise<{ upserted: number }> {
    let upserted = 0;
    for (const p of products) {
      await this.prisma.product.upsert({
        where: { tenantId_sku: { tenantId, sku: p.sku } },
        update: {
          name: p.name,
          barcode: p.barcode,
          category: p.category,
          photoUrl: p.photoUrl,
          priceMinorUnits: p.priceMinorUnits,
          taxRatePercent: p.taxRatePercent ?? 16,
          trackInventory: p.trackInventory ?? true,
          active: p.active ?? true,
          sourceType: p.sourceType,
          sourceId: p.sourceId,
        },
        create: {
          tenantId,
          sku: p.sku,
          name: p.name,
          barcode: p.barcode,
          category: p.category,
          photoUrl: p.photoUrl,
          priceMinorUnits: p.priceMinorUnits,
          currency: p.currency ?? DEFAULT_CURRENCY_CODE,
          taxRatePercent: p.taxRatePercent ?? 16,
          trackInventory: p.trackInventory ?? true,
          active: p.active ?? true,
          sourceType: p.sourceType,
          sourceId: p.sourceId,
        },
      });
      upserted++;
    }
    return { upserted };
  }

  /**
   * Detach products from their source system — they become native Retail OS products.
   * Call this when the merchant decides to stop syncing from Tiendanube and manage
   * the catalog here instead.
   */
  async detachFromSource(tenantId: string, sourceType: string): Promise<{ detached: number }> {
    const result = await this.prisma.product.updateMany({
      where: { tenantId, sourceType },
      data: { sourceType: null, sourceId: null },
    });
    return { detached: result.count };
  }

  async getCategories(tenantId: string): Promise<string[]> {
    const rows = await this.prisma.product.findMany({
      where: { tenantId, active: true },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => r.category);
  }
}
