import type { AppMetadata, AppCategory } from './app-metadata.js';

/**
 * AppRegistry — in-memory directory of installed applications, loaded from
 * `config/app-directory.json` at shell startup. Powers the launcher's search,
 * category filtering, favorites/recents and permission gating.
 */
export class AppRegistry {
  private readonly apps = new Map<string, AppMetadata>();

  constructor(apps: AppMetadata[] = []) {
    for (const app of apps) this.apps.set(app.id, app);
  }

  getAll(): AppMetadata[] {
    return [...this.apps.values()];
  }

  getById(id: string): AppMetadata | undefined {
    return this.apps.get(id);
  }

  byCategory(category: AppCategory): AppMetadata[] {
    return this.getAll().filter((a) => a.category === category);
  }

  /** Apps visible to a user holding `grantedPermissions` (empty perms = public). */
  visibleTo(grantedPermissions: ReadonlySet<string>): AppMetadata[] {
    return this.getAll().filter(
      (a) => a.permissions.length === 0 || a.permissions.every((p) => grantedPermissions.has(p)),
    );
  }

  /** Launcher free-text search across name/description/category. */
  search(query: string): AppMetadata[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.getAll();
    return this.getAll().filter((a) =>
      `${a.name} ${a.description ?? ''} ${a.category}`.toLowerCase().includes(q),
    );
  }
}
