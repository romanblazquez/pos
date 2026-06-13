import fs from 'node:fs';
import path from 'node:path';

export interface ShellManifest {
  appId: string;
  name: string;
  title: string;
  subtitle: string;
  provider: string;
  providerVersion: string;
  description?: string;
  iconWindowPath?: string;
  iconDockPath?: string;
  branding?: {
    productMark?: string;
    accentColor?: string;
  };
}

const DEFAULT: ShellManifest = {
  appId: 'retail-os-shell',
  name: 'Retail OS',
  title: 'Retail OS',
  subtitle: 'PUNTO DE VENTA',
  provider: 'retail-os',
  providerVersion: '0.1.0',
};

function resolveIcon(baseDir: string, rel: unknown): string | undefined {
  if (typeof rel !== 'string' || !rel.trim()) return undefined;
  const abs = path.isAbsolute(rel) ? rel : path.resolve(baseDir, rel);
  if (!fs.existsSync(abs)) {
    console.warn(`[ShellAssetsLoader] Icon not found: ${abs}`);
    return undefined;
  }
  return abs;
}

export class ShellAssetsLoader {
  static load(manifestPath: string, appVersion: string): ShellManifest {
    if (!fs.existsSync(manifestPath)) {
      console.warn(`[ShellAssetsLoader] ${manifestPath} not found — using defaults`);
      return { ...DEFAULT, providerVersion: appVersion || DEFAULT.providerVersion };
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as {
        desktopShell?: {
          appId?: unknown; name?: unknown; title?: unknown; subtitle?: unknown;
          provider?: unknown; providerVersion?: unknown; description?: unknown;
          icons?: { window?: unknown; dock?: unknown };
          branding?: { productMark?: unknown; accentColor?: unknown };
        };
      };
      const s = parsed.desktopShell ?? {};
      const dir = path.dirname(manifestPath);
      const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

      return {
        appId:          str(s.appId)          ?? DEFAULT.appId,
        name:           str(s.name)           ?? DEFAULT.name,
        title:          str(s.title)          ?? DEFAULT.title,
        subtitle:       str(s.subtitle)       ?? DEFAULT.subtitle,
        provider:       str(s.provider)       ?? DEFAULT.provider,
        providerVersion: str(s.providerVersion) ?? appVersion ?? DEFAULT.providerVersion,
        description:    str(s.description),
        iconWindowPath: resolveIcon(dir, s.icons?.window),
        iconDockPath:   resolveIcon(dir, s.icons?.dock),
        branding: {
          productMark: str(s.branding?.productMark),
          accentColor: str(s.branding?.accentColor),
        },
      };
    } catch (err) {
      console.error(`[ShellAssetsLoader] Failed to parse manifest: ${(err as Error).message}`);
      return { ...DEFAULT, providerVersion: appVersion || DEFAULT.providerVersion };
    }
  }
}
