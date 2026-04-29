import ts from 'typescript'
import type { ComponentDecl, HelperDecl, JsxRecordHelper, TypeDecl } from './types.js'
import { getHelperName, referencesIdentifier } from './parse.js'
import { indent, pascalToKebab, stripExport } from './names.js'
import {
  helperContainsJsx,
  prepareJsx,
  prepareJsxInSource,
  rewriteImportPaths,
  rewriteJsxRecordUsages,
  rewriteTypes,
  usedSiblingComponents,
} from './rewrites.js'

export function emitAstro(opts: {
  comp: ComponentDecl
  imports: ts.ImportDeclaration[]
  typeDeclsSource: TypeDecl[]
  helpers: HelperDecl[]
  needsHTMLAttributes: boolean
  allComponents: ComponentDecl[]
  jsxRecords: JsxRecordHelper[]
  print: (n: ts.Node) => string
}): string {
  const { comp, imports, typeDeclsSource, helpers, needsHTMLAttributes, allComponents, jsxRecords, print } = opts
  const recordHelperNames = new Set(jsxRecords.map((r) => r.helperName))

  const lines: string[] = ['---']
  for (const im of imports) {
    const text = rewriteImportPaths(rewriteTypes(print(im).trim()))
    if (text) lines.push(text)
  }
  for (const sibling of usedSiblingComponents(comp, allComponents)) {
    lines.push(`import ${sibling.name} from './${pascalToKebab(sibling.name)}.astro'`)
  }
  const usedRecords = jsxRecords.filter((r) => referencesIdentifier(comp, r.helperName))
  for (const rec of usedRecords) {
    lines.push(`import ${rec.componentName} from './${rec.fileName.replace(/\.astro$/, '')}.astro'`)
  }
  if (needsHTMLAttributes) lines.push(`import type { HTMLAttributes } from 'astro/types'`)
  if (imports.length || needsHTMLAttributes || usedRecords.length) lines.push('')

  for (const t of typeDeclsSource) lines.push(stripExport(t.source))
  if (typeDeclsSource.length) lines.push('')

  let emittedHelpers = 0
  for (const h of helpers) {
    if (h.node && recordHelperNames.has(getHelperName(h.node))) continue
    if (helperContainsJsx(h)) continue
    lines.push(stripExport(rewriteTypes(h.source)))
    emittedHelpers++
  }
  if (emittedHelpers) lines.push('')

  const cast = comp.propTypeText ? ` as ${comp.propTypeText}` : ''
  if (comp.destructureSource) {
    let pattern = comp.destructureSource
    pattern = pattern.replace(/(^|[\s,{])children\s*,?\s*/g, (m) => {
      const lead = m[0] === ' ' || m[0] === '\n' || m[0] === '{' || m[0] === ',' ? m[0] : ''
      return lead === ',' ? '' : lead
    })
    pattern = pattern.replace(/,\s*,/g, ',').replace(/\{\s*,/g, '{').replace(/,\s*\}/g, ' }')
    lines.push(`const ${pattern} = Astro.props${cast}`)
  }

  if (!comp.blockBodySource) {
    for (const s of comp.preReturnStatements) lines.push(s)
    for (const branch of comp.conditionalReturns) {
      for (const s of branch.preReturnStatements) lines.push(s)
    }
  }

  lines.push('---')

  const rewrittenComp = usedRecords.length ? rewriteJsxRecordUsages(comp, usedRecords) : comp
  const rendered = renderComponentTemplate(rewrittenComp)
  if (rendered.usesSlotPresence) {
    const frontmatterEnd = lines.lastIndexOf('---')
    lines.splice(frontmatterEnd, 0, `const hasDefaultSlot = Astro.slots.has('default')`)
  }
  lines.push(rendered.jsx)

  return lines.join('\n') + '\n'
}

function renderComponentTemplate(comp: ComponentDecl): { jsx: string; usesSlotPresence: boolean } {
  if (comp.blockBodySource) {
    const rendered = prepareJsxInSource(comp.blockBodySource)
    return {
      jsx: `{\n  (() => {\n${indent(rendered.jsx, 4)}\n  })()\n}`,
      usesSlotPresence: rendered.usesSlotPresence,
    }
  }

  if (!comp.conditionalReturns.length) return prepareJsx(comp.jsxSource)

  let usesSlotPresence = false
  const branches = comp.conditionalReturns.map((branch) => {
    const rendered = prepareJsx(branch.jsxSource)
    usesSlotPresence ||= rendered.usesSlotPresence
    return `  ${branch.condition} ? (\n${indent(rendered.jsx, 4)}\n  )`
  })

  const fallback = comp.jsxSource ? prepareJsx(comp.jsxSource) : { jsx: 'null', usesSlotPresence: false }
  usesSlotPresence ||= fallback.usesSlotPresence
  return {
    jsx: `{\n${branches.join(' :\n')} :\n  (\n${indent(fallback.jsx, 4)}\n  )\n}`,
    usesSlotPresence,
  }
}

export function emitBarrel(opts: {
  baseName: string
  components: ComponentDecl[]
  helpers: HelperDecl[]
  imports: ts.ImportDeclaration[]
  typeDecls: TypeDecl[]
  localExportStatements: string[]
  print: (n: ts.Node) => string
}): { name: string; content: string } {
  const { baseName, components, helpers, imports, typeDecls, localExportStatements, print } = opts
  const lines: string[] = []
  const barrelHelpers = helpers.filter((h) => !helperContainsJsx(h))
  const skippedHelpers = helpers.filter((h) => h.exported && helperContainsJsx(h))
  const exportedTypes = typeDecls.filter((t) => t.exported)
  const needsHTMLAttributes = exportedTypes.some((t) => t.source.includes('HTMLAttributes<'))

  if (barrelHelpers.length || exportedTypes.length) {
    for (const im of imports) lines.push(rewriteImportPaths(rewriteTypes(print(im).trim())))
    if (needsHTMLAttributes) lines.push(`import type { HTMLAttributes } from 'astro/types'`)
    if (imports.length) lines.push('')
  }

  for (const c of components.filter((component) => component.exported)) {
    const fileBase = pascalToKebab(c.name)
    lines.push(`export { default as ${c.name} } from './${fileBase}.astro'`)
  }
  if (barrelHelpers.length) {
    lines.push('')
    for (const h of barrelHelpers) lines.push(rewriteTypes(h.source))
  }
  if (localExportStatements.length) {
    if (lines.length) lines.push('')
    for (const stmt of localExportStatements) lines.push(stmt)
  }
  if (exportedTypes.length) {
    if (lines.length) lines.push('')
    for (const t of exportedTypes) lines.push(t.source)
  }
  if (skippedHelpers.length) {
    lines.push('')
    lines.push('// JSX-returning helpers were converted to .astro components and are not re-exported from this .ts barrel.')
  }
  return { name: `${baseName}.ts`, content: lines.join('\n') + '\n' }
}
