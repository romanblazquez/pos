import { describe, it, expect } from 'vitest';
import { Money, asId, type ProductId, type StoreId, type DeviceId } from '@retail-os/shared-kernel';
import { Sale } from './sale.js';

const ctx = { storeId: asId<'StoreId'>('store-1') as StoreId, deviceId: asId<'DeviceId'>('dev-1') as DeviceId };
const pid = (s: string) => asId<'ProductId'>(s) as ProductId;

function coffee(sale: Sale, qty = 1) {
  return sale.addLine({
    productId: pid('coffee'),
    name: 'Coffee',
    unitPrice: Money.of(5000, 'MXN'),
    quantity: qty,
    taxRatePercent: 16,
  });
}

describe('Sale', () => {
  it('computes subtotal, tax (16% IVA) and grand total', () => {
    const sale = Sale.start('MXN', ctx);
    coffee(sale, 2); // 2 × 50.00 = 100.00 net
    expect(sale.netSubtotal.minorUnits).toBe(10000);
    expect(sale.taxTotal.minorUnits).toBe(1600);
    expect(sale.grandTotal.minorUnits).toBe(11600);
  });

  it('merges duplicate products into one line', () => {
    const sale = Sale.start('MXN', ctx);
    coffee(sale, 1);
    coffee(sale, 2);
    expect(sale.lines.length).toBe(1);
    expect(sale.lines[0].quantity).toBe(3);
  });

  it('applies a line discount before tax', () => {
    const sale = Sale.start('MXN', ctx);
    const line = coffee(sale, 1); // 50.00 net
    const r = sale.setLineDiscount(line.lineId, Money.of(1000, 'MXN')); // -10.00
    expect(r.ok).toBe(true);
    expect(sale.netSubtotal.minorUnits).toBe(4000);
    expect(sale.taxTotal.minorUnits).toBe(640); // 16% of 40.00
    expect(sale.grandTotal.minorUnits).toBe(4640);
  });

  it('rejects a line discount that exceeds the line value', () => {
    const sale = Sale.start('MXN', ctx);
    const line = coffee(sale, 1);
    const r = sale.setLineDiscount(line.lineId, Money.of(99999, 'MXN'));
    expect(r.ok).toBe(false);
  });

  it('drives the tender → paid → committed lifecycle and records events', () => {
    const sale = Sale.start('MXN', ctx);
    coffee(sale, 1); // total 58.00
    sale.pullDomainEvents(); // drain SaleStarted

    expect(sale.beginTender().ok).toBe(true);
    expect(sale.status).toBe('tendering');

    sale.applyPayment({ paymentId: 'p1', provider: 'codi', amount: sale.grandTotal, status: 'approved' });
    expect(sale.status).toBe('paid');
    expect(sale.balanceDue.isZero()).toBe(true);

    expect(sale.commit().ok).toBe(true);
    expect(sale.status).toBe('committed');

    const events = sale.pullDomainEvents().map((e) => e.type);
    expect(events).toContain('sales.TenderStarted');
    expect(events).toContain('sales.SalePaid');
    expect(events).toContain('sales.SaleCommitted');
  });

  it('voids a non-committed sale (saga compensation) but refuses to void a committed one', () => {
    const sale = Sale.start('MXN', ctx);
    coffee(sale, 1);
    sale.beginTender();
    sale.void('payment rejected');
    expect(sale.status).toBe('voided');

    const sale2 = Sale.start('MXN', ctx);
    coffee(sale2, 1);
    sale2.beginTender();
    sale2.applyPayment({ paymentId: 'p', provider: 'codi', amount: sale2.grandTotal, status: 'approved' });
    sale2.commit();
    expect(() => sale2.void('x')).toThrow();
  });
});
