import { describe, expect, it, vi } from 'vitest';
import { SellersService } from './sellers.service.js';

function baseOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'order1',
    sellerId: 'seller1',
    status: 'confirmed',
    customerId: 'cust1',
    paymentProvider: 'mercadopago',
    platformCreditsApplied: 0,
    storeCreditsApplied: 0,
    ...overrides,
  };
}

function setup() {
  const prisma = {
    marketplaceOrder: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'order1', status: 'refunded', events: [] }),
      update: vi.fn().mockImplementation(({ data }) => ({ ...data })),
    },
    mktProduct: { findUnique: vi.fn().mockResolvedValue({ id: 'prod1', name: 'Catan' }) },
    listing: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) => ({ id: 'listing1', ...data })),
      findMany: vi.fn().mockResolvedValue([{ productId: 'prodA' }, { productId: 'prodB' }]),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    sellerMarket: { findFirst: vi.fn().mockResolvedValue({ settlementCurrencyCode: 'ARS' }) },
    marketplaceOrderLine: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const indexer = { syncProductQuietly: vi.fn().mockResolvedValue(undefined) };
  const loyalty = { refundCredits: vi.fn().mockResolvedValue(undefined) };
  const checkout = {
    refundOrder: vi.fn().mockResolvedValue({ status: 'refunded', refundId: '99', amountMinor: 5000 }),
  };
  const rankings = { enqueueReindex: vi.fn().mockResolvedValue(undefined) };
  const service = new SellersService(
    prisma as never, indexer as never, loyalty as never, checkout as never, rankings as never,
  );
  return { service, prisma, loyalty, checkout, indexer, rankings };
}

describe('SellersService.createListing', () => {
  it('creates a listing against an existing product and reindexes it', async () => {
    const { service, prisma, indexer } = setup();

    const listing = await service.createListing('seller1', { productSlug: 'catan', priceMinorUnits: 150000, stock: 10 });

    expect(prisma.listing.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        sellerId: 'seller1', productId: 'prod1', priceMinorUnits: 150000,
        stock: 10, stockStatus: 'in_stock', condition: 'new', active: true,
      }),
    }));
    // Without the reindex the offer never reaches a product card.
    expect(indexer.syncProductQuietly).toHaveBeenCalledWith('prod1');
    expect(listing).toMatchObject({ id: 'listing1' });
  });

  it('defaults the currency to the seller\'s configured market, not the schema default', async () => {
    const { service, prisma } = setup();

    await service.createListing('seller1', { productSlug: 'catan', priceMinorUnits: 1000 });

    expect(prisma.listing.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ currency: 'ARS' }),
    }));
  });

  it('refuses when the seller has no market and supplied no currency', async () => {
    const { service, prisma } = setup();
    prisma.sellerMarket.findFirst.mockResolvedValue(null);

    await expect(service.createListing('seller1', { productSlug: 'catan', priceMinorUnits: 1000 }))
      .rejects.toThrow(/price without a currency is not sellable/);
    expect(prisma.listing.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown catalogue product rather than inventing one', async () => {
    const { service, prisma } = setup();
    prisma.mktProduct.findUnique.mockResolvedValue(null);

    await expect(service.createListing('seller1', { productSlug: 'nope', priceMinorUnits: 1000 }))
      .rejects.toThrow(/No catalogue product with slug "nope"/);
  });

  it('refuses a second listing for a product the seller already lists', async () => {
    const { service, prisma } = setup();
    prisma.listing.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(service.createListing('seller1', { productSlug: 'catan', priceMinorUnits: 1000 }))
      .rejects.toThrow(/already have a listing for "Catan"/);
    expect(prisma.listing.create).not.toHaveBeenCalled();
  });

  it('marks a zero-stock listing out_of_stock on creation', async () => {
    const { service, prisma } = setup();

    await service.createListing('seller1', { productSlug: 'catan', priceMinorUnits: 1000, stock: 0 });

    expect(prisma.listing.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ stock: 0, stockStatus: 'out_of_stock' }),
    }));
  });
});

describe('SellersService.exportOrdersCsv', () => {
  function orderWith(lines: unknown[], over: Record<string, unknown> = {}) {
    return {
      id: 'o1', createdAt: new Date('2026-08-01T10:00:00Z'), status: 'confirmed',
      currency: 'MXN', totalMinorUnits: 150000, commissionMinorUnits: 4500,
      paidOutAt: null, lines, ...over,
    };
  }
  const line = (name: string) => ({
    quantity: 2, unitPriceMinor: 49900, lineTotalMinor: 99800,
    listing: { product: { name, slug: 'catan' } },
  });

  it('emits one row per order line, in major units with the currency alongside', async () => {
    const { service, prisma } = setup();
    prisma.marketplaceOrder.findMany = vi.fn().mockResolvedValue([
      orderWith([line('Catan'), line('Carcassonne')]),
    ]);

    const csv = await service.exportOrdersCsv('seller1');
    const rows = csv.trim().split('\r\n');

    expect(rows).toHaveLength(3); // header + 2 lines
    expect(rows[0]).toContain('order_id,created_at,status,currency');
    // 49900 centavos must read as 499.00. A spreadsheet has no concept of
    // minor units and would sum raw centavos 100x too large.
    expect(rows[1]).toContain('"499.00"');
    expect(rows[1]).toContain('"1500.00"');
    expect(rows[1]).toContain('"MXN"');
    // seller_net = order total - commission
    expect(rows[1]).toContain('"1455.00"');
  });

  it('neutralises spreadsheet formula injection in product names', async () => {
    const { service, prisma } = setup();
    prisma.marketplaceOrder.findMany = vi.fn().mockResolvedValue([
      orderWith([line('=HYPERLINK("http://evil","click")')]),
    ]);

    const csv = await service.exportOrdersCsv('seller1');

    // Excel executes a leading '=' on open; the cell must stay text.
    expect(csv).toContain("\"'=HYPERLINK");
    expect(csv).not.toMatch(/,"=HYPERLINK/);
  });

  it('escapes embedded quotes and leads with a BOM so Excel reads UTF-8', async () => {
    const { service, prisma } = setup();
    prisma.marketplaceOrder.findMany = vi.fn().mockResolvedValue([
      orderWith([line('Cartografia "Deluxe"')]),
    ]);

    const csv = await service.exportOrdersCsv('seller1');

    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"Cartografia ""Deluxe"""');
  });

  it('clamps an absurd day window instead of scanning all history', async () => {
    const { service, prisma } = setup();
    prisma.marketplaceOrder.findMany = vi.fn().mockResolvedValue([]);

    await service.exportOrdersCsv('seller1', { days: 99999 });

    const where = prisma.marketplaceOrder.findMany.mock.calls[0][0].where;
    const days = Math.round((Date.now() - (where.createdAt.gte as Date).getTime()) / 86400000);
    expect(days).toBe(365);
  });
});

describe('SellersService.bulkUpdateListings', () => {
  it('queues a reindex for every affected product instead of blocking the request', async () => {
    const { service, rankings, indexer } = setup();

    const result = await service.bulkUpdateListings('seller1', { ids: ['l1', 'l2'] }, { active: false });

    expect(result).toEqual({ updated: 2 });
    expect(rankings.enqueueReindex).toHaveBeenCalledWith(['prodA', 'prodB']);
    // Inline reindexing a select-all edit would time out the request.
    expect(indexer.syncProductQuietly).not.toHaveBeenCalled();
  });

  it('collects affected products BEFORE the update, while the filter still matches them', async () => {
    const { service, prisma, rankings } = setup();
    const order: string[] = [];
    prisma.listing.findMany.mockImplementation(async () => {
      order.push('read');
      return [{ productId: 'prodA' }];
    });
    prisma.listing.updateMany.mockImplementation(async () => {
      order.push('write');
      return { count: 1 };
    });

    await service.bulkUpdateListings('seller1', { filter: { status: 'active' } }, { active: false });

    // Deactivating via `status: active` stops matching the rows it just changed,
    // so reading after the write would silently reindex nothing.
    expect(order).toEqual(['read', 'write']);
    expect(rankings.enqueueReindex).toHaveBeenCalledWith(['prodA']);
  });
});

describe('SellersService.updateOrderStatus', () => {
  it('throws 404 when the order does not belong to this seller', async () => {
    const { service, prisma } = setup();
    prisma.marketplaceOrder.findFirst.mockResolvedValue(null);

    await expect(service.updateOrderStatus('seller1', 'order1', { status: 'shipped' }))
      .rejects.toThrow('Order "order1" not found for this seller');
  });

  it('rejects a transition the order status does not allow', async () => {
    const { service, prisma } = setup();
    prisma.marketplaceOrder.findFirst.mockResolvedValue(baseOrder({ status: 'pending' }));

    await expect(service.updateOrderStatus('seller1', 'order1', { status: 'shipped' }))
      .rejects.toThrow('Cannot move an order from "pending" to "shipped"');
  });

  it('marks a confirmed order shipped and records tracking info on the event', async () => {
    const { service, prisma } = setup();
    prisma.marketplaceOrder.findFirst.mockResolvedValue(baseOrder({ status: 'confirmed' }));

    await service.updateOrderStatus('seller1', 'order1', {
      status: 'shipped', trackingCarrier: 'DHL', trackingNumber: 'XYZ123',
    });

    expect(prisma.marketplaceOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'order1' },
      data: {
        status: 'shipped',
        events: { create: { type: 'shipped', payload: { trackingCarrier: 'DHL', trackingNumber: 'XYZ123' } } },
      },
    }));
  });

  it('refunds through the payment provider when cancelling a gateway-paid order', async () => {
    const { service, prisma, checkout, loyalty } = setup();
    prisma.marketplaceOrder.findFirst.mockResolvedValue(
      baseOrder({ status: 'confirmed', paymentProvider: 'mercadopago', paymentId: 'pay_1' }),
    );

    await service.updateOrderStatus('seller1', 'order1', { status: 'cancelled', reason: 'Out of stock' });

    expect(checkout.refundOrder).toHaveBeenCalledWith('order1', 'Out of stock');
    // refundOrder owns settling credits and writing the final `refunded`
    // status, so this path must not also apply a plain status update.
    expect(loyalty.refundCredits).not.toHaveBeenCalled();
    expect(prisma.marketplaceOrder.update).not.toHaveBeenCalled();
  });

  it('leaves the order untouched when the provider refund fails', async () => {
    const { service, prisma, checkout } = setup();
    prisma.marketplaceOrder.findFirst.mockResolvedValue(
      baseOrder({ status: 'confirmed', paymentProvider: 'mercadopago', paymentId: 'pay_1' }),
    );
    checkout.refundOrder.mockRejectedValue(new Error('MercadoPago refund failed: insufficient funds'));

    await expect(service.updateOrderStatus('seller1', 'order1', { status: 'cancelled' }))
      .rejects.toThrow(/refund failed/);
    // The buyer is still charged, so the order must not read as cancelled.
    expect(prisma.marketplaceOrder.update).not.toHaveBeenCalled();
  });

  it('cancels and refunds credits for an order paid entirely with wallet credits', async () => {
    const { service, prisma, loyalty, checkout } = setup();
    prisma.marketplaceOrder.findFirst.mockResolvedValue(baseOrder({
      status: 'confirmed', paymentProvider: 'wallet_credits', platformCreditsApplied: 500, storeCreditsApplied: 200,
    }));

    await service.updateOrderStatus('seller1', 'order1', { status: 'cancelled', reason: 'Out of stock' });

    // No gateway payment was taken, so there is nothing to refund at MP.
    expect(checkout.refundOrder).not.toHaveBeenCalled();
    expect(loyalty.refundCredits).toHaveBeenCalledWith({
      customerId: 'cust1', sellerId: 'seller1', orderId: 'order1',
      platformCreditsApplied: 500, storeCreditsApplied: 200,
    });
    expect(prisma.marketplaceOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'cancelled' }),
    }));
  });

  it('cancels a not-yet-paid pending order without touching the payment guard', async () => {
    const { service, prisma, loyalty } = setup();
    prisma.marketplaceOrder.findFirst.mockResolvedValue(baseOrder({ status: 'pending', paymentProvider: null }));

    await service.updateOrderStatus('seller1', 'order1', { status: 'cancelled' });

    expect(loyalty.refundCredits).not.toHaveBeenCalled();
    expect(prisma.marketplaceOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'cancelled' }),
    }));
  });
});
