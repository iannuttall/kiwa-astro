// Inline templates used by `kiwa-astro init`. We keep the globals.css minimal so the
// user can layer their own brand on top — we only need the token contract to make
// converted components render the right colours/states. The full Kiwa UI globals.css
// is large and frequently revised; if someone needs the canonical version they can
// run `npx @kiwa-ui/cli init` once and copy it over, or we can fetch and embed it
// later.

export const UTILS_TS = `import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name: string) {
  return name
    .trim()
    .split(/\\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
`

export const GLOBALS_CSS = `@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-background-raised: var(--background-raised);
  --color-background-subtle: var(--background-subtle);
  --color-foreground: var(--foreground);
  --color-foreground-muted: var(--foreground-muted);
  --color-foreground-soft: var(--foreground-soft);
  --color-border: var(--border);
  --color-border-subtle: var(--border-subtle);
  --color-border-strong: var(--border-strong);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-soft: var(--primary-soft);
  --color-primary-hover: var(--primary-hover);
  --color-primary-active: var(--primary-active);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-soft: var(--secondary-soft);
  --color-secondary-hover: var(--secondary-hover);
  --color-secondary-active: var(--secondary-active);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-soft: var(--destructive-soft);
  --color-destructive-hover: var(--destructive-hover);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-success: var(--success);
  --color-success-soft: var(--success-soft);
  --color-warning: var(--warning);
  --color-warning-soft: var(--warning-soft);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-soft: var(--info-soft);
  --color-overlay-scrim: var(--overlay-scrim);
  --radius-xs: calc(var(--radius) - 6px);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 2px);
  --radius-2xl: calc(var(--radius) + 4px);
  --font-sans: 'InterVariable', 'Inter', ui-sans-serif, system-ui, sans-serif;
}

:root {
  --radius: 0.625rem;

  --background: oklch(98.5% 0 0);
  --background-raised: oklch(100% 0 0);
  --background-subtle: oklch(96% 0 0);
  --foreground: oklch(20.5% 0 0);
  --foreground-muted: oklch(45% 0 0);
  --foreground-soft: oklch(60% 0 0);
  --border: oklch(92% 0 0);
  --border-subtle: oklch(95% 0 0);
  --border-strong: oklch(85% 0 0);
  --input: oklch(92% 0 0);
  --ring: oklch(60.9% 0.126 221.723);

  --card: oklch(100% 0 0);
  --card-foreground: var(--foreground);
  --popover: oklch(100% 0 0);
  --popover-foreground: var(--foreground);

  --primary: oklch(60.9% 0.126 221.723);
  --primary-soft: oklch(95% 0.04 221.723);
  --primary-hover: oklch(54% 0.13 221.723);
  --primary-active: oklch(48% 0.13 221.723);
  --primary-foreground: oklch(98.5% 0 0);

  --secondary: oklch(96% 0 0);
  --secondary-soft: oklch(98% 0 0);
  --secondary-hover: oklch(92% 0 0);
  --secondary-active: oklch(88% 0 0);
  --secondary-foreground: var(--foreground);

  --muted: oklch(96% 0 0);
  --muted-foreground: oklch(45% 0 0);
  --accent: oklch(96% 0 0);
  --accent-foreground: var(--foreground);

  --destructive: oklch(57% 0.22 27);
  --destructive-soft: oklch(95% 0.05 27);
  --destructive-hover: oklch(50% 0.22 27);
  --destructive-foreground: oklch(98.5% 0 0);

  --success: oklch(60% 0.16 145);
  --success-soft: oklch(95% 0.04 145);
  --warning: oklch(75% 0.16 80);
  --warning-soft: oklch(95% 0.05 80);
  --warning-foreground: oklch(30% 0.06 80);
  --info: oklch(60% 0.13 240);
  --info-soft: oklch(95% 0.04 240);

  --overlay-scrim: oklch(0% 0 0 / 0.5);
}

.dark {
  --background: oklch(20.5% 0 0);
  --background-raised: oklch(24% 0 0);
  --background-subtle: oklch(17% 0 0);
  --foreground: oklch(98.5% 0 0);
  --foreground-muted: oklch(72% 0 0);
  --foreground-soft: oklch(55% 0 0);
  --border: oklch(28% 0 0);
  --border-subtle: oklch(24% 0 0);
  --border-strong: oklch(38% 0 0);
  --input: oklch(28% 0 0);
  --ring: oklch(78.9% 0.154 211.53);

  --card: oklch(24% 0 0);
  --popover: oklch(24% 0 0);

  --primary: oklch(78.9% 0.154 211.53);
  --primary-soft: oklch(30% 0.07 211.53);
  --primary-hover: oklch(72% 0.16 211.53);
  --primary-active: oklch(65% 0.17 211.53);
  --primary-foreground: oklch(15% 0.05 211.53);

  --secondary: oklch(28% 0 0);
  --secondary-soft: oklch(24% 0 0);
  --secondary-hover: oklch(34% 0 0);
  --secondary-active: oklch(40% 0 0);

  --muted: oklch(28% 0 0);
  --accent: oklch(28% 0 0);

  --destructive: oklch(65% 0.22 27);
  --destructive-soft: oklch(30% 0.1 27);
  --destructive-hover: oklch(58% 0.22 27);

  --success: oklch(70% 0.16 145);
  --success-soft: oklch(28% 0.07 145);
  --warning: oklch(80% 0.16 80);
  --warning-soft: oklch(30% 0.08 80);
  --info: oklch(72% 0.13 240);
  --info-soft: oklch(28% 0.07 240);
}

@layer base {
  h1, h2, h3, h4, h5, h6 {
    font-weight: 550;
    letter-spacing: -0.025em;
    font-variation-settings: 'opsz' 32;
  }
}
`
