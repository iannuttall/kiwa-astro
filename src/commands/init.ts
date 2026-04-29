import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { DEFAULT_CONFIG, exists, isAstroProject, readConfig, writeConfig } from '../config.js'
import { GLOBALS_CSS, UTILS_TS } from '../templates.js'
import { log, writeFileSafe } from '../util.js'
import { installPackages } from '../package-manager.js'

export async function init(argv: string[]) {
  const cwd = process.cwd()
  const force = argv.includes('--force')

  if (!(await isAstroProject(cwd))) {
    log.err('No Astro config found in this directory.')
    log.dim('Run `pnpm create astro@latest` first, or pass --force to override.')
    if (!force) process.exit(1)
  }

  const existing = await readConfig(cwd)
  if (existing && !force) {
    log.warn('kiwa-astro.json already exists. Pass --force to overwrite.')
    process.exit(1)
  }

  const cfg = { ...DEFAULT_CONFIG }
  await writeConfig(cwd, cfg)
  log.ok('Wrote kiwa-astro.json')

  const utilsPath = join(cwd, 'src/lib/utils.ts')
  if (!(await exists(utilsPath)) || force) {
    await writeFileSafe(utilsPath, UTILS_TS)
    log.ok('Created src/lib/utils.ts')
  } else {
    log.dim('src/lib/utils.ts already exists, skipping')
  }

  const cssPath = join(cwd, 'src/styles/globals.css')
  if (!(await exists(cssPath)) || force) {
    await writeFileSafe(cssPath, GLOBALS_CSS)
    log.ok('Created src/styles/globals.css')
  } else {
    log.dim('src/styles/globals.css already exists, skipping')
  }

  // Make sure tsconfig has @/ path alias.
  await ensurePathAlias(cwd)

  // Install runtime deps.
  log.info('Installing clsx tailwind-merge lucide …')
  await installPackages(cwd, ['clsx', 'tailwind-merge', 'lucide'])
  log.info('Installing Tailwind CSS …')
  await installPackages(cwd, ['tailwindcss'], { dev: true })
  log.ok('Dependencies installed')

  log.info('')
  log.bold('Next steps:')
  log.dim('  1. Add `import "./styles/globals.css"` (or wherever your global CSS is loaded).')
  log.dim('  2. Add a component:   kiwa-astro add button')
  log.dim('  3. Add a free hero:   kiwa-astro add hero-01')
  log.dim('  4. Or extract everything to local cache:   kiwa-astro extract')
}

async function ensurePathAlias(cwd: string): Promise<void> {
  const tsconfigPath = join(cwd, 'tsconfig.json')
  if (!(await exists(tsconfigPath))) {
    log.warn('No tsconfig.json found — add `@/*` path alias yourself.')
    return
  }
  const raw = await readFile(tsconfigPath, 'utf8')
  if (raw.includes('"@/*"')) {
    log.dim('tsconfig.json already has @/ alias')
    return
  }

  try {
    const json = JSON.parse(raw) as {
      compilerOptions?: {
        baseUrl?: string
        paths?: Record<string, string[]>
      }
    }
    json.compilerOptions ??= {}
    json.compilerOptions.baseUrl ??= '.'
    json.compilerOptions.paths ??= {}
    json.compilerOptions.paths['@/*'] = ['./src/*']
    await writeFile(tsconfigPath, JSON.stringify(json, null, 2) + '\n', 'utf8')
    log.ok('Added @/ alias to tsconfig.json')
  } catch {
    log.warn('Could not parse tsconfig.json. Add this to compilerOptions yourself:')
    log.dim('   "baseUrl": ".",')
    log.dim('   "paths": { "@/*": ["./src/*"] }')
  }
}
