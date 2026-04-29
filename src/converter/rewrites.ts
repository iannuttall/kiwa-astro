import type { ComponentDecl, HelperDecl, JsxRecordHelper } from './types.js'
import { nodeContainsJsx } from './ast.js'

export function rewriteTypes(src: string): string {
  let out = src
  out = out.replace(/JSX\.IntrinsicElements\[\s*(['"])([^'"]+)\1\s*\]/g, (_m, _q, tag) => `HTMLAttributes<'${tag}'>`)
  out = unwrapGeneric(out, 'PropsWithChildren')
  out = replaceGenericWith(out, 'FC', 'any')
  out = out.replace(/\bJSX\.Element\b/g, 'any')
  out = out.replace(/\b(?:Child|JSXNode)\b/g, 'any')
  out = out.replace(/\bFC\b/g, 'any')
  return out
}

export function rewriteImportPaths(src: string): string {
  return src
    .replace(/@\/components\/blocks\/pro\/ai\/_shared\//g, '@/components/blocks/ai/_shared/')
    .replace(/@\/components\/blocks\/pro\/ai\//g, '@/components/blocks/ai/')
    .replace(/@\/components\/blocks\/pro\/marketing\//g, '@/components/blocks/marketing/')
}

function replaceGenericWith(src: string, name: string, replacement: string): string {
  let out = src
  let i = out.indexOf(`${name}<`)
  while (i !== -1) {
    let depth = 1
    let j = i + name.length + 1
    while (j < out.length && depth > 0) {
      if (out[j] === '<') depth++
      else if (out[j] === '>') depth--
      j++
    }
    if (depth !== 0) break
    out = out.slice(0, i) + replacement + out.slice(j)
    i = out.indexOf(`${name}<`, i + replacement.length)
  }
  return out
}

function unwrapGeneric(src: string, name: string): string {
  let out = src
  let i = out.indexOf(`${name}<`)
  while (i !== -1) {
    let depth = 0
    let j = i + name.length
    if (out[j] !== '<') break
    depth = 1
    j++
    const inner = j
    while (j < out.length && depth > 0) {
      if (out[j] === '<') depth++
      else if (out[j] === '>') depth--
      if (depth === 0) break
      j++
    }
    if (depth !== 0) break
    out = out.slice(0, i) + out.slice(inner, j) + out.slice(j + 1)
    i = out.indexOf(`${name}<`)
  }
  return out
}

export function prepareJsx(source: string): { jsx: string; usesSlotPresence: boolean } {
  const result = prepareJsxInSource(source)
  result.jsx = result.jsx.replace(/^\(\s*/, '').replace(/\s*\)$/, '')
  return result
}

export function prepareJsxInSource(source: string): { jsx: string; usesSlotPresence: boolean } {
  let jsx = removeJsxKeyAttributes(source)
  jsx = rewriteJsxPropSlots(jsx)
  const childRewrite = rewriteChildren(jsx)
  jsx = childRewrite.jsx
  return { jsx, usesSlotPresence: childRewrite.usesSlotPresence }
}

function rewriteChildren(jsx: string): { jsx: string; usesSlotPresence: boolean } {
  let usesSlotPresence = false
  let out = replaceChildrenFallbacks(jsx)
  out = out.replace(/\bchildren\s*\?/g, () => {
    usesSlotPresence = true
    return 'hasDefaultSlot ?'
  })
  out = out.replace(/\{\s*children\s*\}/g, '<slot />')
  return { jsx: out, usesSlotPresence }
}

export function helperContainsJsx(helper: HelperDecl): boolean {
  return helper.node ? nodeContainsJsx(helper.node) : containsJsx(helper.source)
}

function containsJsx(src: string): boolean {
  return /=>\s*\(?\s*</.test(src) || /return\s*\(?\s*</.test(src) || containsJsxMarkup(src)
}

function removeJsxKeyAttributes(src: string): string {
  let out = ''
  for (let i = 0; i < src.length; i++) {
    if (/\s/.test(src[i])) {
      const attrStart = skipWs(src, i)
      if (src.slice(attrStart, attrStart + 4) !== 'key=') {
        out += src[i]
        continue
      }
      i = attrStart + 4
      if (src[i] === '"' || src[i] === "'") {
        const quote = src[i++]
        while (i < src.length && src[i] !== quote) i++
      } else if (src[i] === '{') {
        let depth = 1
        i++
        while (i < src.length && depth > 0) {
          if (src[i] === '{') depth++
          else if (src[i] === '}') depth--
          i++
        }
        i--
      }
      continue
    }
    out += src[i]
  }
  return out
}

function rewriteJsxPropSlots(src: string): string {
  let out = ''
  let i = 0
  while (i < src.length) {
    const match = src.slice(i).match(/<[A-Z][A-Za-z0-9_]*/)
    if (!match || match.index === undefined) {
      out += src.slice(i)
      break
    }

    const start = i + match.index
    out += src.slice(i, start)
    const end = findOpeningTagEnd(src, start)
    if (end === -1) {
      out += src.slice(start)
      break
    }

    const tagSource = src.slice(start, end + 1)
    const tagName = match[0].slice(1)
    const rewritten = rewriteOpeningTagSlots(tagSource)
    if (!rewritten.slots.length) {
      out += tagSource
    } else {
      const slotContent = rewritten.slots
        .map((prop) => `<Fragment slot="${prop.name}">${prop.jsx}</Fragment>`)
        .join('\n')
      if (rewritten.selfClosing) {
        out += rewritten.tag.replace(/\/>\s*$/, '>') + slotContent + `</${tagName}>`
      } else {
        out += rewritten.tag + slotContent
      }
    }
    i = end + 1
  }
  return out
}

function findOpeningTagEnd(src: string, start: number): number {
  let braceDepth = 0
  let quote: string | null = null
  for (let i = start; i < src.length; i++) {
    const ch = src[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '{') braceDepth++
    else if (ch === '}') braceDepth = Math.max(0, braceDepth - 1)
    else if (ch === '>' && braceDepth === 0) return i
  }
  return -1
}

function rewriteOpeningTagSlots(tagSource: string): {
  tag: string
  slots: { name: string; jsx: string }[]
  selfClosing: boolean
} {
  const slots: { name: string; jsx: string }[] = []
  let tag = ''
  let i = 0
  while (i < tagSource.length) {
    if (/\s/.test(tagSource[i])) {
      const nameStart = skipWs(tagSource, i)
      const nameMatch = tagSource.slice(nameStart).match(/^([A-Za-z][A-Za-z0-9_]*)/)
      if (!nameMatch) {
        tag += tagSource[i++]
        continue
      }
      const name = nameMatch[1]
      let j = skipWs(tagSource, nameStart + name.length)
      if (tagSource[j] !== '=') {
        tag += tagSource[i++]
        continue
      }
      j = skipWs(tagSource, j + 1)
      if (tagSource[j] !== '{') {
        tag += tagSource[i++]
        continue
      }
      const exprStart = skipWs(tagSource, j + 1)
      const exprEnd = findExpressionClose(tagSource, exprStart)
      if (exprEnd === -1) {
        tag += tagSource[i++]
        continue
      }
      const expr = tagSource.slice(exprStart, exprEnd).trim()
      if (!containsJsxMarkup(expr)) {
        tag += tagSource[i++]
        continue
      }
      slots.push({ name, jsx: expr.startsWith('<') ? expr : `{${expr}}` })
      i = exprEnd + 1
      continue
    }
    tag += tagSource[i++]
  }
  return { tag, slots, selfClosing: /\/>\s*$/.test(tagSource) }
}

function containsJsxMarkup(src: string): boolean {
  return /<[A-Z][A-Za-z0-9_]*(?:\s|\/)/.test(src) || /<[a-z][A-Za-z0-9-]*(?:\s|\/|>)/.test(src)
}

function replaceChildrenFallbacks(src: string): string {
  let out = ''
  let i = 0
  while (i < src.length) {
    const start = src.indexOf('{children', i)
    if (start === -1) {
      out += src.slice(i)
      break
    }
    const opStart = skipWs(src, start + '{children'.length)
    const op = src.slice(opStart, opStart + 2)
    if (op !== '||' && op !== '??') {
      out += src.slice(i, start + 1)
      i = start + 1
      continue
    }
    const exprStart = skipWs(src, opStart + 2)
    const end = findExpressionClose(src, exprStart)
    if (end === -1) {
      out += src.slice(i, start + 1)
      i = start + 1
      continue
    }
    let fallback = src.slice(exprStart, end).trim()
    if (fallback.startsWith('(') && fallback.endsWith(')')) fallback = fallback.slice(1, -1).trim()
    out += src.slice(i, start)
    out += `<slot>${fallback}</slot>`
    i = end + 1
  }
  return out
}

function skipWs(src: string, i: number): number {
  while (i < src.length && /\s/.test(src[i])) i++
  return i
}

function findExpressionClose(src: string, start: number): number {
  let braceDepth = 0
  for (let i = start; i < src.length; i++) {
    const ch = src[i]
    if (ch === '{') braceDepth++
    else if (ch === '}') {
      if (braceDepth === 0) return i
      braceDepth--
    }
  }
  return -1
}

export function rewriteJsxRecordUsages(comp: ComponentDecl, recs: JsxRecordHelper[]): ComponentDecl {
  let { jsxSource, blockBodySource, conditionalReturns } = comp
  const recByName = new Map(recs.map((rec) => [rec.helperName, rec]))

  const apply = (src: string): string => {
    const localToReplacement = new Map<string, (attrs: string) => string>()
    let out = src

    const ternaryRe =
      /const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*([^?\n;]+?)\?\s*([A-Za-z_][A-Za-z0-9_]*)\s*\[([^\]]+)\]\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*\[([^\]]+)\]\s*;?\s*/g
    out = out.replace(ternaryRe, (_m, local, condition, trueHelper, trueExpr, falseHelper, falseExpr) => {
      const trueRec = recByName.get(trueHelper)
      const falseRec = recByName.get(falseHelper)
      if (!trueRec || !falseRec) return _m
      localToReplacement.set(local, (attrs) => {
        const attrText = normaliseAttrs(attrs)
        return `{${condition.trim()} ? (${renderRecordComponent(trueRec, trueExpr.trim(), attrText)}) : (${renderRecordComponent(falseRec, falseExpr.trim(), attrText)})}`
      })
      return ''
    })

    for (const rec of recs) {
      const re = new RegExp(`const\\s+([A-Z][A-Za-z0-9_]*)\\s*=\\s*${rec.helperName}\\s*\\[([^\\]]+)\\]\\s*;?\\s*`, 'g')
      out = out.replace(re, (_m, local, expr) => {
        localToReplacement.set(local, (attrs) => renderRecordComponent(rec, expr.trim(), normaliseAttrs(attrs)))
        return ''
      })

      const directRe = new RegExp(`\\{\\s*${rec.helperName}\\s*\\[([^\\]]+)\\]\\s*\\}`, 'g')
      out = out.replace(directRe, (_m, expr) => renderRecordComponent(rec, expr.trim(), ''))
    }

    for (const [local, replacement] of localToReplacement) {
      const tagRe = new RegExp(`<${local}\\b([^>]*)\\/>`, 'g')
      out = out.replace(tagRe, (_m, attrs) => replacement(attrs))
      const pairedRe = new RegExp(`<${local}\\b([^>]*)>\\s*</${local}>`, 'g')
      out = out.replace(pairedRe, (_m, attrs) => replacement(attrs))
    }

    return out
  }

  jsxSource = apply(jsxSource)
  if (blockBodySource) blockBodySource = apply(blockBodySource)
  conditionalReturns = conditionalReturns.map((b) => ({
    ...b,
    jsxSource: apply(b.jsxSource),
    preReturnStatements: b.preReturnStatements.map(apply),
  }))

  return { ...comp, jsxSource, blockBodySource, conditionalReturns }
}

function renderRecordComponent(rec: JsxRecordHelper, expr: string, attrs: string): string {
  return `<${rec.componentName} name={${expr}}${attrs} />`
}

function normaliseAttrs(attrs: string): string {
  const trimmed = attrs.trim()
  return trimmed ? ` ${trimmed}` : ''
}

export function usedSiblingComponents(comp: ComponentDecl, all: ComponentDecl[]): ComponentDecl[] {
  const source = [
    comp.jsxSource,
    comp.blockBodySource ?? '',
    comp.preReturnStatements.join('\n'),
    ...comp.conditionalReturns.flatMap((branch) => [branch.jsxSource, branch.preReturnStatements.join('\n')]),
  ].join('\n')
  const used = new Set<string>()
  for (const match of source.matchAll(/<([A-Z][A-Za-z0-9_]*)\b/g)) used.add(match[1])
  return all.filter((c) => c.name !== comp.name && used.has(c.name))
}
