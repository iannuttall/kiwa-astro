// Kiwa UI registry client.
// Public index is unauthed. Pro items require a Bearer token.

export const KIWA_UI_REGISTRY = 'https://registry.kiwaui.com'

export type RegistryIndexItem = {
  name: string
  type: 'ui' | 'block'
  title: string
  description: string
  free: boolean
}

export type RegistryFile = {
  name: string
  path: string
  content: string
}

export type RegistryItem = {
  name: string
  type: 'ui' | 'block'
  title: string
  description: string
  dependencies?: string[]
  devDependencies?: string[]
  registryDependencies?: string[]
  files: RegistryFile[]
  meta?: { free?: boolean; category?: string }
}

function authHeaders(): Record<string, string> {
  const token = getKiwaUiToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function getKiwaUiToken(): string | undefined {
  return process.env.KIWA_UI_TOKEN
}

export async function fetchIndex(): Promise<RegistryIndexItem[]> {
  const res = await fetch(`${KIWA_UI_REGISTRY}/r/index.json`)
  if (!res.ok) throw new Error(`Registry index ${res.status}: ${await res.text()}`)
  return (await res.json()) as RegistryIndexItem[]
}

export async function fetchItem(name: string): Promise<RegistryItem> {
  const res = await fetch(`${KIWA_UI_REGISTRY}/r/${name}.json`, { headers: authHeaders() })
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `${name}: Pro item requires KIWA_UI_TOKEN (got ${res.status}). Set KIWA_UI_TOKEN in your env.`,
    )
  }
  if (!res.ok) throw new Error(`Registry ${name} ${res.status}: ${await res.text()}`)
  return (await res.json()) as RegistryItem
}

// Topologically resolve all transitive registryDependencies of `roots`.
// Returns items in install order (deps before dependents).
export async function resolveTree(roots: string[]): Promise<RegistryItem[]> {
  const seen = new Map<string, RegistryItem>()
  const order: string[] = []

  async function visit(name: string) {
    if (seen.has(name)) return
    const item = await fetchItem(name)
    seen.set(name, item)
    for (const dep of item.registryDependencies ?? []) {
      await visit(dep)
    }
    order.push(name)
  }

  for (const r of roots) await visit(r)
  return order.map((n) => seen.get(n)!)
}
