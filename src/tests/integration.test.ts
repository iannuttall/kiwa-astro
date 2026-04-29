import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { spawn, type ChildProcess } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { getKiwaUiToken } from '../registry.js'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const cliPath = join(repoRoot, 'dist/cli.js')

test('installs converted components into a real Astro app and serves them', { timeout: 240_000 }, async () => {
  const parent = await mkdtemp(join(tmpdir(), 'kiwa-astro-integration-'))
  const project = join(parent, 'app')
  let dev: ChildProcess | null = null

  try {
    await run('pnpm', ['create', 'astro@latest', 'app', '--template', 'minimal', '--install', '--no-git', '--yes', '--skip-houston'], {
      cwd: parent,
      timeout: 120_000,
    })

    await run('node', [cliPath, 'init'], { cwd: project, timeout: 120_000 })

    const hero = getKiwaUiToken() ? 'hero-03' : 'hero-01'
    await run('node', [cliPath, 'add', 'button', 'content-02', 'features-02', hero], {
      cwd: project,
      timeout: 120_000,
    })

    const heroName = hero === 'hero-03' ? 'Hero03' : 'Hero01'
    await writeFile(
      join(project, 'src/pages/index.astro'),
      `---
import '../styles/globals.css'
import { Button } from '@/components/ui/button'
import { Content02 } from '@/components/blocks/marketing/content-02'
import { Features02 } from '@/components/blocks/marketing/features-02'
import { ${heroName} } from '@/components/blocks/marketing/${hero}'
---
<html lang="en">
  <body>
    <main>
      <Button>Loaded button</Button>
      <${heroName} />
      <Features02 />
      <Content02 />
    </main>
  </body>
</html>
`,
      'utf8',
    )

    await run('pnpm', ['exec', 'astro', 'build'], { cwd: project, timeout: 120_000 })

    const port = 39000 + Math.floor(Math.random() * 1000)
    dev = spawn('pnpm', ['exec', 'astro', 'dev', '--host', '127.0.0.1', '--port', String(port)], {
      cwd: project,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const html = await fetchWhenReady(`http://127.0.0.1:${port}/`, dev, 60_000)
    assert.match(html, /Loaded button/)
  } finally {
    if (dev) await stop(dev)
    await rm(parent, { recursive: true, force: true })
  }
})

function run(
  command: string,
  args: string[],
  opts: { cwd: string; timeout: number },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`${command} ${args.join(' ')} timed out\n${output.slice(-20_000)}`))
    }, opts.timeout)

    child.stdout.on('data', (chunk) => {
      output += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      output += chunk.toString()
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      code === 0
        ? resolve(output)
        : reject(new Error(`${command} ${args.join(' ')} exited ${code}\n${output.slice(-20_000)}`))
    })
  })
}

async function fetchWhenReady(url: string, child: ChildProcess, timeout: number): Promise<string> {
  const started = Date.now()
  let output = ''
  child.stdout?.on('data', (chunk) => {
    output += chunk.toString()
  })
  child.stderr?.on('data', (chunk) => {
    output += chunk.toString()
  })

  while (Date.now() - started < timeout) {
    if (child.exitCode !== null) throw new Error(`Astro dev server exited early\n${output.slice(-20_000)}`)
    try {
      const res = await fetch(url)
      if (res.ok) return await res.text()
    } catch {
      // Retry until the dev server is accepting connections.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`Astro dev server did not respond\n${output.slice(-20_000)}`)
}

function stop(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve()
    child.once('close', () => resolve())
    child.kill('SIGTERM')
    setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL')
    }, 3_000).unref()
  })
}
