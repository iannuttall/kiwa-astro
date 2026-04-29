#!/usr/bin/env node
import { init } from './commands/init.js'
import { add } from './commands/add.js'
import { extract } from './commands/extract.js'
import { list } from './commands/list.js'
import { log } from './util.js'

const HELP = `kiwa-astro — Kiwa UI components for Astro

Usage:
  kiwa-astro init                    Set up the current Astro project (paths, lib/utils, globals.css, deps)
  kiwa-astro add <name…>             Convert and add components/blocks (resolves registryDependencies)
  kiwa-astro extract [--new] [--free-only]
                                     Mirror every registry item to ~/.cache/kiwa-astro (converted)
  kiwa-astro list [filter] [--free|--pro] [--fresh]
                                     List registry items (✓ = installed in current project)

Environment:
  KIWA_UI_TOKEN                   Required for Pro items (Bearer token from kiwaui.com).

Cache:
  ~/.cache/kiwa-astro/            Local mirror written by \`extract\`.
`

async function main() {
  const [, , cmd, ...rest] = process.argv
  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log(HELP)
    return
  }
  try {
    switch (cmd) {
      case 'init':
        return await init(rest)
      case 'add':
        return await add(rest)
      case 'extract':
        return await extract(rest)
      case 'list':
      case 'ls':
        return await list(rest)
      default:
        log.err(`Unknown command: ${cmd}`)
        console.log(HELP)
        process.exit(1)
    }
  } catch (err) {
    log.err((err as Error).message)
    process.exit(1)
  }
}

main()
