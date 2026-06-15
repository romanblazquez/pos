/**
 * cn — className utility.
 * shadcn/ui-compatible: merges class strings, filtering falsy values.
 * Drop-in compatible with clsx/tailwind-merge without the extra dependency.
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
