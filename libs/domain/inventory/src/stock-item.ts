import { type ProductId, type Result, ok, err, DomainError } from '@retail-os/shared-kernel';

/**
 * StockItem — on-hand and reserved quantity for a product at a location.
 *
 * Reservation is central to the **CheckoutSaga**: when tendering begins the
 * saga reserves stock (`reserve`); if payment fails the compensating step
 * releases it (`release`); on a committed sale the reservation is consumed
 * (`consumeReserved`). This keeps oversell impossible even while many sales
 * are tendering concurrently offline.
 */
export class StockItem {
  constructor(
    public readonly productId: ProductId,
    private _onHand: number,
    private _reserved = 0,
  ) {}

  get onHand(): number {
    return this._onHand;
  }
  get reserved(): number {
    return this._reserved;
  }
  /** Quantity that can still be reserved/sold. */
  get available(): number {
    return this._onHand - this._reserved;
  }

  reserve(qty: number): Result<void> {
    if (qty <= 0) return err(new DomainError('INVALID_QTY', 'Reserve qty must be > 0'));
    if (qty > this.available) {
      return err(
        new DomainError('INSUFFICIENT_STOCK', `Only ${this.available} available for ${this.productId}`),
      );
    }
    this._reserved += qty;
    return ok(undefined);
  }

  /** Compensating action: undo a prior reservation. */
  release(qty: number): void {
    this._reserved = Math.max(0, this._reserved - qty);
  }

  /** Consume reserved stock on sale commit, decrementing on-hand. */
  consumeReserved(qty: number): Result<void> {
    if (qty > this._reserved) {
      return err(new DomainError('OVER_CONSUME', 'Cannot consume more than reserved'));
    }
    this._reserved -= qty;
    this._onHand -= qty;
    return ok(undefined);
  }

  receive(qty: number): void {
    this._onHand += qty;
  }
}

export interface StockLevelSnapshot {
  productId: string;
  onHand: number;
  reserved: number;
}
