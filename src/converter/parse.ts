import ts from 'typescript'
import type { ComponentDecl, ConditionalReturn } from './types.js'
import { isJsxLike, statementReturnsJsx } from './ast.js'

export function isFCComponent(decl: ts.VariableDeclaration): boolean {
  if (decl.type && ts.isTypeReferenceNode(decl.type)) {
    const tn = decl.type.typeName
    if (ts.isIdentifier(tn) && tn.text === 'FC') return true
  }
  if (decl.initializer && ts.isArrowFunction(decl.initializer)) {
    const arrow = decl.initializer
    if (arrow.body) {
      const body = arrow.body
      if (ts.isParenthesizedExpression(body) && isJsxLike(body.expression)) return true
      if (isJsxLike(body)) return true
      if (ts.isBlock(body) && body.statements.some(statementReturnsJsx)) return true
    }
  }
  return false
}

export function parseComponent(
  decl: ts.VariableDeclaration,
  stmt: ts.VariableStatement,
  sf: ts.SourceFile,
  exported: boolean,
): ComponentDecl {
  const name = (decl.name as ts.Identifier).text

  let propTypeText: string | null = null
  if (decl.type && ts.isTypeReferenceNode(decl.type) && decl.type.typeArguments?.[0]) {
    propTypeText = decl.type.typeArguments[0].getText(sf)
  }

  const arrow = decl.initializer
  if (!arrow || !ts.isArrowFunction(arrow)) {
    throw new Error(`Component ${name} must be an arrow function`)
  }

  const param = arrow.parameters[0]
  let destructureSource = ''
  const destructuredNames: string[] = []
  let hasRest = false
  if (param && ts.isObjectBindingPattern(param.name)) {
    const obj = param.name
    destructureSource = obj.getText(sf)
    for (const el of obj.elements) {
      if (el.dotDotDotToken) {
        hasRest = true
      } else {
        const local = el.name as ts.Identifier
        destructuredNames.push(local.text)
      }
    }
  } else if (param) {
    destructureSource = param.name.getText(sf)
  }

  let jsxSource = ''
  let blockBodySource: string | null = null
  const preReturnStatements: string[] = []
  const conditionalReturns: ConditionalReturn[] = []
  const body = arrow.body
  if (ts.isParenthesizedExpression(body)) {
    jsxSource = body.expression.getText(sf)
  } else if (isJsxLike(body)) {
    jsxSource = body.getText(sf)
  } else if (ts.isBlock(body)) {
    const fullBlockBodySource = body.statements.map((s) => s.getText(sf)).join('\n')
    let finalReturnSeen = false
    for (const s of body.statements) {
      if (ts.isIfStatement(s) && !s.elseStatement) {
        const branch = parseConditionalReturn(s, sf)
        if (branch) {
          conditionalReturns.push(branch)
          continue
        }
      }
      if (ts.isReturnStatement(s) && s.expression) {
        let expr: ts.Expression = s.expression
        if (ts.isParenthesizedExpression(expr)) expr = expr.expression
        jsxSource = expr.getText(sf)
        finalReturnSeen = true
        break
      }
      preReturnStatements.push(s.getText(sf))
    }
    if (!finalReturnSeen || needsBlockBodyIife(body.statements, preReturnStatements.length)) {
      blockBodySource = fullBlockBodySource
    }
  } else {
    throw new Error(`Component ${name}: unexpected body shape`)
  }

  return {
    name,
    exported,
    propTypeText,
    destructureSource,
    destructuredNames,
    hasRest,
    blockBodySource,
    preReturnStatements,
    conditionalReturns,
    jsxSource,
  }
}

function needsBlockBodyIife(statements: ts.NodeArray<ts.Statement>, finalReturnIndex: number): boolean {
  for (let i = 0; i < finalReturnIndex; i++) {
    const stmt = statements[i]
    if (ts.isIfStatement(stmt) && !stmt.elseStatement) continue
    if (statementReturnsJsx(stmt)) return true
  }
  return false
}

function parseConditionalReturn(stmt: ts.IfStatement, sf: ts.SourceFile): ConditionalReturn | null {
  const body = parseReturnBody(stmt.thenStatement, sf)
  if (!body) return null
  return {
    condition: stmt.expression.getText(sf),
    preReturnStatements: body.preReturnStatements,
    jsxSource: body.jsxSource,
  }
}

function parseReturnBody(stmt: ts.Statement, sf: ts.SourceFile): { preReturnStatements: string[]; jsxSource: string } | null {
  if (ts.isReturnStatement(stmt) && stmt.expression) {
    let expr: ts.Expression = stmt.expression
    if (ts.isParenthesizedExpression(expr)) expr = expr.expression
    return { preReturnStatements: [], jsxSource: expr.getText(sf) }
  }

  if (!ts.isBlock(stmt)) return null

  const preReturnStatements: string[] = []
  for (const s of stmt.statements) {
    if (ts.isReturnStatement(s) && s.expression) {
      let expr: ts.Expression = s.expression
      if (ts.isParenthesizedExpression(expr)) expr = expr.expression
      return { preReturnStatements, jsxSource: expr.getText(sf) }
    }
    preReturnStatements.push(s.getText(sf))
  }
  return null
}

export function getHelperName(stmt: ts.Statement): string {
  if (ts.isVariableStatement(stmt)) {
    const d = stmt.declarationList.declarations[0]
    if (d && ts.isIdentifier(d.name)) return d.name.text
  }
  if (ts.isFunctionDeclaration(stmt) && stmt.name) return stmt.name.text
  return ''
}

export function referencesIdentifier(comp: ComponentDecl, name: string): boolean {
  const re = new RegExp(`\\b${name}\\b`)
  if (re.test(comp.jsxSource)) return true
  if (comp.blockBodySource && re.test(comp.blockBodySource)) return true
  if (comp.preReturnStatements.some((s) => re.test(s))) return true
  for (const branch of comp.conditionalReturns) {
    if (re.test(branch.jsxSource)) return true
    if (branch.preReturnStatements.some((s) => re.test(s))) return true
  }
  return false
}
