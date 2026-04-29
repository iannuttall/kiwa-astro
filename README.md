# kiwa-astro

Convert Kiwa UI components and blocks to Astro.

Kiwa UI ships Hono JSX files through the official `@kiwa-ui/cli`. `kiwa-astro` fetches the same registry items, converts them to `.astro`, and writes them into Astro projects with small `.ts` barrels so imports stay clean.

This is intended as a local CLI. You do not need to install the upstream Kiwa UI CLI in your Astro project.

`kiwa-astro` is an independent tool and is not affiliated with, endorsed by, or maintained by Kiwa UI.

## Requirements

- Node.js 20+
- pnpm
- an Astro project
- optional: a Kiwa UI Pro license token for Pro blocks

## Install The Local CLI

```bash
git clone https://github.com/iannuttall/kiwa-astro.git
cd kiwa-astro
pnpm install
pnpm build
pnpm link --global
```

Check the command is available:

```bash
kiwa-astro --help
```

## Use In An Astro Project

Run these commands from the root of your Astro app:

```bash
kiwa-astro init
kiwa-astro add button
kiwa-astro add hero-01
```

Import the generated global CSS once, usually in your main layout:

```astro
---
import '@/styles/globals.css'
---
```

Then use generated components through their barrel files:

```astro
---
import { Button } from '@/components/ui/button'
import { Hero01 } from '@/components/blocks/marketing/hero-01'
---

<Hero01 />
<Button>Click me</Button>
```

## Pro Blocks

Free Kiwa UI items work without a token. Pro blocks require your own Kiwa UI license token:

```bash
export KIWA_UI_TOKEN=...
```

Then add Pro blocks as normal:

```bash
kiwa-astro add hero-03 pricing-04 footer-03
```

Keep the token in your shell or local environment. Do not commit it.

## Commands

```bash
kiwa-astro init
kiwa-astro add <name...> [--force]
kiwa-astro list [filter] [--free|--pro|--fresh]
kiwa-astro extract [--new] [--free-only]
```

`init` writes `kiwa-astro.json`, creates `src/lib/utils.ts` and `src/styles/globals.css`, installs runtime dependencies, and adds the `@/*` TypeScript path alias.

`add` resolves registry dependencies, converts `.tsx` files to Astro, installs npm dependencies declared by the registry item, and skips already-installed items unless `--force` is used.

`list` shows available Kiwa UI registry items. Use `--fresh` to fetch the latest index instead of the local cache.

`extract` mirrors raw and converted registry items to `~/.cache/kiwa-astro`.

## Updating The CLI

From this repo:

```bash
git pull
pnpm install
pnpm build
pnpm link --global
```

## Troubleshooting

If `kiwa-astro` is not found, relink it:

```bash
cd ~/cli/kiwa-astro
pnpm link --global
```

If a Pro block fails with `401` or `403`, check that the token is available:

```bash
test -n "$KIWA_UI_TOKEN" && echo "KIWA_UI_TOKEN is set"
```

If styles look broken, make sure `src/styles/globals.css` is imported once in your Astro app.

If imports like `@/components/ui/button` fail, check that `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Agent Skill

This repo includes a local skill for agents:

```bash
npx skills add iannuttall/kiwa-astro
```

## Development

```bash
pnpm test
pnpm test:integration
pnpm test:registry
pnpm test:all
```

`test:integration` creates a real Astro app, installs converted components, starts `astro dev`, and fetches the rendered page.

`test:registry` installs every reachable Kiwa UI registry item into a fresh Astro app and renders the generated pages. With `KIWA_UI_TOKEN` set, this includes Pro items.

## Security

Do not commit tokens, registry cache output, generated Pro blocks, `.env` files, or `~/.cache/kiwa-astro`. The CLI reads the token from the user environment and sends it to `registry.kiwaui.com` only when fetching registry items.
