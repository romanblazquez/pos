/**
 * Result<T, E> — explicit success/failure without exceptions for expected
 * domain errors. Aggregates return `Result` from operations that can fail on
 * business rules (e.g. discount exceeds line total), keeping control flow
 * predictable and testable.
 */
export type Result<T, E = DomainError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export function isOk<T, E>(r: Result<T, E>): r is { ok: true; value: T } {
  return r.ok;
}

export function unwrap<T, E>(r: Result<T, E>): T {
  if (!r.ok) throw r.error instanceof Error ? r.error : new Error(String(r.error));
  return r.value;
}

/** Base class for typed, code-bearing domain errors. */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
