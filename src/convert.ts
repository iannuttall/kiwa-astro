// TSX (Hono JSX) -> Astro converter facade.

import ts from 'typescript'

import { hasExportModifier } from './converter/ast.js'
import { emitAstro, emitBarrel } from './converter/emit.js'
import { emitJsxRecordFile, parseJsxRecordHelper } from './converter/jsx-records.js'
import { pascalToKebab, stripQuotes } from './converter/names.js'
import { getHelperName, isFCComponent, parseComponent } from './converter/parse.js'
import { rewriteTypes } from './converter/rewrites.js'
import { convertIconTsx, convertSocialIconTsx } from './converter/special.js'
import type {
  AstroFile,
  ComponentDecl,
  ConvertResult,
  HelperDecl,
  JsxRecordHelper,
  TypeDecl,
} from './converter/types.js'

export type { AstroFile, ConvertResult } from './converter/types.js'

export function convertTsx(source: string, baseName: string): ConvertResult {
  const sf = ts.createSourceFile(`${baseName}.tsx`, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: false })
  const print = (node: ts.Node) => printer.printNode(ts.EmitHint.Unspecified, node, sf)

  if (baseName === 'icon') return convertIconTsx(sf)
  if (baseName === 'social-icon') return convertSocialIconTsx(sf)

  const imports: ts.ImportDeclaration[] = []
  const typeDecls: TypeDecl[] = []
  const components: ComponentDecl[] = []
  const helpers: HelperDecl[] = []
  const localExportNames = new Set<string>()
  const localExportStatements: string[] = []

  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt)) {
      const spec = stripQuotes(stmt.moduleSpecifier.getText(sf))
      if (spec === 'hono/jsx') continue
      imports.push(stmt)
      continue
    }

    if (ts.isTypeAliasDeclaration(stmt) || ts.isInterfaceDeclaration(stmt)) {
      typeDecls.push({ exported: hasExportModifier(stmt), source: print(stmt).trim() })
      continue
    }

    if (ts.isVariableStatement(stmt)) {
      const decl = stmt.declarationList.declarations[0]
      if (decl && isFCComponent(decl)) {
        components.push(parseComponent(decl, stmt, sf, hasExportModifier(stmt)))
        continue
      }
      helpers.push({ kind: 'var', exported: hasExportModifier(stmt), source: rewriteTypes(print(stmt).trim()), node: stmt })
      continue
    }

    if (ts.isFunctionDeclaration(stmt)) {
      helpers.push({ kind: 'fn', exported: hasExportModifier(stmt), source: rewriteTypes(print(stmt).trim()), node: stmt })
      continue
    }

    if (ts.isExportDeclaration(stmt) && !stmt.moduleSpecifier) {
      localExportStatements.push(rewriteTypes(print(stmt).trim()))
      if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const el of stmt.exportClause.elements) {
          localExportNames.add((el.propertyName ?? el.name).text)
        }
      }
      continue
    }

    if (ts.isExportAssignment(stmt)) continue

    helpers.push({ kind: 'other', exported: false, source: print(stmt).trim() })
  }

  for (const helper of helpers) {
    const name = helper.node ? getHelperName(helper.node) : ''
    if (name && localExportNames.has(name)) helper.exported = true
  }

  const astroFiles: AstroFile[] = []
  const componentNames: string[] = []
  const patchedTypes = typeDecls.map((typeDecl) => ({
    exported: typeDecl.exported,
    source: rewriteTypes(typeDecl.source),
  }))
  const needsHTMLAttributes = patchedTypes.some((typeDecl) => typeDecl.source.includes('HTMLAttributes<'))

  const jsxRecords: JsxRecordHelper[] = []
  for (const helper of helpers) {
    if (!helper.node) continue
    const record = parseJsxRecordHelper(helper.node, baseName, sf)
    if (record) jsxRecords.push(record)
  }
  for (const record of jsxRecords) {
    astroFiles.push(emitJsxRecordFile(record, imports, print))
  }

  for (const comp of components) {
    componentNames.push(comp.name)
    const patchedComp: ComponentDecl = {
      ...comp,
      propTypeText: comp.propTypeText ? rewriteTypes(comp.propTypeText) : null,
    }
    const content = emitAstro({
      comp: patchedComp,
      imports,
      typeDeclsSource: patchedTypes,
      helpers,
      needsHTMLAttributes,
      allComponents: components,
      jsxRecords,
      print,
    })
    astroFiles.push({ name: `${pascalToKebab(comp.name)}.astro`, content })
  }

  const barrel = emitBarrel({
    baseName,
    components,
    helpers,
    imports,
    typeDecls: patchedTypes,
    localExportStatements,
    print,
  })

  return { astroFiles, barrel, componentNames }
}
