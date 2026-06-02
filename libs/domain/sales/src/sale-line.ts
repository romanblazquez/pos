import { Money, type SaleLineId, type ProductId } from '@retail-os/shared-kernel';

/**
 * SaleLine — one item row in a sale. The unit price is **net** (tax-exclusive).
 * A per-line discount is an absolute Money amount applied before tax; tax is
 * computed on the discounted net.
 */
export interface SaleLineProps {
  lineId: SaleLineId;
  productId: ProductId;
  name: string;
  unitPrice: Money;
  quantity: number;
  discount: Money;
  taxRatePercent: number;
}

export class SaleLine {
  constructor(private props: SaleLineProps) {}

  get lineId(): SaleLineId {
    return this.props.lineId;
  }
  get productId(): ProductId {
    return this.props.productId;
  }
  get name(): string {
    return this.props.name;
  }
  get unitPrice(): Money {
    return this.props.unitPrice;
  }
  get quantity(): number {
    return this.props.quantity;
  }
  get discount(): Money {
    return this.props.discount;
  }
  get taxRatePercent(): number {
    return this.props.taxRatePercent;
  }

  setQuantity(qty: number): void {
    if (qty <= 0 || !Number.isFinite(qty)) throw new Error('Quantity must be > 0');
    this.props.quantity = qty;
  }

  setDiscount(discount: Money): void {
    this.props.discount = discount.clampToZero();
  }

  /** Gross net = unitPrice × quantity (before discount, before tax). */
  get grossNet(): Money {
    return this.props.unitPrice.multiply(this.props.quantity);
  }

  /** Net after the line discount, never below zero. */
  get netAfterDiscount(): Money {
    return this.grossNet.subtract(this.props.discount).clampToZero();
  }

  get taxAmount(): Money {
    return this.netAfterDiscount.percentage(this.props.taxRatePercent);
  }

  get lineTotal(): Money {
    return this.netAfterDiscount.add(this.taxAmount);
  }

  toJSON() {
    return {
      lineId: this.props.lineId,
      productId: this.props.productId,
      name: this.props.name,
      unitPrice: this.props.unitPrice.toJSON(),
      quantity: this.props.quantity,
      discount: this.props.discount.toJSON(),
      taxRatePercent: this.props.taxRatePercent,
      netAfterDiscount: this.netAfterDiscount.toJSON(),
      taxAmount: this.taxAmount.toJSON(),
      lineTotal: this.lineTotal.toJSON(),
    };
  }
}
