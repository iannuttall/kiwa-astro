import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import kleur from 'kleur'

export async function writeFileSafe(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, 'utf8')
}

export const log = {
  info: (msg: string) => console.log(msg),
  ok: (msg: string) => console.log(kleur.green('✓') + ' ' + msg),
  warn: (msg: string) => console.warn(kleur.yellow('!') + ' ' + msg),
  err: (msg: string) => console.error(kleur.red('✗') + ' ' + msg),
  dim: (msg: string) => console.log(kleur.dim(msg)),
  bold: (msg: string) => console.log(kleur.bold(msg)),
}

export function pascalToKebab(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2').toLowerCase()
}
