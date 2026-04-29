import ts from 'typescript'

export function isJsxLike(node: ts.Node): boolean {
  return ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)
}

export function statementReturnsJsx(stmt: ts.Statement): boolean {
  if (ts.isReturnStatement(stmt) && stmt.expression) {
    const expr = ts.isParenthesizedExpression(stmt.expression) ? stmt.expression.expression : stmt.expression
    return isJsxLike(expr)
  }
  if (ts.isIfStatement(stmt)) {
    return statementReturnsJsx(stmt.thenStatement) || (!!stmt.elseStatement && statementReturnsJsx(stmt.elseStatement))
  }
  if (ts.isBlock(stmt)) return stmt.statements.some(statementReturnsJsx)
  return false
}

export function hasExportModifier(stmt: ts.Statement): boolean {
  const mods = (stmt as any).modifiers as ts.NodeArray<ts.ModifierLike> | undefined
  return !!mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
}

export function nodeContainsJsx(node: ts.Node): boolean {
  let found = false
  const visit = (child: ts.Node) => {
    if (found) return
    if (isJsxLike(child)) {
      found = true
      return
    }
    ts.forEachChild(child, visit)
  }
  visit(node)
  return found
}
