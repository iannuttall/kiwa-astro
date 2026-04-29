// `kiwa-astro extract` — pull every registry item, convert it, write to ~/.cache/kiwa-astro.
// Use this to mirror the registry locally and pre-stage anything new.
//
// Layout:
//   ~/.cache/kiwa-astro/
//     index.json                  (latest seen index, used by sync to diff)
//     registry/<name>.json        (raw)
//     converted/<type>/<name>/    (.astro + .ts barrel, ready to copy)
//
// `--new` only fetches items not already in cache (incremental sync).

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { CACHE_REGISTRY, CACHE_CONVERTED, CACHE_INDEX } from '../paths.js'
import { exists } from '../config.js'
import { fetchIndex, fetchItem, type RegistryIndexItem, type RegistryItem } from '../registry.js'
import { log, writeFileSafe } from '../util.js'
import { prepareCachedRegistryFile } from '../install.js'

export async function extract(argv: string[]) {
  const onlyNew = argv.includes('--new')
  const includePro = !argv.includes('--free-only')

  log.info('Fetching registry index…')
  const index = await fetchIndex()
  log.ok(`Found ${index.length} items in registry`)

  await mkdir(CACHE_REGISTRY, { recursive: true })
  await mkdir(CACHE_CONVERTED, { recursive: true })

  const previous = await readPreviousIndex()
  const previousNames = new Set(previous.map((i) => i.name))

  const target = index.filter((i) => (includePro || i.free))
  let toProcess = target
  if (onlyNew) {
    toProcess = target.filter((i) => !previousNames.has(i.name))
    log.info(`--new: ${toProcess.length} new items since last extract`)
  }

  let ok = 0
  let skipped = 0
  let failed = 0

  for (const item of toProcess) {
    try {
      const raw = await fetchItem(item.name)
      await writeFile(join(CACHE_REGISTRY, `${item.name}.json`), JSON.stringify(raw, null, 2))
      await convertAndCache(raw)
      ok++
      log.dim(`  ${item.name}`)
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('Pro item requires KIWA_UI_TOKEN')) {
        skipped++
        log.dim(`  skip ${item.name} (no token)`)
      } else {
        failed++
        log.err(`${item.name}: ${msg}`)
      }
    }
  }

  await writeFile(CACHE_INDEX, JSON.stringify(index, null, 2))

  log.ok(`Extracted ${ok}, skipped ${skipped}, failed ${failed}`)
  if (failed) process.exitCode = 1
}

async function readPreviousIndex(): Promise<RegistryIndexItem[]> {
  if (!(await exists(CACHE_INDEX))) return []
  try {
    return JSON.parse(await readFile(CACHE_INDEX, 'utf8'))
  } catch {
    return []
  }
}

async function convertAndCache(item: RegistryItem) {
  for (const file of item.files) {
    const prepared = prepareCachedRegistryFile(file, item.name, CACHE_CONVERTED)
    for (const out of prepared.files) {
      await writeFileSafe(out.path, out.content)
    }
  }
}
