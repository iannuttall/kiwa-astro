import test from 'node:test'
import assert from 'node:assert/strict'
import { convertTsx } from '../convert.js'
import { validateRegistryPath, safeProjectDir } from '../install.js'
import { getKiwaUiToken } from '../registry.js'

test('rewrites Hono children, key attributes, and JSX types for Astro', () => {
  const result = convertTsx(
    `import type { FC, Child } from 'hono/jsx'
export type ButtonProps = JSX.IntrinsicElements['button'] & { children?: Child }
export const Button: FC<ButtonProps> = ({ children, class: className, ...props }) => (
  <button key="stable" class={className} {...props}>{children || <span>Fallback</span>}</button>
)`,
    'button',
  )

  const astro = result.astroFiles.find((file) => file.name === 'button.astro')?.content ?? ''
  assert.match(astro, /import type \{ HTMLAttributes \} from 'astro\/types'/)
  assert.match(astro, /<slot><span>Fallback<\/span><\/slot>/)
  assert.doesNotMatch(astro, /\bkey=/)
  assert.doesNotMatch(astro, /hono\/jsx/)
  assert.doesNotMatch(astro, /\bChild\b/)
  assert.match(result.barrel.content, /export type ButtonProps = HTMLAttributes<'button'>/)
})

test('adds same-file sibling imports for split Astro components', () => {
  const result = convertTsx(
    `export const LogoIcon = () => <svg><path d="M0 0h1v1" /></svg>
export const Logo = () => <div><LogoIcon /></div>`,
    'logo',
  )

  const logo = result.astroFiles.find((file) => file.name === 'logo.astro')?.content ?? ''
  assert.match(logo, /import LogoIcon from '\.\/logo-icon\.astro'/)
})

test('converts icon registry helpers without JSX in the TypeScript barrel', () => {
  const result = convertTsx(
    `import { ArrowRight, Menu } from 'lucide'
const createIcon = (iconNode: unknown) => () => <svg />
export const ArrowRightIcon = createIcon(ArrowRight)
export const MenuIcon = createIcon(Menu)`,
    'icon',
  )

  assert.ok(result.astroFiles.some((file) => file.name === 'icon.astro'))
  assert.ok(result.astroFiles.some((file) => file.name === 'arrow-right-icon.astro'))
  assert.match(result.barrel.content, /export \{ default as ArrowRightIcon \}/)
  assert.doesNotMatch(result.barrel.content, /<svg|createIcon/)
})

test('converts social-icon factory exports into flat Astro files', () => {
  const result = convertTsx(
    `import type { FC } from 'hono/jsx'
type SocialIconProps = { class?: string }
const createSocialIcon = (path: string): FC<SocialIconProps> => ({ class: className }) => (
  <svg class={className}><path d={path} /></svg>
)
export const GithubIcon = createSocialIcon('M0 0h1v1')
export const XLogoIcon = createSocialIcon('M1 1h2v2')`,
    'social-icon',
  )

  const github = result.astroFiles.find((file) => file.name === 'github-icon.astro')?.content ?? ''
  assert.match(github, /<path d="M0 0h1v1" \/>/)
  assert.match(result.barrel.content, /export \{ default as GithubIcon \}/)
  assert.doesNotMatch(result.barrel.content, /createSocialIcon|<svg/)
})

test('extracts JSX record helpers and rewrites local icon variables', () => {
  const result = convertTsx(
    `import type { FC } from 'hono/jsx'
import { GithubIcon, XLogoIcon } from '@/components/ui/social-icon'
type Link = { icon: 'github' | 'x'; href: string }
const socialIcons: Record<Link['icon'], FC> = {
  github: () => <GithubIcon class="size-4" />,
  x: () => <XLogoIcon class="size-4" />,
}
export const Footer = ({ links = [{ icon: 'github', href: '#' }] }: { links?: Link[] }) => (
  <footer>
    {links.map((link) => {
      const Icon = socialIcons[link.icon]
      return <a href={link.href}><Icon /></a>
    })}
  </footer>
)`,
    'footer',
  )

  const footer = result.astroFiles.find((file) => file.name === 'footer.astro')?.content ?? ''
  assert.ok(result.astroFiles.some((file) => file.name === 'footer-social-icon.astro'))
  assert.match(footer, /import FooterSocialIcon from '\.\/footer-social-icon\.astro'/)
  assert.match(footer, /<FooterSocialIcon name=\{link\.icon\} \/>/)
  assert.doesNotMatch(footer, /const Icon = socialIcons|<Icon\s*\/>|socialIcons:/)
})

test('extracts direct JSX record helper lookups from templates', () => {
  const result = convertTsx(
    `import { MailIcon, PhoneIcon } from '@/components/ui/icon'
const icons = {
  email: <MailIcon class="size-4" />,
  phone: <PhoneIcon class="size-4" />,
}
export const Contact = ({ items = [{ icon: 'email', label: 'Email' }] }) => (
  <div>{items.map((item) => <span>{icons[item.icon]}{item.label}</span>)}</div>
)`,
    'contact',
  )

  const contact = result.astroFiles.find((file) => file.name === 'contact.astro')?.content ?? ''
  assert.ok(result.astroFiles.some((file) => file.name === 'contact-icon.astro'))
  assert.match(contact, /<ContactIcon name=\{item\.icon\} \/>/)
  assert.doesNotMatch(contact, /icons\[item\.icon\]/)
  assert.doesNotMatch(result.barrel.content, /<MailIcon/)
})

test('rewrites ternary-selected JSX record helpers', () => {
  const result = convertTsx(
    `import type { FC } from 'hono/jsx'
import { ChartIcon, TrendUpIcon } from '@/components/ui/icon'
type Metric = { icon: 'trend-up' | 'chart'; value: string }
const iconMap: Record<Metric['icon'], FC> = {
  'trend-up': () => <TrendUpIcon class="text-foreground" />,
  chart: () => <ChartIcon class="text-foreground" />,
}
const primaryIconMap: Record<Metric['icon'], FC> = {
  'trend-up': () => <TrendUpIcon class="text-primary-foreground" />,
  chart: () => <ChartIcon class="text-primary-foreground" />,
}
export const Metrics = ({ metrics = [{ icon: 'trend-up', value: '10' }] }: { metrics?: Metric[] }) => (
  <section>
    {metrics.map((metric, index) => {
      const isPrimary = index === 0
      const Icon = isPrimary ? primaryIconMap[metric.icon] : iconMap[metric.icon]
      return <div><Icon class="size-5" />{metric.value}</div>
    })}
  </section>
)`,
    'metrics',
  )

  const metrics = result.astroFiles.find((file) => file.name === 'metrics.astro')?.content ?? ''
  assert.ok(result.astroFiles.some((file) => file.name === 'metrics-icon-map-icon.astro'))
  assert.ok(result.astroFiles.some((file) => file.name === 'metrics-primary-icon-map-icon.astro'))
  assert.match(metrics, /isPrimary \? \(<MetricsPrimaryIconMapIcon name=\{metric\.icon\} class="size-5" \/>\)/)
  assert.match(metrics, /: \(<MetricsIconMapIcon name=\{metric\.icon\} class="size-5" \/>\)/)
  assert.doesNotMatch(metrics, /const Icon = isPrimary|<Icon|primaryIconMap\[|iconMap\[/)
})

test('moves block-body early-return JSX into the Astro template', () => {
  const result = convertTsx(
    `type AlertProps = { tone: 'info' | 'danger'; class?: string }
export const Alert = ({ tone, class: className }: AlertProps) => {
  if (tone === 'danger') {
    const label = 'Danger'
    return <section key={tone} class={className}>{label}</section>
  }

  return <section class={className}>Info</section>
}`,
    'alert',
  )

  const astro = result.astroFiles.find((file) => file.name === 'alert.astro')?.content ?? ''
  assert.match(astro, /tone === 'danger' \?/)
  assert.match(astro, /const label = 'Danger'/)
  assert.doesNotMatch(astro.split('---')[1], /return <section/)
  assert.doesNotMatch(astro, /\(\(\) =>/)
  assert.doesNotMatch(astro, /\bkey=/)
})

test('keeps setup statements for simple block bodies in Astro frontmatter', () => {
  const result = convertTsx(
    `export const Calendar = () => {
  const values: number[] = []
  for (let day = 1; day <= 3; day++) {
    values.push(day)
  }

  return <div>{values.map((value) => <span>{value}</span>)}</div>
}`,
    'calendar',
  )

  const astro = result.astroFiles.find((file) => file.name === 'calendar.astro')?.content ?? ''
  const [, frontmatter, template] = astro.split('---')
  assert.match(frontmatter, /for \(let day = 1; day <= 3; day\+\+\)/)
  assert.doesNotMatch(template, /for \(let day = 1; day <= 3; day\+\+\)/)
  assert.match(template, /<div>/)
})

test('normalizes upstream Pro block import aliases to installed Astro paths', () => {
  const result = convertTsx(
    `import { ChatSettingsControl } from '@/components/blocks/pro/ai/_shared/chat-settings-control'
import { SocialProof06 } from '@/components/blocks/pro/marketing/social-proof-06'
export const Header = () => <div><ChatSettingsControl /><SocialProof06 /></div>`,
    'header',
  )

  const astro = result.astroFiles.find((file) => file.name === 'header.astro')?.content ?? ''
  assert.match(astro, /@\/components\/blocks\/ai\/_shared\/chat-settings-control/)
  assert.match(astro, /@\/components\/blocks\/marketing\/social-proof-06/)
  assert.doesNotMatch(astro, /@\/components\/blocks\/pro\//)
})

test('preserves local helper export declarations in the TypeScript barrel', () => {
  const result = convertTsx(
    `const defaultItems = [{ label: 'One' }]
const statusColors: Record<string, string> = { active: 'bg-success' }
export { defaultItems, statusColors }
export const ProjectCard = ({ item = defaultItems[0] }) => <div>{item.label}</div>`,
    'project-card',
  )

  assert.match(result.barrel.content, /const defaultItems = \[/)
  assert.match(result.barrel.content, /const statusColors: Record<string, string>/)
  assert.match(result.barrel.content, /export \{ defaultItems, statusColors \}/)
})

test('keeps private helper dependencies used by exported utility helpers', () => {
  const result = convertTsx(
    `function buildScales(values: number[]) {
  return values.map((value) => value * 2)
}
export function generatePath(values: number[]) {
  return buildScales(values).join(',')
}`,
    'chart',
  )

  assert.match(result.barrel.content, /function buildScales/)
  assert.match(result.barrel.content, /export function generatePath/)
})

test('rewrites JSX-valued component props into Astro named slots', () => {
  const result = convertTsx(
    `const Header = () => <div>Header</div>
const Sidebar = () => <aside>Sidebar</aside>
export const Layout = () => (
  <Shell
    header={<Header />}
    sidebarContent={<Sidebar />}
    class="layout"
  >
    Body
  </Shell>
)`,
    'layout',
  )

  const astro = result.astroFiles.find((file) => file.name === 'layout.astro')?.content ?? ''
  assert.match(astro, /<Fragment slot="header"><Header \/><\/Fragment>/)
  assert.match(astro, /<Fragment slot="sidebarContent"><Sidebar \/><\/Fragment>/)
  assert.doesNotMatch(astro, /header=\{<Header|sidebarContent=\{<Sidebar/)
})

test('rewrites conditional JSX-valued component props into Astro named slots', () => {
  const result = convertTsx(
    `export const Stats = ({ good = true }) => (
  <ContentCard
    metadata={
      good ? (
        <span class="text-success">Up</span>
      ) : (
        <span class="text-danger">Down</span>
      )
    }
  >
    Value
  </ContentCard>
)`,
    'stats',
  )

  const astro = result.astroFiles.find((file) => file.name === 'stats.astro')?.content ?? ''
  assert.match(astro, /<Fragment slot="metadata">\{good \? \(/)
  assert.match(astro, /<span class="text-success">Up<\/span>/)
  assert.match(astro, /<span class="text-danger">Down<\/span>/)
  assert.doesNotMatch(astro, /metadata=\{/)
})

test('rejects unsafe registry paths and output directories', () => {
  assert.throws(() => validateRegistryPath('../x.tsx'), /Unsafe registry file path/)
  assert.throws(() => validateRegistryPath('/x.tsx'), /must be relative/)
  assert.throws(() => validateRegistryPath('components\\ui\\button.tsx'), /POSIX separators/)
  assert.throws(() => safeProjectDir('/tmp/project', '../outside'), /inside the project/)
})

test('reads KIWA_UI_TOKEN for Pro registry auth', () => {
  const originalKiwa = process.env.KIWA_UI_TOKEN

  try {
    delete process.env.KIWA_UI_TOKEN
    assert.equal(getKiwaUiToken(), undefined)

    process.env.KIWA_UI_TOKEN = 'current'
    assert.equal(getKiwaUiToken(), 'current')
  } finally {
    if (originalKiwa === undefined) delete process.env.KIWA_UI_TOKEN
    else process.env.KIWA_UI_TOKEN = originalKiwa
  }
})
