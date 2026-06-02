import { nanoid } from 'nanoid';
import type { Db } from './database.js';
import type { WizardState } from '@retail-os/onboarding';

/**
 * SQLite-backed wizard persistence (implements `WizardPersistence` from
 * `@retail-os/onboarding`). The shell main process owns this instance; the
 * wizard renderer reaches it through the preload IPC bridge.
 */
export class SqliteWizardPersistence {
  constructor(private readonly db: Db) {}

  load(): WizardState | null {
    const row = this.db.prepare('SELECT * FROM onboarding_state LIMIT 1').get() as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    return {
      id: row.id as string,
      currentStep: row.current_step as WizardState['currentStep'],
      completedSteps: JSON.parse(row.completed_steps as string),
      data: JSON.parse(row.data as string),
      startedAt: row.started_at as string,
      updatedAt: row.updated_at as string,
      completedAt: (row.completed_at as string) ?? undefined,
    };
  }

  save(state: WizardState): void {
    this.db
      .prepare(
        `INSERT INTO onboarding_state (id, current_step, completed_steps, data, started_at, updated_at, completed_at)
         VALUES (@id, @current_step, @completed_steps, @data, @started_at, @updated_at, @completed_at)
         ON CONFLICT(id) DO UPDATE SET
           current_step=@current_step, completed_steps=@completed_steps, data=@data,
           updated_at=@updated_at, completed_at=@completed_at`,
      )
      .run({
        id: state.id,
        current_step: state.currentStep,
        completed_steps: JSON.stringify(state.completedSteps),
        data: JSON.stringify(state.data),
        started_at: state.startedAt,
        updated_at: state.updatedAt,
        completed_at: state.completedAt ?? null,
      });
  }
}

export class ProviderConnectionRepository {
  constructor(private readonly db: Db) {}

  upsert(conn: {
    tenantId: string;
    provider: string;
    mode: string;
    status: string;
    encryptedAccessToken?: string;
    providerAccountId?: string;
    tokenExpiresAt?: string;
  }): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO provider_connections (id, tenant_id, provider, mode, status, encrypted_access_token, provider_account_id, token_expires_at, created_at, updated_at)
         VALUES (@id, @tenant_id, @provider, @mode, @status, @encrypted_access_token, @provider_account_id, @token_expires_at, @created_at, @updated_at)
         ON CONFLICT(tenant_id, provider, mode) DO UPDATE SET
           status=@status, encrypted_access_token=@encrypted_access_token,
           provider_account_id=@provider_account_id, token_expires_at=@token_expires_at, updated_at=@updated_at`,
      )
      .run({
        id: nanoid(),
        tenant_id: conn.tenantId,
        provider: conn.provider,
        mode: conn.mode,
        status: conn.status,
        encrypted_access_token: conn.encryptedAccessToken ?? null,
        provider_account_id: conn.providerAccountId ?? null,
        token_expires_at: conn.tokenExpiresAt ?? null,
        created_at: now,
        updated_at: now,
      });
  }

  findByTenantAndProvider(tenantId: string, provider: string) {
    return this.db
      .prepare('SELECT * FROM provider_connections WHERE tenant_id = ? AND provider = ?')
      .all(tenantId, provider) as Record<string, unknown>[];
  }
}

export class TerminalAssignmentRepository {
  constructor(private readonly db: Db) {}

  upsert(assignment: {
    tenantId: string;
    storeId: string;
    provider: string;
    terminalId: string;
    terminalName: string;
    terminalModel?: string;
  }): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO terminal_assignments (id, tenant_id, store_id, provider, terminal_id, terminal_name, terminal_model, active, created_at, updated_at)
         VALUES (@id, @tenant_id, @store_id, @provider, @terminal_id, @terminal_name, @terminal_model, 1, @created_at, @updated_at)
         ON CONFLICT(id) DO NOTHING`,
      )
      .run({
        id: nanoid(),
        tenant_id: assignment.tenantId,
        store_id: assignment.storeId,
        provider: assignment.provider,
        terminal_id: assignment.terminalId,
        terminal_name: assignment.terminalName,
        terminal_model: assignment.terminalModel ?? null,
        created_at: now,
        updated_at: now,
      });
  }

  listActive(tenantId: string, storeId: string) {
    return this.db
      .prepare('SELECT * FROM terminal_assignments WHERE tenant_id = ? AND store_id = ? AND active = 1')
      .all(tenantId, storeId) as Record<string, unknown>[];
  }

  getActiveForProvider(tenantId: string, provider: string): Record<string, unknown> | undefined {
    return this.db
      .prepare('SELECT * FROM terminal_assignments WHERE tenant_id = ? AND provider = ? AND active = 1 LIMIT 1')
      .get(tenantId, provider) as Record<string, unknown> | undefined;
  }
}
