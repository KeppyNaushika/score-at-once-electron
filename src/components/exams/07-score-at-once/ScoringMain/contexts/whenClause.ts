/**
 * ショートカットの when 句（例: `!inputFocus && gradingMode == 'grid'`）を読んで評価する。
 *
 * when 句は以前 `new Function` で JavaScript の式として評価していた。画面で文字列から
 * コードを作ると CSP に `'unsafe-eval'` が要るうえ、式に何が書けるかが縛られない。
 * ここでは when 句に書ける形を閉じた文法として読み、データ（`WhenExpression`）にしてから
 * 評価する。コードは作らない。
 *
 * 書ける形（JavaScript の同じ書き方と同じ意味になる）:
 *
 * - コンテキストのキー（`ScoringContextState` のキーだけ。値の真偽で読む）
 * - 文字列 `'grid'`・`"grid"`（逆スラッシュは書けない）、`true`・`false`
 * - `!`・`&&`・`||`・括弧
 * - 比較 `==`・`!=`・`===`・`!==`（どれも型まで比べる）。左右は値だけで、片方は文字列か
 *   `true`/`false` にする。`!x == 'a'` は読めない（`!(x == 'a')` と書く）。
 *   コンテキストの値は真偽値か決まった文字列なので、`gradingMode == 'grid'` のような
 *   比較は `==` と `===` で結果が変わらない
 *
 * それ以外（知らないキー・関数の呼び出し・プロパティの参照など）は読めない when 句として
 * 扱い、偽にする（以前も、評価で例外になった when 句は偽だった）。
 */

import type { ScoringContextState } from "../../types"

/** when 句が読めるコンテキストのキー。`ScoringContextState` のキーと過不足なく一致させる */
const WHEN_CONTEXT_KEYS: Record<keyof ScoringContextState, true> = {
  inputFocus: true,
  textEditorActive: true,
  gradingMode: true,
  modalOpen: true,
  partialScoreModalOpen: true,
  hasSelectedAnswers: true,
  scoringOperationMode: true,
  choiceSceneOpen: true,
  aiQuestioningManual: true,
}

function isWhenContextKey(name: string): name is keyof ScoringContextState {
  return Object.hasOwn(WHEN_CONTEXT_KEYS, name)
}

/** 比較の左右・単独の値になれるもの */
type WhenOperand =
  | { kind: "context"; key: keyof ScoringContextState }
  | { kind: "literal"; literal: string | boolean }

/** 読んだ when 句 */
export type WhenExpression =
  | { kind: "operand"; operand: WhenOperand }
  | { kind: "not"; negated: WhenExpression }
  | { kind: "and"; terms: WhenExpression[] }
  | { kind: "or"; terms: WhenExpression[] }
  | {
      kind: "compare"
      operator: "equal" | "notEqual"
      left: WhenOperand
      right: WhenOperand
    }

type WhenToken =
  | { kind: "identifier"; name: string }
  | { kind: "string"; text: string }
  | {
      kind: "symbol"
      symbol: "&&" | "||" | "!" | "==" | "!=" | "(" | ")"
    }

/** 長いものから順に照らす（`!==` を `!` と `==` に分けない） */
const SYMBOL_PATTERNS: ReadonlyArray<{
  pattern: string
  symbol: Extract<WhenToken, { kind: "symbol" }>["symbol"]
}> = [
  { pattern: "===", symbol: "==" },
  { pattern: "!==", symbol: "!=" },
  { pattern: "==", symbol: "==" },
  { pattern: "!=", symbol: "!=" },
  { pattern: "&&", symbol: "&&" },
  { pattern: "||", symbol: "||" },
  { pattern: "!", symbol: "!" },
  { pattern: "(", symbol: "(" },
  { pattern: ")", symbol: ")" },
]

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*/
const STRING_PATTERN = /^(?:'([^'\\\n]*)'|"([^"\\\n]*)")/

function tokenize(when: string): WhenToken[] {
  const tokens: WhenToken[] = []
  let rest = when.trimStart()
  while (rest.length > 0) {
    const identifier = rest.match(IDENTIFIER_PATTERN)
    const quoted = rest.match(STRING_PATTERN)
    const symbolPattern = SYMBOL_PATTERNS.find(({ pattern }) =>
      rest.startsWith(pattern)
    )
    if (identifier) {
      tokens.push({ kind: "identifier", name: identifier[0] })
      rest = rest.slice(identifier[0].length)
    } else if (quoted) {
      tokens.push({ kind: "string", text: quoted[1] ?? quoted[2] ?? "" })
      rest = rest.slice(quoted[0].length)
    } else if (symbolPattern) {
      tokens.push({ kind: "symbol", symbol: symbolPattern.symbol })
      rest = rest.slice(symbolPattern.pattern.length)
    } else {
      throw new Error(`when 句に使えない文字があります: ${rest}`)
    }
    rest = rest.trimStart()
  }
  return tokens
}

/**
 * 下ってゆく形の読み手。優先順位は JavaScript と同じ（`!` ＞ 比較 ＞ `&&` ＞ `||`）。
 *
 * - or      := and ( "||" and )*
 * - and     := compare ( "&&" compare )*
 * - compare := unary ( ("==" | "!=") unary )?
 * - unary   := "!" unary | "(" or ")" | operand
 *
 * 比較の左右は値（キー・文字列・true/false）だけにする。`!x == 'a'` は JavaScript では
 * `(!x) == 'a'` と読まれ、書き手の意図と食い違いやすいので読めないものとして扱う
 * （`!(x == 'a')` と書く）
 */
function parseTokens(tokens: WhenToken[], when: string): WhenExpression {
  let position = 0

  const peekSymbol = (symbol: string) => {
    const token = tokens[position]
    return token?.kind === "symbol" && token.symbol === symbol
  }

  const fail = (reason: string): never => {
    throw new Error(`when 句を読めません（${reason}）: ${when}`)
  }

  const parseOperand = (): WhenOperand => {
    const token = tokens[position]
    if (token?.kind === "string") {
      position++
      return { kind: "literal", literal: token.text }
    }
    if (token?.kind === "identifier") {
      position++
      if (token.name === "true") return { kind: "literal", literal: true }
      if (token.name === "false") return { kind: "literal", literal: false }
      if (isWhenContextKey(token.name)) {
        return { kind: "context", key: token.name }
      }
      return fail(`知らないキー ${token.name}`)
    }
    return fail("値があるべき所にありません")
  }

  const parseUnary = (): WhenExpression => {
    if (peekSymbol("!")) {
      position++
      return { kind: "not", negated: parseUnary() }
    }
    if (peekSymbol("(")) {
      position++
      const inner = parseOr()
      if (!peekSymbol(")")) fail("括弧が閉じていません")
      position++
      return inner
    }
    return { kind: "operand", operand: parseOperand() }
  }

  const parseCompare = (): WhenExpression => {
    const left = parseUnary()
    const comparison = tokens[position]
    if (
      comparison?.kind !== "symbol" ||
      (comparison.symbol !== "==" && comparison.symbol !== "!=")
    ) {
      return left
    }
    position++
    const right = parseUnary()
    if (left.kind !== "operand" || right.kind !== "operand") {
      return fail("比較の左右は値だけにします")
    }
    if (left.operand.kind === "context" && right.operand.kind === "context") {
      return fail("比較の片方は文字列か true/false にします")
    }
    return {
      kind: "compare",
      operator: comparison.symbol === "==" ? "equal" : "notEqual",
      left: left.operand,
      right: right.operand,
    }
  }

  const parseAnd = (): WhenExpression => {
    const terms = [parseCompare()]
    while (peekSymbol("&&")) {
      position++
      terms.push(parseCompare())
    }
    return terms.length === 1 ? terms[0] : { kind: "and", terms }
  }

  function parseOr(): WhenExpression {
    const terms = [parseAnd()]
    while (peekSymbol("||")) {
      position++
      terms.push(parseAnd())
    }
    return terms.length === 1 ? terms[0] : { kind: "or", terms }
  }

  const expression = parseOr()
  if (position !== tokens.length) fail("余分なものが続いています")
  return expression
}

/** when 句を読む。読めなければ投げる */
export function parseWhenClause(when: string): WhenExpression {
  const tokens = tokenize(when)
  if (tokens.length === 0) {
    throw new Error("when 句が空です")
  }
  return parseTokens(tokens, when)
}

function operandValue(
  operand: WhenOperand,
  context: ScoringContextState
): string | boolean {
  return operand.kind === "context" ? context[operand.key] : operand.literal
}

/** 読んだ when 句を、いまのコンテキストで評価する */
export function evaluateWhenExpression(
  expression: WhenExpression,
  context: ScoringContextState
): boolean {
  switch (expression.kind) {
    case "operand":
      return Boolean(operandValue(expression.operand, context))
    case "not":
      return !evaluateWhenExpression(expression.negated, context)
    case "and":
      return expression.terms.every((term) =>
        evaluateWhenExpression(term, context)
      )
    case "or":
      return expression.terms.some((term) =>
        evaluateWhenExpression(term, context)
      )
    case "compare": {
      const isEqual =
        operandValue(expression.left, context) ===
        operandValue(expression.right, context)
      return expression.operator === "equal" ? isEqual : !isEqual
    }
  }
}

/**
 * 読んだ when 句の控え。when 句は定数（`sceneWhen` が場面と登録ごとの条件から組む）なので、
 * 種類は限られる。読めなかった when 句は null で控え、知らせるのは1回にする
 */
const parsedWhenClauses = new Map<string, WhenExpression | null>()

/** when 句を評価する。読めない when 句は偽 */
export function evaluateWhenClause(
  when: string,
  context: ScoringContextState
): boolean {
  let expression = parsedWhenClauses.get(when)
  if (expression === undefined) {
    try {
      expression = parseWhenClause(when)
    } catch (error) {
      console.error("Failed to parse when clause:", when, error)
      expression = null
    }
    parsedWhenClauses.set(when, expression)
  }
  return expression !== null && evaluateWhenExpression(expression, context)
}
