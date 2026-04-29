# Converter fixes — 2026-04-29

Two converter bugs surfaced while scaffolding `~/vps/apps/salaryaftertaxes` and adding `footer-01`. Both are now fixed in `src/convert.ts`. Test harness (`pnpm tsx src/test-convert.ts`) still green across the eight sample components, and the salaryaftertaxes Astro project type-checks clean and builds clean HTML.

## 1. JSX inside frontmatter helpers

### Symptom

Adding `footer-01` produced an `.astro` file that failed to build:

```
Expected ">" but found "class"
  src/components/blocks/marketing/footer-01.astro:27:30
```

### Cause

The original `footer-01.tsx` declares a per-icon dispatch table:

```tsx
const socialIcons: Record<SocialLink['icon'], any> = {
  twitter: () => <XLogoIcon class="size-4" />,
  github: () => <GithubIcon class="size-4" />,
  ...
}
```

…and uses it in the JSX body:

```tsx
{socialLinks.map((social) => {
  const Icon = socialIcons[social.icon]
  return <a><Icon /></a>
})}
```

The previous converter inlined every helper verbatim into the Astro frontmatter. Astro frontmatter is parsed as plain TypeScript — JSX expressions there are a syntax error. The Kiwa UI source is valid TSX, but the destination is not.

### Fix

A new pass in `convertTsx` looks for any helper whose initializer is an `ObjectLiteralExpression` of arrow functions returning JSX. For each one we:

1. Skip the helper from frontmatter inlining (it would have been an Astro syntax error).
2. Emit a sibling component file named `<base>-<helperBase>-icon.astro`. Example: `footer-01-social-icon.astro`. The sibling takes a `name` prop and dispatches via inline ternaries:

   ```astro
   ---
   import { XLogoIcon, GithubIcon, ... } from '@/components/ui/social-icon'
   const { name, class: className } = Astro.props as { name: string; class?: string }
   ---
   {name === 'twitter' && (<XLogoIcon class="size-4" />)}
   {name === 'github' && (<GithubIcon class="size-4" />)}
   ...
   ```

3. Rewrite usages in the main component:
   - `const Local = helperName[expr]` lines are removed.
   - `<Local />` (and `<Local></Local>`) usages become `<SiblingComp name={expr} />`.

### Code

New types and functions in `src/convert.ts`:

- `JsxRecordHelper` — `{ helperName, componentName, fileName, cases: { key, jsx }[] }`.
- `parseJsxRecordHelper(stmt, baseName, sf)` — AST-based detection. Returns null if the helper isn't a uniform `Record<key, () => JSX>` shape.
- `emitJsxRecordFile(rec, imports, print)` — generates the sibling `.astro` file. Carries over only the imports referenced by any case's JSX (`importExportsAny`).
- `rewriteJsxRecordUsages(comp, recs)` — strips `const Local = helperName[expr]` from `jsxSource` / `blockBodySource` / `conditionalReturns` and rewrites the `<Local />` tags.

Plus wiring in `convertTsx` (build the `jsxRecords` list once, pass it to `emitAstro`) and in `emitAstro` (skip JSX helpers from frontmatter, import the siblings, run the rewrite over the JSX before rendering).

## 2. `social-icon.tsx` factory pattern broke the barrel

### Symptom

Building `~/vps/apps/salaryaftertaxes` after adding `footer-01` (which depends on `social-icon`) produced:

```
ReferenceError: createSocialIcon is not defined
  at .../dist/server/.prerender/chunks/index_*.mjs
```

### Cause

`social-icon.tsx` is structured as a higher-order factory:

```tsx
const createSocialIcon = (path: string): FC<SocialIconProps> => ({
  class: className,
  ...props
}) => (
  <svg ...><path d={path} /></svg>
)

export const FacebookIcon = createSocialIcon('M9.101...')
export const GithubIcon = createSocialIcon('M12.297...')
...
```

The previous converter:

- Saw `createSocialIcon` had JSX in its body → filtered it out of the `.ts` barrel (correct in isolation).
- Saw each `XIcon = createSocialIcon('...')` line had no JSX in its source → kept it in the barrel (also correct in isolation).
- Net result: the barrel referenced `createSocialIcon` without defining or importing it. SSR exploded the first time anything imported a social icon.

### Fix

Special-cased `social-icon.tsx` in `convertTsx` (same shape as the existing `icon.tsx` special case). New function `convertSocialIconTsx(sf)`:

- Walks exported variable declarations.
- For each `XIcon = createSocialIcon(stringLiteral)`, captures the SVG path string.
- Emits a per-icon `.astro` file (e.g. `facebook-icon.astro`) with the SVG inlined and the path baked in:

  ```astro
  ---
  const { class: className, ...props } = Astro.props as { class?: string; [key: string]: unknown }
  ---
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    class={className}
    {...props}
  >
    <path d="M9.101 23.691v-7.98H6.627v-3.667..." />
  </svg>
  ```

- Emits a `social-icon.ts` barrel that re-exports each `.astro` as a default export. No more reference to `createSocialIcon` at all — the factory is fully eliminated.

This mirrors how `icon.tsx` is handled: rather than translate the higher-order pattern, recognise the file by name and emit a flat per-symbol output.

## 3. Verification

```bash
# Converter unit smoke
cd ~/cli/kiwa-astro && pnpm tsx src/test-convert.ts
# → all 8 samples pass: accordion, badge, button, card, dialog, hero-01, input, separator

# Real-world Astro project
cd ~/vps/apps/salaryaftertaxes
pnpm typecheck   # 0 errors, 0 warnings, 2 hints
pnpm build       # renders prerendered /index.html cleanly

# Footer renders all six social icons with correct aria-labels
grep -oE 'aria-label="[A-Za-z]+"' dist/client/index.html | sort -u
# → aria-label="GitHub", "LinkedIn", "Twitter" (matches defaultSocialLinks)
```

## 4. Out of scope / follow-ups

- The detection regex for `JsxRecordHelper` only matches *uniform* records (every value is an arrow returning JSX). A mixed record (some JSX, some constants) would currently fall through to the old behaviour and break. Not seen in any registry item to date.
- `injectClassName` in the new sibling-file emitter is a no-op stub — relies on the original case's JSX already accepting `class` via spread. If a future block uses an icon set that doesn't, the sibling component's `className` prop will be ignored.
- The rewrite for `<Local />` usages is regex-based on the JSX source string. AST-based rewriting would be safer if a registry item ever uses the same `Local` identifier in two unrelated scopes within one component (uncommon, but possible).

## 5. Follow-up full-registry hardening

The first fixes were directionally right, but the full Kiwa UI registry exposed more real cases:

- direct JSX record lookups like `{icons[item.icon]}` in contact blocks
- ternary-selected JSX records like `isPrimary ? primaryIconMap[key] : iconMap[key]`
- JSX-valued component props such as `metadata={condition ? <span /> : <span />}`
- simple block bodies with setup statements before the final JSX return
- local helper export declarations such as `export { defaultProjects }`
- exported utility helpers that depend on private non-JSX helpers, e.g. `generateAreaPath()` calling `buildScales()`
- Pro import aliases under `@/components/blocks/pro/...`

The registry smoke test now installs every reachable item into a fresh Astro app, writes one page per block export, writes a UI primitive smoke page, runs `astro build`, starts `astro dev`, and fetches every page. With `KIWA_UI_TOKEN` set, this covers Pro items too.

Verification on 2026-04-29:

```bash
pnpm test:all
# unit converter tests: 15 pass
# representative Astro integration: pass
# full registry Astro build/dev/fetch: pass

pnpm audit --audit-level moderate
# No known vulnerabilities found

pnpm exec tsx src/cli.ts extract
# Found 212 items; extracted 212, skipped 0, failed 0
```
