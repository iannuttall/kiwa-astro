import { relative } from 'node:path'
import { readConfig, writeConfig } from '../config.js'
import { resolveTree, type RegistryItem } from '../registry.js'
import { log, writeFileSafe } from '../util.js'
import { prepareRegistryFile } from '../install.js'
import { installPackages } from '../package-manager.js'

export async function add(argv: string[]) {
  const cwd = process.cwd()
  const cfg = await readConfig(cwd)
  if (!cfg) {
    log.err('No kiwa-astro.json in this directory. Run `kiwa-astro init` first.')
    process.exit(1)
  }

  const force = argv.includes('--force')
  const names = argv.filter((a) => !a.startsWith('--'))
  if (!names.length) {
    log.err('Usage: kiwa-astro add <name…> [--force]')
    process.exit(1)
  }

  log.info(`Resolving ${names.length} item(s) and dependencies…`)
  const tree = await resolveTree(names)
  log.ok(`Resolved ${tree.length} item(s) total`)

  const npmDeps = new Set<string>()
  const npmDevDeps = new Set<string>()
  let converted = 0
  let skipped = 0

  for (const item of tree) {
    if (cfg.installed.includes(item.name) && !force) {
      skipped++
      log.dim(`  skip ${item.name} (already installed; pass --force to overwrite)`)
      continue
    }

    for (const d of item.dependencies ?? []) npmDeps.add(d)
    for (const d of item.devDependencies ?? []) npmDevDeps.add(d)
    await writeItem(item, cfg, cwd)
    if (!cfg.installed.includes(item.name)) cfg.installed.push(item.name)
    converted++
  }

  await writeConfig(cwd, cfg)

  if (npmDeps.size) {
    log.info(`Installing npm deps: ${[...npmDeps].join(' ')}`)
    await installPackages(cwd, [...npmDeps])
  }
  if (npmDevDeps.size) {
    log.info(`Installing npm dev deps: ${[...npmDevDeps].join(' ')}`)
    await installPackages(cwd, [...npmDevDeps], { dev: true })
  }

  log.ok(`Added ${converted} item(s), skipped ${skipped}`)
}

export async function writeItem(item: RegistryItem, cfg: Awaited<ReturnType<typeof readConfig>>, cwd: string) {
  if (!cfg) throw new Error('config required')
  for (const file of item.files) {
    try {
      const prepared = prepareRegistryFile(file, cfg, cwd)
      for (const out of prepared.files) {
        await writeFileSafe(out.path, out.content)
        log.dim(`  wrote ${relative(cwd, out.path)}`)
      }
    } catch (err) {
      log.err(`Failed to convert ${item.name} (${file.path}): ${(err as Error).message}`)
      throw err
    }
  }
  log.ok(`Converted ${item.name}`)
}
