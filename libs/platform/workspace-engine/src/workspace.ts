/**
 * Workspace engine — persistence + templates for the Dockview-based workspace
 * (dockable panels, floating/popout windows, saved user layouts). The shell
 * renders the layout with Dockview; this engine owns the serializable model and
 * the load/save lifecycle so layouts survive restarts and can be shared as
 * templates.
 */
export interface PanelState {
  id: string;
  appId: string;
  title: string;
  params?: Record<string, unknown>;
}

export interface WorkspaceLayout {
  id: string;
  name: string;
  /** Opaque Dockview serialized grid; engine treats it as a black box. */
  grid: unknown | null;
  panels: PanelState[];
  updatedAt: string;
}

export interface WorkspaceStore {
  get(id: string): WorkspaceLayout | null;
  list(): WorkspaceLayout[];
  save(layout: WorkspaceLayout): void;
  remove(id: string): void;
}

/** localStorage-backed store for the renderer; swap for a file/db store in main. */
export class LocalStorageWorkspaceStore implements WorkspaceStore {
  constructor(private readonly key = 'retail-os.workspaces') {}

  private read(): Record<string, WorkspaceLayout> {
    if (typeof localStorage === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem(this.key) ?? '{}') as Record<string, WorkspaceLayout>;
    } catch {
      return {};
    }
  }

  private write(all: Record<string, WorkspaceLayout>): void {
    if (typeof localStorage !== 'undefined') localStorage.setItem(this.key, JSON.stringify(all));
  }

  get(id: string): WorkspaceLayout | null {
    return this.read()[id] ?? null;
  }
  list(): WorkspaceLayout[] {
    return Object.values(this.read());
  }
  save(layout: WorkspaceLayout): void {
    const all = this.read();
    all[layout.id] = layout;
    this.write(all);
  }
  remove(id: string): void {
    const all = this.read();
    delete all[id];
    this.write(all);
  }
}

export const DEFAULT_POS_WORKSPACE: WorkspaceLayout = {
  id: 'default-pos',
  name: 'Point of Sale',
  grid: null,
  panels: [{ id: 'pos-main', appId: 'pos', title: 'Point of Sale' }],
  updatedAt: '1970-01-01T00:00:00.000Z',
};
