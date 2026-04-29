import { readFile } from 'node:fs/promises'
import { CACHE_INDEX } from '../paths.js'
import { exists, readConfig } from '../config.js'
import { fetchIndex } from '../registry.js'
import { log } from '../util.js'

export async function list(argv: string[]) {
  const filter = argv.find((a) => !a.startsWith('--'))
  const showOnlyFree = argv.includes('--free')
  const showOnlyPro = argv.includes('--pro')

  let index
  if (await exists(CACHE_INDEX) && !argv.includes('--fresh')) {
    index = JSON.parse(await readFile(CACHE_INDEX, 'utf8'))
  } else {
    log.dim('Fetching registry index…')
    index = await fetchIndex()
  }

  const cfg = await readConfig(process.cwd()).catch(() => null)
  const installed = new Set(cfg?.installed ?? [])

  const filtered = index.filter((it: any) => {
    if (filter && !it.name.includes(filter) && !it.title.toLowerCase().includes(filter.toLowerCase())) return false
    if (showOnlyFree && !it.free) return false
    if (showOnlyPro && it.free) return false
    return true
  })

  for (const it of filtered) {
    const tag = it.free ? '       ' : ' [pro] '
    const flag = installed.has(it.name) ? '✓' : ' '
    console.log(`${flag} ${it.name.padEnd(36)}${tag}${it.title}`)
  }
  log.dim(`\n${filtered.length} item(s)`)
}
