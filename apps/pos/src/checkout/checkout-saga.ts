import { SagaOrchestrator, type SagaStep, type SagaResult } from '@retail-os/saga';
import { newCorrelationId } from '@retail-os/shared-kernel';
import type { Sale } from '@retail-os/sales';
import type { PaymentIntent, PaymentMethod } from '@retail-os/payments-domain';
import type { PaymentOrchestrator } from '@retail-os/payment-orchestrator';
import type { RwpBus } from '@retail-os/rwp-bus';
import type { PaymentCompletedPayload } from '@retail-os/rwp-core';
import type { RetailDataApi } from '../platform/bridge.js';

/**
 * Working context threaded through the checkout saga's steps.
 */
interface CheckoutContext {
  sale: Sale;
  providerId: string;
  method: PaymentMethod;
  correlationId: string;
  /** Forced simulator outcome for the demo (approved | rejected | timeout | …). */
  simulate?: string;
  onPaymentIntent?: (intent: PaymentIntent) => void;
  paymentId?: string;
  paymentStatus?: string;
}

export interface CheckoutDeps {
  orchestrator: PaymentOrchestrator;
  bus: RwpBus;
  data: RetailDataApi;
}

export interface CheckoutParams {
  sale: Sale;
  providerId: string;
  method: PaymentMethod;
  simulate?: string;
  onPaymentIntent?: (intent: PaymentIntent) => void;
}

/**
 * CheckoutSaga — orchestrates the distributed checkout transaction using the
 * Saga pattern (no 2PC). Forward path:
 *
 *   begin-tender → reserve-stock → collect-payment → finalize(commit+persist)
 *
 * If any step fails, the orchestrator runs the **compensations** of the
 * completed steps in reverse:
 *
 *   refund payment ← release stock ← void sale
 *
 * The POS never talks to a payment provider directly: `collect-payment` asks the
 * {@link PaymentOrchestrator} to start the payment and then awaits the unified
 * `rwp.payment.completed` event. A rejected/timed-out/expired payment throws,
 * triggering compensation and leaving the system consistent — and because the
 * saga log is persisted (in the shell, to SQLite), an interrupted checkout is
 * recoverable after a crash.
 */
export class CheckoutSaga {
  constructor(private readonly deps: CheckoutDeps) {}

  /** Await the unified completion event for this sale. */
  private awaitPayment(sale: Sale): Promise<PaymentCompletedPayload> {
    return new Promise((resolve) => {
      const off = this.deps.bus.subscribe('rwp.payment.completed', (payload) => {
        if (payload.saleId === sale.id) {
          off();
          resolve(payload);
        }
      });
    });
  }

  private buildSteps(): SagaStep<CheckoutContext>[] {
    const { orchestrator, data, bus } = this.deps;
    return [
      {
        name: 'begin-tender',
        invoke: (ctx) => {
          const r = ctx.sale.beginTender();
          if (!r.ok) throw r.error;
          bus.publish(
            'rwp.checkout.started',
            { saleId: ctx.sale.id, total: ctx.sale.grandTotal.toJSON() },
            { correlationId: ctx.correlationId },
          );
        },
        compensate: (ctx) => {
          // Preserve the cart: a declined payment returns the sale to draft so
          // the cashier can retry or pick another method.
          ctx.sale.reopen();
        },
      },
      {
        name: 'reserve-stock',
        // Stock reservation authority lives in the main process / inventory ctx.
        // Modeled here so the saga has a symmetric compensation point.
        invoke: () => undefined,
        compensate: () => undefined,
      },
      {
        name: 'collect-payment',
        invoke: async (ctx) => {
          const completion = this.awaitPayment(ctx.sale);
          const intent = await orchestrator.startPayment({
            saleId: ctx.sale.id,
            providerId: ctx.providerId,
            method: ctx.method,
            amount: ctx.sale.grandTotal,
            correlationId: ctx.correlationId,
            metadata: ctx.simulate ? { simulate: ctx.simulate } : undefined,
          });
          ctx.paymentId = intent.paymentId;
          ctx.onPaymentIntent?.(intent);
          const result = await completion;
          ctx.paymentStatus = result.status;
          if (result.status !== 'approved') {
            throw new Error(`Payment ${result.status}`);
          }
          const applied = ctx.sale.applyPayment({
            paymentId: result.paymentId,
            provider: result.provider,
            amount: ctx.sale.grandTotal,
            status: 'approved',
          });
          if (!applied.ok) throw applied.error;
        },
        // Reached only if a *later* step fails: the money was approved, so refund.
        compensate: async (ctx) => {
          if (ctx.paymentStatus === 'approved' && ctx.paymentId) {
            await orchestrator.refundPayment(ctx.providerId, ctx.paymentId as never);
          }
        },
      },
      {
        name: 'finalize',
        invoke: async (ctx) => {
          const committed = ctx.sale.commit();
          if (!committed.ok) throw committed.error;
          const persisted = await data.commitSale(ctx.sale.toSnapshot());
          if (!persisted.ok) throw new Error('Failed to persist sale');
          bus.publish(
            'rwp.sale.committed',
            {
              saleId: ctx.sale.id,
              total: ctx.sale.grandTotal.toJSON(),
              lineCount: ctx.sale.lines.length,
            },
            { correlationId: ctx.correlationId },
          );
        },
      },
    ];
  }

  async run(params: CheckoutParams): Promise<SagaResult> {
    const correlationId = newCorrelationId();
    const ctx: CheckoutContext = {
      sale: params.sale,
      providerId: params.providerId,
      method: params.method,
      simulate: params.simulate,
      onPaymentIntent: params.onPaymentIntent,
      correlationId,
    };
    const orchestrator = new SagaOrchestrator<CheckoutContext>(
      { name: 'CheckoutSaga', steps: this.buildSteps() },
      {
        // Persist only serializable fields (the Sale aggregate is not JSON-safe).
        serialize: (c) => ({
          saleId: c.sale.id,
          providerId: c.providerId,
          method: c.method,
          paymentId: c.paymentId,
          paymentStatus: c.paymentStatus,
        }),
      },
    );

    const result = await orchestrator.run(ctx, { correlationId });
    if (result.status !== 'completed') {
      this.deps.bus.publish(
        'rwp.checkout.failed',
        { saleId: params.sale.id, reason: result.error ?? 'checkout failed' },
        { correlationId },
      );
    }
    return result;
  }
}
