import type ts from 'typescript'

export type AstroFile = { name: string; content: string }

export type ConvertResult = {
  astroFiles: AstroFile[]
  barrel: { name: string; content: string }
  componentNames: string[]
}

export type ComponentDecl = {
  name: string
  exported: boolean
  propTypeText: string | null
  destructureSource: string
  destructuredNames: string[]
  hasRest: boolean
  blockBodySource: string | null
  preReturnStatements: string[]
  conditionalReturns: ConditionalReturn[]
  jsxSource: string
}

export type ConditionalReturn = {
  condition: string
  preReturnStatements: string[]
  jsxSource: string
}

export type HelperDecl = {
  kind: 'var' | 'fn' | 'other'
  exported: boolean
  source: string
  node?: ts.Statement
}

export type JsxRecordHelper = {
  helperName: string
  componentName: string
  fileName: string
  cases: { key: string; jsx: string }[]
}

export type TypeDecl = {
  exported: boolean
  source: string
}
