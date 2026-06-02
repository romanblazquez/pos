import {
  AggregateRoot,
  Money,
  createDomainEvent,
  newId,
  type CurrencyCode,
  type SaleId,
  type SaleLineId,
  type ProductId,
  type CustomerId,
  type StoreId,
  type DeviceId,
  type Clock,
  systemClock,
  type Result,
  ok,
  err,
  DomainError,
} from '@retail-os/shared-kernel';
import { SaleLine } from './sale-line.js';

/**
 * Sale lifecycle:
 *
 *   draft ──beginTender──▶ tendering ──(balance == 0)──▶ paid ──commit──▶ committed
 *     │                        │
 *     └────────void───────────┴──────────────────────────────────────▶ voided
 *
 * `draft`     — cart being built; lines/discounts mutable.
 * `tendering` — totals frozen; payments are being applied (the Saga drives this).
 * `paid`      — balance fully covered; ready to finalize.
 * `committed` — persisted to the local store and enqueued for sync.
 * `voided`    — abandoned/refunded; terminal.
 */
export type SaleStatus = 'draft' | 'tendering' | 'paid' | 'committed' | 'voided';

export interface AppliedPayment {
  paymentId: string;
  provider: string;
  amount: Money;
  status: 'approved';
}

export interface AddLineInput {
  productId: ProductId;
  name: string;
  unitPrice: Money;
  quantity?: number;
  taxRatePercent: number;
}

export interface SaleContext {
  storeId: StoreId;
  deviceId: DeviceId;
  cashierId?: string;
  clock?: Clock;
}

export class Sale extends AggregateRoot<SaleId> {
  private _status: SaleStatus = 'draft';
  private readonly _lines: SaleLine[] = [];
  private _cartDiscount: Money;
  private _customerId?: CustomerId;
  private readonly _payments: AppliedPayment[] = [];
  private readonly clock: Clock;

  private constructor(
    id: SaleId,
    public readonly currency: CurrencyCode,
    public readonly storeId: StoreId,
    public readonly deviceId: DeviceId,
    public readonly cashierId: string | undefined,
    clock: Clock,
  ) {
    super(id);
    this._cartDiscount = Money.zero(currency);
    this.clock = clock;
  }

  static start(currency: CurrencyCode, ctx: SaleContext): Sale {
    const clock = ctx.clock ?? systemClock;
    const sale = new Sale(newId<'SaleId'>(), currency, ctx.storeId, ctx.deviceId, ctx.cashierId, clock);
    sale.record(
      createDomainEvent({
        type: 'sales.SaleStarted',
        aggregateId: sale.id,
        payload: { currency, storeId: ctx.storeId, deviceId: ctx.deviceId, occurredAt: clock.isoNow() },
      }),
    );
    return sale;
  }

  // ─── State ───────────────────────────────────────────────────────────────
  get status(): SaleStatus {
    return this._status;
  }
  get lines(): readonly SaleLine[] {
    return this._lines;
  }
  get customerId(): CustomerId | undefined {
    return this._customerId;
  }
  get cartDiscount(): Money {
    return this._cartDiscount;
  }
  get payments(): readonly AppliedPayment[] {
    return this._payments;
  }
  get isEmpty(): boolean {
    return this._lines.length === 0;
  }

  private assertDraft(): void {
    if (this._status !== 'draft') {
      throw new DomainError('SALE_NOT_DRAFT', `Cannot modify a sale in status '${this._status}'`);
    }
  }

  // ─── Mutation (draft only) ────────────────────────────────────────────────
  addLine(input: AddLineInput): SaleLine {
    this.assertDraft();
    const qty = input.quantity ?? 1;
    const existing = this._lines.find((l) => l.productId === input.productId && l.discount.isZero());
    if (existing) {
      existing.setQuantity(existing.quantity + qty);
      return existing;
    }
    const line = new SaleLine({
      lineId: newId<'SaleLineId'>(),
      productId: input.productId,
      name: input.name,
      unitPrice: input.unitPrice,
      quantity: qty,
      discount: Money.zero(this.currency),
      taxRatePercent: input.taxRatePercent,
    });
    this._lines.push(line);
    return line;
  }

  changeQuantity(lineId: SaleLineId, quantity: number): Result<void> {
    this.assertDraft();
    const line = this._lines.find((l) => l.lineId === lineId);
    if (!line) return err(new DomainError('LINE_NOT_FOUND', `No line ${lineId}`));
    if (quantity <= 0) {
      this.removeLine(lineId);
      return ok(undefined);
    }
    line.setQuantity(quantity);
    return ok(undefined);
  }

  setLineDiscount(lineId: SaleLineId, discount: Money): Result<void> {
    this.assertDraft();
    const line = this._lines.find((l) => l.lineId === lineId);
    if (!line) return err(new DomainError('LINE_NOT_FOUND', `No line ${lineId}`));
    if (discount.greaterThan(line.grossNet)) {
      return err(new DomainError('DISCOUNT_EXCEEDS_LINE', 'Line discount exceeds line value'));
    }
    line.setDiscount(discount);
    return ok(undefined);
  }

  removeLine(lineId: SaleLineId): void {
    this.assertDraft();
    const idx = this._lines.findIndex((l) => l.lineId === lineId);
    if (idx >= 0) this._lines.splice(idx, 1);
  }

  setCartDiscount(discount: Money): Result<void> {
    this.assertDraft();
    if (discount.greaterThan(this.netSubtotal)) {
      return err(new DomainError('DISCOUNT_EXCEEDS_CART', 'Cart discount exceeds subtotal'));
    }
    this._cartDiscount = discount.clampToZero();
    return ok(undefined);
  }

  assignCustomer(customerId: CustomerId): void {
    this._customerId = customerId;
  }

  // ─── Totals (computed on demand — cart update < 16ms) ─────────────────────
  /** Sum of line gross nets (unitPrice × qty), before any discount. */
  get grossSubtotal(): Money {
    return Money.sum(this._lines.map((l) => l.grossNet), this.currency);
  }

  /** Net subtotal after per-line discounts (still before the cart discount). */
  get netSubtotal(): Money {
    return Money.sum(this._lines.map((l) => l.netAfterDiscount), this.currency);
  }

  get lineDiscountTotal(): Money {
    return Money.sum(this._lines.map((l) => l.discount), this.currency);
  }

  get discountTotal(): Money {
    return this.lineDiscountTotal.add(this._cartDiscount);
  }

  /**
   * Tax is computed per line on its discounted net, then the cart-level discount
   * is applied proportionally to the taxable base so the books stay consistent.
   */
  get taxTotal(): Money {
    if (this._cartDiscount.isZero()) {
      return Money.sum(this._lines.map((l) => l.taxAmount), this.currency);
    }
    const base = this.netSubtotal;
    if (base.isZero()) return Money.zero(this.currency);
    // Distribute the cart discount across lines proportionally, then tax.
    let tax = Money.zero(this.currency);
    for (const line of this._lines) {
      const share = line.netAfterDiscount.minorUnits / base.minorUnits;
      const lineCartDiscount = this._cartDiscount.multiply(share);
      const taxableNet = line.netAfterDiscount.subtract(lineCartDiscount).clampToZero();
      tax = tax.add(taxableNet.percentage(line.taxRatePercent));
    }
    return tax;
  }

  /** Final amount due = net subtotal − cart discount + tax. */
  get grandTotal(): Money {
    return this.netSubtotal.subtract(this._cartDiscount).clampToZero().add(this.taxTotal);
  }

  get amountPaid(): Money {
    return Money.sum(this._payments.map((p) => p.amount), this.currency);
  }

  get balanceDue(): Money {
    return this.grandTotal.subtract(this.amountPaid).clampToZero();
  }

  // ─── Tendering / lifecycle (driven by the CheckoutSaga) ───────────────────
  beginTender(): Result<void> {
    if (this._status !== 'draft') {
      return err(new DomainError('SALE_NOT_DRAFT', 'Only a draft sale can begin tendering'));
    }
    if (this.isEmpty) return err(new DomainError('SALE_EMPTY', 'Cannot tender an empty sale'));
    this._status = 'tendering';
    this.record(
      createDomainEvent({
        type: 'sales.TenderStarted',
        aggregateId: this.id,
        payload: { grandTotal: this.grandTotal.toJSON() },
      }),
    );
    return ok(undefined);
  }

  applyPayment(payment: AppliedPayment): Result<void> {
    if (this._status !== 'tendering') {
      return err(new DomainError('SALE_NOT_TENDERING', 'Sale is not in tendering state'));
    }
    this._payments.push(payment);
    if (this.balanceDue.isZero()) {
      this._status = 'paid';
      this.record(
        createDomainEvent({
          type: 'sales.SalePaid',
          aggregateId: this.id,
          payload: { amountPaid: this.amountPaid.toJSON() },
        }),
      );
    }
    return ok(undefined);
  }

  /** Finalize a fully-paid sale. Records the canonical `SaleCommitted` event. */
  commit(): Result<void> {
    if (this._status !== 'paid') {
      return err(new DomainError('SALE_NOT_PAID', 'Only a fully-paid sale can be committed'));
    }
    this._status = 'committed';
    this.record(
      createDomainEvent({
        type: 'sales.SaleCommitted',
        aggregateId: this.id,
        payload: this.toSnapshot(),
      }),
    );
    return ok(undefined);
  }

  /**
   * Return a tendering sale to draft so the cashier can retry or change method
   * after a declined payment — the Saga's `begin-tender` compensation. The cart
   * is preserved; nothing is lost on a rejected/timed-out payment.
   */
  reopen(): void {
    if (this._status === 'tendering') this._status = 'draft';
  }

  /** Compensating action used by the Saga when checkout fails downstream. */
  void(reason: string): void {
    if (this._status === 'committed') {
      throw new DomainError('SALE_COMMITTED', 'Cannot void a committed sale; issue a refund instead');
    }
    this._status = 'voided';
    this.record(createDomainEvent({ type: 'sales.SaleVoided', aggregateId: this.id, payload: { reason } }));
  }

  toSnapshot() {
    return {
      saleId: this.id,
      status: this._status,
      currency: this.currency,
      storeId: this.storeId,
      deviceId: this.deviceId,
      cashierId: this.cashierId,
      customerId: this._customerId,
      committedAt: this.clock.isoNow(),
      lines: this._lines.map((l) => l.toJSON()),
      cartDiscount: this._cartDiscount.toJSON(),
      totals: {
        grossSubtotal: this.grossSubtotal.toJSON(),
        netSubtotal: this.netSubtotal.toJSON(),
        discountTotal: this.discountTotal.toJSON(),
        taxTotal: this.taxTotal.toJSON(),
        grandTotal: this.grandTotal.toJSON(),
        amountPaid: this.amountPaid.toJSON(),
      },
      payments: this._payments.map((p) => ({
        paymentId: p.paymentId,
        provider: p.provider,
        amount: p.amount.toJSON(),
        status: p.status,
      })),
    };
  }
}

export type SaleSnapshot = ReturnType<Sale['toSnapshot']>;
