// Project config for kiwa-astro (per-project file: kiwa-astro.json).

import { readFile, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'

export type KiwaAstroConfig = {
  $schema?: string
  componentsDir: string // e.g. "src/components/ui"
  blocksDir: string // e.g. "src/components/blocks"
  utilsImport: string // e.g. "@/lib/utils"
  componentsImportBase: string // e.g. "@/components/ui"
  blocksImportBase: string // e.g. "@/components/blocks"
  libDir: string // e.g. "src/lib"
  installed: string[] // registry slugs
}

export const DEFAULT_CONFIG: KiwaAstroConfig = {
  componentsDir: 'src/components/ui',
  blocksDir: 'src/components/blocks',
  utilsImport: '@/lib/utils',
  componentsImportBase: '@/components/ui',
  blocksImportBase: '@/components/blocks',
  libDir: 'src/lib',
  installed: [],
}

export const CONFIG_FILENAME = 'kiwa-astro.json'

export async function readConfig(cwd: string): Promise<KiwaAstroConfig | null> {
  try {
    const raw = await readFile(join(cwd, CONFIG_FILENAME), 'utf8')
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return null
  }
}

export async function writeConfig(cwd: string, cfg: KiwaAstroConfig): Promise<void> {
  await writeFile(join(cwd, CONFIG_FILENAME), JSON.stringify(cfg, null, 2) + '\n', 'utf8')
}

export async function exists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

export async function isAstroProject(cwd: string): Promise<boolean> {
  const candidates = ['astro.config.mjs', 'astro.config.ts', 'astro.config.js', 'astro.config.cjs']
  for (const c of candidates) if (await exists(join(cwd, c))) return true
  return false
}
