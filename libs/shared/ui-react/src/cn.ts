/**
 * Back-compat re-export. `cn` now lives in ./lib/utils (clsx + tailwind-merge).
 * Existing consumers importing { cn } from '@retail-os/ui-react' keep working.
 */
export { cn } from './lib/utils.js';
export type { ClassValue } from 'clsx';
