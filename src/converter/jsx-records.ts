import ts from 'typescript'
import type { AstroFile, JsxRecordHelper } from './types.js'
import { isJsxLike } from './ast.js'
import { pascalCase, pascalToKebab } from './names.js'
import { rewriteImportPaths } from './rewrites.js'

export function parseJsxRecordHelper(stmt: ts.Statement, baseName: string, sf: ts.SourceFile): JsxRecordHelper | null {
  if (!ts.isVariableStatement(stmt)) return null
  const decl = stmt.declarationList.declarations[0]
  if (!decl || !ts.isIdentifier(decl.name) || !decl.initializer) return null
  if (!ts.isObjectLiteralExpression(decl.initializer)) return null

  const cases: { key: string; jsx: string }[] = []
  for (const prop of decl.initializer.properties) {
    if (!ts.isPropertyAssignment(prop)) return null
    let key: string | null = null
    if (ts.isIdentifier(prop.name)) key = prop.name.text
    else if (ts.isStringLiteral(prop.name)) key = prop.name.text
    if (key === null) return null

    let jsx: string | null = null
    if (ts.isArrowFunction(prop.initializer)) {
      const body = prop.initializer.body
      if (ts.isParenthesizedExpression(body) && isJsxLike(body.expression)) jsx = body.expression.getText(sf)
      else if (isJsxLike(body)) jsx = body.getText(sf)
    } else if (isJsxLike(prop.initializer)) {
      jsx = prop.initializer.getText(sf)
    }
    if (!jsx) return null
    cases.push({ key, jsx })
  }
  if (!cases.length) return null

  const helperName = decl.name.text
  const componentName = pascalCase(`${baseName}-${helperName.replace(/Icons?$/i, '')}-icon`)
  const fileName = `${pascalToKebab(componentName)}.astro`
  return { helperName, componentName, fileName, cases }
}

export function emitJsxRecordFile(
  rec: JsxRecordHelper,
  imports: ts.ImportDeclaration[],
  print: (n: ts.Node) => string,
): AstroFile {
  const referenced = new Set<string>()
  for (const c of rec.cases) {
    for (const m of c.jsx.matchAll(/<([A-Z][A-Za-z0-9_]*)\b/g)) referenced.add(m[1])
  }

  const lines: string[] = ['---']
  for (const im of imports) {
    const printed = rewriteImportPaths(print(im).trim())
    if (importExportsAny(printed, referenced)) lines.push(printed)
  }
  lines.push('')
  lines.push(`type Props = { name: string; class?: string }`)
  lines.push(`const { name, class: className } = Astro.props as Props`)
  lines.push('---')

  for (const c of rec.cases) {
    lines.push(`{name === '${c.key}' && (${injectClassName(c.jsx)})}`)
  }
  return { name: rec.fileName, content: lines.join('\n') + '\n' }
}

function importExportsAny(importLine: string, referenced: Set<string>): boolean {
  const named = importLine.match(/\{([^}]*)\}/)
  if (named) {
    for (const spec of named[1].split(',')) {
      const local = spec.trim().split(/\s+as\s+/).pop()?.trim()
      if (local && referenced.has(local)) return true
    }
  }
  const def = importLine.match(/import\s+([A-Z][A-Za-z0-9_]*)\s*[,{]?/)
  if (def && referenced.has(def[1])) return true
  return false
}

function injectClassName(jsx: string): string {
  return jsx
}
