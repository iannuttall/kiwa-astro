// Quick converter test harness — runs convertTsx() against saved registry samples
// in /tmp/kiwaui-samples and dumps results to /tmp/kiwa-astro-test-out for inspection.
//
// Usage: pnpm tsx src/test-convert.ts

import { readdir, readFile, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { convertTsx } from './convert.js'

const SAMPLES = '/tmp/kiwaui-samples'
const OUT = '/tmp/kiwa-astro-test-out'

async function main() {
  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })

  const files = (await readdir(SAMPLES)).filter((f) => f.endsWith('.json'))
  for (const f of files) {
    const raw = JSON.parse(await readFile(join(SAMPLES, f), 'utf8'))
    const file = raw.files[0]
    const baseName = file.name.replace(/\.tsx?$/, '')
    try {
      const result = convertTsx(file.content, baseName)
      const outDir = join(OUT, raw.name)
      await mkdir(outDir, { recursive: true })
      for (const af of result.astroFiles) {
        await writeFile(join(outDir, af.name), af.content)
      }
      await writeFile(join(outDir, result.barrel.name), result.barrel.content)
      console.log(`✓ ${raw.name} → ${result.astroFiles.length} astro + 1 barrel`)
    } catch (err) {
      console.error(`✗ ${raw.name}: ${(err as Error).message}`)
    }
  }
}

main()
