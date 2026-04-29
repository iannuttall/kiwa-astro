import { spawn } from 'node:child_process'
import { exists } from './config.js'
import { join } from 'node:path'

type PackageManager = 'pnpm' | 'bun' | 'yarn' | 'npm'

export async function installPackages(cwd: string, packages: string[], opts: { dev?: boolean } = {}): Promise<void> {
  if (!packages.length) return

  const pm = await detectPackageManager(cwd)
  const args = installArgs(pm, packages, opts.dev ?? false)
  await run(cwd, pm, args)
}

export async function detectPackageManager(cwd: string): Promise<PackageManager> {
  if (await exists(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (await exists(join(cwd, 'bun.lockb'))) return 'bun'
  if (await exists(join(cwd, 'bun.lock'))) return 'bun'
  if (await exists(join(cwd, 'yarn.lock'))) return 'yarn'
  if (await exists(join(cwd, 'package-lock.json'))) return 'npm'
  return 'pnpm'
}

function installArgs(pm: PackageManager, packages: string[], dev: boolean): string[] {
  if (pm === 'npm') return ['install', ...(dev ? ['-D'] : []), ...packages]
  if (pm === 'bun') return ['add', ...(dev ? ['-d'] : []), ...packages]
  return ['add', ...(dev ? ['-D'] : []), ...packages]
}

function run(cwd: string, command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', (code) => {
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`))
    })
  })
}
