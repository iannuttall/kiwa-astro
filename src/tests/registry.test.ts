import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm, readdir, readFile } from 'node:fs/promises'
import { spawn, type ChildProcess } from 'node:child_process'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { getKiwaUiToken, KIWA_UI_REGISTRY } from '../registry.js'

type RegistryIndexItem = {
  name: string
  type: 'ui' | 'block'
  free: boolean
}

type ExportInfo = {
  name: string
  importPath: string
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const cliPath = join(repoRoot, 'dist/cli.js')

test('installs and renders every available Kiwa UI block in Astro', { timeout: 600_000 }, async () => {
  const index = await fetchRegistryIndex()
  const includePro = !!getKiwaUiToken()
  const target = includePro ? index : index.filter((item) => item.free)
  const names = target.map((item) => item.name)
  assert.ok(names.length > 0, 'registry returned at least one item')

  const parent = await mkdtemp(join(tmpdir(), 'kiwa-astro-registry-'))
  const project = join(parent, 'app')
  let dev: ChildProcess | null = null

  try {
    await run('pnpm', ['create', 'astro@latest', 'app', '--template', 'minimal', '--install', '--no-git', '--yes', '--skip-houston'], {
      cwd: parent,
      timeout: 120_000,
    })

    await run('node', [cliPath, 'init'], { cwd: project, timeout: 120_000 })
    await run('node', [cliPath, 'add', ...names], { cwd: project, timeout: 360_000 })

    const blocks = await collectComponentExports(project, join(project, 'src/components/blocks'))
    assert.ok(blocks.length > 0, 'installed block barrels expose components')

    const pages = chunk(blocks, 1)
    await writeRegistryIndexPage(project, pages.length, includePro, names.length)
    for (let i = 0; i < pages.length; i++) {
      await writeBlockPage(project, i + 1, pages[i])
    }

    await writeUiSmokePage(project)
    await run('pnpm', ['exec', 'astro', 'build'], { cwd: project, timeout: 240_000 })

    const port = 40000 + Math.floor(Math.random() * 1000)
    dev = spawn('pnpm', ['exec', 'astro', 'dev', '--host', '127.0.0.1', '--port', String(port)], {
      cwd: project,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const devOutput = { value: '' }
    dev.stdout?.on('data', (chunk) => {
      devOutput.value += chunk.toString()
    })
    dev.stderr?.on('data', (chunk) => {
      devOutput.value += chunk.toString()
    })

    await fetchWhenReady(`http://127.0.0.1:${port}/`, dev, 60_000, devOutput)
    await fetchWhenReady(`http://127.0.0.1:${port}/ui`, dev, 60_000, devOutput)
    for (let i = 0; i < pages.length; i++) {
      const html = await fetchWhenReady(`http://127.0.0.1:${port}/blocks-${i + 1}`, dev, 60_000, devOutput)
      assert.match(html, new RegExp(`data-block-page="${i + 1}"`))
    }
  } finally {
    if (dev) await stop(dev)
    await rm(parent, { recursive: true, force: true })
  }
})

async function fetchRegistryIndex(): Promise<RegistryIndexItem[]> {
  const res = await fetch(`${KIWA_UI_REGISTRY}/r/index.json`)
  if (!res.ok) throw new Error(`registry index failed: ${res.status}`)
  return (await res.json()) as RegistryIndexItem[]
}

async function collectComponentExports(project: string, root: string): Promise<ExportInfo[]> {
  const files = await walk(root)
  const barrels = files.filter((file) => file.endsWith('.ts'))
  const exports: ExportInfo[] = []
  for (const file of barrels) {
    const source = await readFile(file, 'utf8')
    const slug = file.split(sep).at(-1)?.replace(/\.ts$/, '') ?? ''
    const expected = pascalCase(slug)
    const names = [...source.matchAll(/export \{ default as ([A-Z][A-Za-z0-9_]*) \}/g)].map((match) => match[1])
    const name = names.includes(expected) ? expected : names[0]
    if (!name) continue
    exports.push({ name, importPath: aliasImport(project, file) })
  }
  return exports.sort((a, b) => a.importPath.localeCompare(b.importPath))
}

async function walk(root: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(path)))
    else out.push(path)
  }
  return out
}

function aliasImport(project: string, file: string): string {
  const src = join(project, 'src')
  const rel = relative(src, file).replace(/\\/g, '/').replace(/\.ts$/, '')
  return `@/${rel}`
}

async function writeRegistryIndexPage(project: string, pageCount: number, includePro: boolean, itemCount: number) {
  const links = Array.from({ length: pageCount }, (_, i) => `<li><a href="/blocks-${i + 1}">Blocks ${i + 1}</a></li>`)
    .join('\n')
  await writeFile(
    join(project, 'src/pages/index.astro'),
    `---
import '../styles/globals.css'
---
<html lang="en">
  <body>
    <main data-registry-smoke data-pro="${includePro}" data-items="${itemCount}">
      <a href="/ui">UI smoke</a>
      <ul>${links}</ul>
    </main>
  </body>
</html>
`,
    'utf8',
  )
}

async function writeBlockPage(project: string, pageNumber: number, blocks: ExportInfo[]) {
  const imports = blocks
    .map((block, i) => `import { ${block.name} as Block${i} } from '${block.importPath}'`)
    .join('\n')
  const renders = blocks
    .map((block, i) => `<section data-block="${escapeHtml(block.importPath)}"><Block${i}${smokePropsFor(block, i)} /></section>`)
    .join('\n')
  await writeFile(
    join(project, `src/pages/blocks-${pageNumber}.astro`),
    `---
import '../styles/globals.css'
${imports}
---
<html lang="en">
  <body>
    <main data-block-page="${pageNumber}">
      ${renders}
    </main>
  </body>
</html>
`,
    'utf8',
  )
}

async function writeUiSmokePage(project: string) {
  await writeFile(
    join(project, 'src/pages/ui.astro'),
    `---
import '../styles/globals.css'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert } from '@/components/ui/alert'
import { AlertDialog, AlertDialogContent, AlertDialogOverlay, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { AvatarStack } from '@/components/ui/avatar-stack'
import { Badge } from '@/components/ui/badge'
import { BlogPostCard } from '@/components/ui/blog-post-card'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList } from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ContentCard } from '@/components/ui/content-card'
import { DatePicker } from '@/components/ui/date-picker'
import { Dialog, DialogContent, DialogOverlay, DialogTitle } from '@/components/ui/dialog'
import { DisplayCard } from '@/components/ui/display-card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Empty } from '@/components/ui/empty'
import { FormField } from '@/components/ui/form-field'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { SearchIcon } from '@/components/ui/icon'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Label } from '@/components/ui/label'
import { Pagination } from '@/components/ui/pagination'
import { PlaceholderGradient } from '@/components/ui/placeholder-gradient'
import { PlaceholderLogo } from '@/components/ui/placeholder-logo'
import { Popover } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { SegmentedProgress } from '@/components/ui/segmented-progress'
import { SelectCustom, SelectCustomContent, SelectCustomItem, SelectCustomTrigger } from '@/components/ui/select-custom'
import { Select } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetOverlay, SheetTitle } from '@/components/ui/sheet'
import { SidebarCollapsible } from '@/components/ui/sidebar-collapsible'
import { SidebarItem } from '@/components/ui/sidebar-item'
import { SidebarMenuButton } from '@/components/ui/sidebar-menu-button'
import { Slider } from '@/components/ui/slider'
import { GithubIcon } from '@/components/ui/social-icon'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
---
<html lang="en">
  <body>
    <main data-ui-smoke>
      <Accordion><AccordionItem value="one"><AccordionTrigger>One</AccordionTrigger><AccordionContent>Content</AccordionContent></AccordionItem></Accordion>
      <Alert>Alert</Alert>
      <AlertDialog open><AlertDialogOverlay /><AlertDialogContent><AlertDialogTitle>Alert dialog</AlertDialogTitle></AlertDialogContent></AlertDialog>
      <Avatar><AvatarFallback>AB</AvatarFallback></Avatar>
      <AvatarStack avatars={[{ name: 'Ada Byron' }, { name: 'Charles Duke' }]} />
      <Badge>Badge</Badge>
      <BlogPostCard post={{ title: 'Post', excerpt: 'Description', category: 'News', date: 'Today', href: '#', author: { name: 'Ada Byron' } }} />
      <Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink href="#">Home</BreadcrumbLink></BreadcrumbItem></BreadcrumbList></Breadcrumb>
      <Button>Button</Button>
      <Card><CardHeader><CardTitle>Card</CardTitle></CardHeader><CardContent>Body</CardContent></Card>
      <Checkbox />
      <Collapsible><CollapsibleTrigger>Open</CollapsibleTrigger><CollapsibleContent>Hidden</CollapsibleContent></Collapsible>
      <ContentCard>Content card</ContentCard>
      <DatePicker />
      <Dialog open><DialogOverlay /><DialogContent><DialogTitle>Dialog</DialogTitle></DialogContent></Dialog>
      <DisplayCard>Display</DisplayCard>
      <DropdownMenu><DropdownMenuTrigger><Button>Menu</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem>Item</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      <Empty title="Empty" description="Nothing here" />
      <FormField label="Name"><Input /></FormField>
      <HoverCard><HoverCardTrigger>Hover</HoverCardTrigger><HoverCardContent>Card</HoverCardContent></HoverCard>
      <SearchIcon />
      <Input placeholder="Input" />
      <Kbd>K</Kbd>
      <Label>Label</Label>
      <Pagination page={1} totalPages={3} />
      <PlaceholderGradient />
      <PlaceholderLogo name="Acme" />
      <Popover id="test-popover">Popover</Popover>
      <Progress value={50} />
      <RadioGroup><RadioGroupItem value="a" /></RadioGroup>
      <SegmentedProgress value={2} max={4} />
      <Select name="native"><option>One</option></Select>
      <SelectCustom name="custom"><SelectCustomTrigger>One</SelectCustomTrigger><SelectCustomContent><SelectCustomItem value="one">One</SelectCustomItem></SelectCustomContent></SelectCustom>
      <Separator />
      <Sheet open><SheetOverlay /><SheetContent><SheetTitle>Sheet</SheetTitle></SheetContent></Sheet>
      <SidebarCollapsible label="Group">Item</SidebarCollapsible>
      <SidebarItem href="#">Item</SidebarItem>
      <SidebarMenuButton>Menu Button</SidebarMenuButton>
      <Slider value={50} />
      <GithubIcon />
      <Spinner />
      <Switch />
      <Table><TableHeader><TableRow><TableHead>Head</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>Cell</TableCell></TableRow></TableBody></Table>
      <Tabs defaultValue="one"><TabsList><TabsTrigger value="one">One</TabsTrigger></TabsList><TabsContent value="one">Tab</TabsContent></Tabs>
      <Textarea>Text</Textarea>
      <Toggle>Toggle</Toggle>
      <ToggleGroup><ToggleGroupItem value="one">One</ToggleGroupItem></ToggleGroup>
      <Tooltip><TooltipTrigger>Tip</TooltipTrigger><TooltipContent>Tooltip</TooltipContent></Tooltip>
    </main>
  </body>
</html>
`,
    'utf8',
  )
}

function pascalCase(s: string): string {
  return s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function smokePropsFor(block: ExportInfo, index: number): string {
  const id = `kiwa-astro-smoke-${index}`
  const props = [`id="${id}"`, `idPrefix="${id}"`, `breadcrumbs={[{ label: 'Dashboard', href: '#' }, { label: 'Smoke' }]}`]

  if (block.name === 'ChatSettingsControl') {
    return ` id="${id}"`
  }

  if (block.name === 'ChatMessage') {
    props.push(`role="assistant"`, `content="Registry smoke message"`, `name="Agent"`, `timestamp="Now"`)
  }

  if (block.name === 'FilterChip') {
    props.push(
      `category="Status"`,
      `value="active"`,
      `options={[{ value: 'active', label: 'Active' }, { value: 'pending', label: 'Pending' }]}`,
    )
  }

  if (block.name === 'FilterPopover') {
    props.push(`categories={[]}`)
  }

  if (block.name === 'ProjectCard') {
    props.push(
      `project={{ name: 'Smoke project', description: 'Registry smoke project', status: 'Active', members: [] }}`,
    )
  }

  return ` ${props.join(' ')}`
}

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
      reject(new Error(`${command} ${args.join(' ')} timed out\n${output.slice(-30_000)}`))
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
        : reject(new Error(`${command} ${args.join(' ')} exited ${code}\n${output.slice(-30_000)}`))
    })
  })
}

async function fetchWhenReady(
  url: string,
  child: ChildProcess,
  timeout: number,
  output: { value: string },
): Promise<string> {
  const started = Date.now()

  while (Date.now() - started < timeout) {
    if (child.exitCode !== null) throw new Error(`Astro dev server exited early\n${output.value.slice(-30_000)}`)
    try {
      const res = await fetch(url)
      if (res.ok) return await res.text()
    } catch {
      // Retry until Astro starts listening.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`Astro dev server did not respond\n${output.value.slice(-30_000)}`)
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
