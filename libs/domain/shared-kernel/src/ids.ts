import { nanoid } from 'nanoid';

/**
 * Branded identifier types. Branding makes `ProductId` and `SaleId` distinct at
 * compile time even though both are strings, preventing accidental cross-wiring.
 */
declare const brand: unique symbol;
export type Branded<T, B extends string> = T & { readonly [brand]: B };

export type EntityId<B extends string> = Branded<string, B>;

export type TenantId = EntityId<'TenantId'>;
export type StoreId = EntityId<'StoreId'>;
export type DeviceId = EntityId<'DeviceId'>;
export type ProductId = EntityId<'ProductId'>;
export type VariantId = EntityId<'VariantId'>;
export type SaleId = EntityId<'SaleId'>;
export type SaleLineId = EntityId<'SaleLineId'>;
export type CustomerId = EntityId<'CustomerId'>;
export type PaymentId = EntityId<'PaymentId'>;
export type SagaId = EntityId<'SagaId'>;
export type UserId = EntityId<'UserId'>;

/** Create a new opaque id. URL-safe, 21 chars, collision-resistant. */
export function newId<B extends string>(): EntityId<B> {
  return nanoid() as EntityId<B>;
}

/** Cast a known string into a branded id (e.g. when reading from the DB). */
export function asId<B extends string>(value: string): EntityId<B> {
  return value as EntityId<B>;
}

/** A correlation id ties together every event/saga step in one logical flow. */
export function newCorrelationId(): string {
  return nanoid();
}
