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
      update: vi.fn().mockImplementation(({ data }) => ({ ...data })),
    },
  };
  const indexer = {};
  const loyalty = { refundCredits: vi.fn().mockResolvedValue(undefined) };
  const service = new SellersService(prisma as never, indexer as never, loyalty as never);
  return { service, prisma, loyalty };
}

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

  it('refuses to cancel an order already paid through a real payment provider', async () => {
    const { service, prisma, loyalty } = setup();
    prisma.marketplaceOrder.findFirst.mockResolvedValue(baseOrder({ status: 'confirmed', paymentProvider: 'mercadopago' }));

    await expect(service.updateOrderStatus('seller1', 'order1', { status: 'cancelled', reason: 'Out of stock' }))
      .rejects.toThrow(/needs an actual refund/);
    expect(loyalty.refundCredits).not.toHaveBeenCalled();
    expect(prisma.marketplaceOrder.update).not.toHaveBeenCalled();
  });

  it('cancels and refunds credits for an order paid entirely with wallet credits', async () => {
    const { service, prisma, loyalty } = setup();
    prisma.marketplaceOrder.findFirst.mockResolvedValue(baseOrder({
      status: 'confirmed', paymentProvider: 'wallet_credits', platformCreditsApplied: 500, storeCreditsApplied: 200,
    }));

    await service.updateOrderStatus('seller1', 'order1', { status: 'cancelled', reason: 'Out of stock' });

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
