/**
 * Audit log — append-only record of security- and money-sensitive actions
 * (logins, discounts, refunds, voids, device registration). Entries carry a
 * correlationId so they can be joined with the RWP event stream and the saga log.
 */
export interface AuditEntry {
  id: string;
  correlationId: string;
  at: string;
  tenantId: string;
  storeId: string;
  actorUserId: string;
  action: string;
  target?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditSink {
  write(entry: AuditEntry): void | Promise<void>;
}

/** A device must be registered + trusted before it can transact. */
export interface DeviceRegistration {
  deviceId: string;
  tenantId: string;
  storeId: string;
  publicKeyFingerprint: string;
  registeredAt: string;
  status: 'pending' | 'trusted' | 'revoked';
}
