export function stripQuotes(s: string) {
  return s.replace(/^['"]|['"]$/g, '')
}

export function stripExport(src: string): string {
  return src.replace(/^export\s+/, '')
}

export function pascalToKebab(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .replace(/(\d)([A-Z])/g, '$1-$2')
    .toLowerCase()
}

export function pascalCase(s: string): string {
  return s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('')
}

export function indent(source: string, spaces: number): string {
  const pad = ' '.repeat(spaces)
  return source
    .split('\n')
    .map((line) => (line ? pad + line : line))
    .join('\n')
}
