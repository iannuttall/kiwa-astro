# Agent Rules

## Communication

- Be direct and informal.
- Keep explanations short unless the user asks for detail.
- Do not print secrets or token values.
- Do not commit generated registry output, caches, `.env` files, or Pro component source copied from a private token.

## Project

This repo is `kiwa-astro`, a CLI that converts Kiwa UI registry files from Hono JSX/TSX to Astro.

Public command:

```bash
kiwa-astro
```

The CLI reads Pro auth from `KIWA_UI_TOKEN`.

## Architecture

- `src/cli.ts`: command router and help text.
- `src/commands/*`: CLI commands.
- `src/registry.ts`: Kiwa registry client and token lookup.
- `src/install.ts`: safe path mapping from registry files to project files.
- `src/convert.ts`: small converter facade.
- `src/converter/*`: TS AST parsing, rewrites, Astro emitters, and special converters.
- `src/templates.ts`: files written by `kiwa-astro init`.
- `src/tests/*`: unit, Astro integration, and full registry smoke tests.

Keep `src/convert.ts` small. Put converter logic in focused modules under `src/converter/`.

## Coding Rules

- Prefer the existing TypeScript compiler API approach over ad hoc string parsing.
- Treat registry file paths as untrusted input.
- Preserve idempotency: do not overwrite installed items unless `--force` is passed.
- Use `kiwa-astro` in new docs, help text, configs, and examples.
- Keep the package publishable: bin scripts must run built `dist` files, not `src` through `tsx`.

## Verification

Run focused checks for small changes:

```bash
pnpm test
```

Run the real Astro app smoke after install/converter changes:

```bash
pnpm test:integration
```

Run full registry coverage after converter, registry, or path-mapping changes:

```bash
pnpm test:registry
```

Before publishing or handing off:

```bash
pnpm test:all
pnpm audit --audit-level moderate
npm pack --dry-run
```
