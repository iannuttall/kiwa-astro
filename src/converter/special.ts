import ts from 'typescript'
import type { AstroFile, ConvertResult } from './types.js'
import { hasExportModifier } from './ast.js'
import { pascalToKebab } from './names.js'

export function convertSocialIconTsx(sf: ts.SourceFile): ConvertResult {
  const icons = new Map<string, string>()
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt) || !hasExportModifier(stmt)) continue
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue
      if (!ts.isCallExpression(decl.initializer)) continue
      if (decl.initializer.expression.getText(sf) !== 'createSocialIcon') continue
      const arg = decl.initializer.arguments[0]
      if (arg && ts.isStringLiteral(arg)) icons.set(decl.name.text, arg.text)
    }
  }

  const astroFiles: AstroFile[] = []
  for (const [name, path] of icons) {
    const fileBase = pascalToKebab(name)
    astroFiles.push({
      name: `${fileBase}.astro`,
      content: `---\nconst { class: className, ...props } = Astro.props as { class?: string; [key: string]: unknown }\n---\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="currentColor"\n  class={className}\n  {...props}\n>\n  <path d=${JSON.stringify(path)} />\n</svg>\n`,
    })
  }

  const barrelLines = [...icons.keys()].map(
    (name) => `export { default as ${name} } from './${pascalToKebab(name)}.astro'`,
  )
  return {
    astroFiles,
    barrel: { name: 'social-icon.ts', content: barrelLines.join('\n') + '\n' },
    componentNames: [...icons.keys()],
  }
}

export function convertIconTsx(sf: ts.SourceFile): ConvertResult {
  const iconMap = new Map<string, string>()
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt) || !hasExportModifier(stmt)) continue
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name)) continue
      if (!decl.initializer || !ts.isCallExpression(decl.initializer)) continue
      if (decl.initializer.expression.getText(sf) !== 'createIcon') continue
      const arg = decl.initializer.arguments[0]
      if (arg && ts.isIdentifier(arg)) iconMap.set(decl.name.text, arg.text)
    }
  }

  const lucideImports = [...new Set(iconMap.values())].sort()
  const astroFiles: AstroFile[] = [
    {
      name: 'icon.astro',
      content: `---\nimport type { IconNode } from 'lucide'\n\ntype IconProps = {\n  iconNode: IconNode\n  class?: string\n  [key: string]: unknown\n}\n\nconst { iconNode, class: className, ...props } = Astro.props as IconProps\n\nfunction escapeHtml(value: string) {\n  return value\n    .replace(/&/g, '&amp;')\n    .replace(/"/g, '&quot;')\n    .replace(/</g, '&lt;')\n    .replace(/>/g, '&gt;')\n}\n\nfunction attrsToString(attrs: Record<string, string | number | undefined>) {\n  return Object.entries(attrs)\n    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)\n    .map(([key, value]) => \`\${key}="\${escapeHtml(String(value))}"\`)\n    .join(' ')\n}\n\nconst innerHTML = (iconNode as [string, Record<string, string | number | undefined>][])\n  .map(([tag, attrs]) => \`<\${tag} \${attrsToString(attrs)}></\${tag}>\`)\n  .join('')\n---\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n  class={className}\n  {...props}\n  set:html={innerHTML}\n/>\n`,
    },
  ]

  for (const [exportName, lucideName] of iconMap) {
    astroFiles.push({
      name: `${pascalToKebab(exportName)}.astro`,
      content: `---\nimport { ${lucideName} } from 'lucide'\nimport Icon from './icon.astro'\n\nconst { class: className, ...props } = Astro.props\n---\n<Icon iconNode={${lucideName}} class={className} {...props} />\n`,
    })
  }

  const barrelLines = [
    `export { default as Icon } from './icon.astro'`,
    ...[...iconMap.keys()].map((name) => `export { default as ${name} } from './${pascalToKebab(name)}.astro'`),
  ]
  return {
    astroFiles,
    barrel: { name: 'icon.ts', content: barrelLines.join('\n') + '\n' },
    componentNames: ['Icon', ...iconMap.keys()],
  }
}
