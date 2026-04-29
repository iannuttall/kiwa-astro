---
name: kiwa-astro
description: Use the `kiwa-astro` CLI to add Kiwa UI components and blocks to Astro projects. Trigger on requests to install, convert, test, audit, mirror, list, or debug Kiwa UI components for Astro; run `kiwa-astro init/add/extract/list`; use Pro Kiwa UI blocks with `KIWA_UI_TOKEN`; or explain the Hono JSX to Astro conversion pipeline.
---

# kiwa-astro

`kiwa-astro` converts Kiwa UI registry items from Hono JSX/TSX to Astro.

Use the command inside an Astro project:

```bash
kiwa-astro init
kiwa-astro add button
kiwa-astro add hero-01
kiwa-astro list
```

## Pro Items

Pro blocks require the user's own Kiwa UI license token:

```bash
export KIWA_UI_TOKEN=...
```

Never print or commit token values. To check presence only:

```bash
test -n "$KIWA_UI_TOKEN" && echo "Kiwa UI token is set"
```

## Output

`kiwa-astro init` writes:

- `kiwa-astro.json`
- `src/lib/utils.ts`
- `src/styles/globals.css`
- `@/*` path alias in `tsconfig.json`

`kiwa-astro add <name>` writes converted registry files under:

- `src/components/ui`
- `src/components/blocks`
- `src/lib`

Import generated components through their barrels:

```astro
---
import { Button } from '@/components/ui/button'
import { Hero01 } from '@/components/blocks/marketing/hero-01'
---
<Hero01 />
<Button>Click</Button>
```

## Conversion Rules

- `import type { FC, Child, JSX, PropsWithChildren } from 'hono/jsx'` is removed or rewritten.
- `JSX.IntrinsicElements['button']` becomes `HTMLAttributes<'button'>`.
- `PropsWithChildren<T>` becomes `T`.
- `{children}` becomes `<slot />`.
- JSX `key={...}` is removed.
- same-file sibling components are split to `.astro` files and imported locally.
- JSX-valued record helpers are extracted to sibling Astro components.
- JSX-valued component props are rewritten as Astro named slots.
- exported non-JSX helpers are preserved in `.ts` barrels.

## Checks

For CLI development:

```bash
pnpm test
pnpm test:integration
pnpm test:registry
pnpm audit --audit-level moderate
```

`test:registry` verifies every reachable Kiwa UI registry item in a real Astro app. With `KIWA_UI_TOKEN` set, it covers Pro items too.
