/**
 * 観点間制約ルールの「式」の構文解析と評価（外部ライブラリ不使用）
 *
 * 文法は制約ルールに要る分だけに絞ってある。メンバーアクセス・代入・関数定義を文法ごと
 * 持たないので、式の文字列から prototype や Function に触れる経路が構造的に存在しない。
 * 呼べる関数は呼び出し側が渡す関数表に載っているものだけ。
 *
 *   式       := 論理和
 *   論理和   := 論理積 ( (or | ||) 論理積 )*
 *   論理積   := 否定 ( (and | &&) 否定 )*
 *   否定     := (not | !) 否定 | 比較
 *   比較     := 加減 ( (= | == | != | <> | ≠ | < | <= | ≤ | > | >= | ≥) 加減 )?
 *   加減     := 乗除 ( (+ | -) 乗除 )*
 *   乗除     := 単項 ( (* | /) 単項 )*
 *   単項     := - 単項 | 一次
 *   一次     := 数値 | 文字列 | 関数名 ( 引数, … ) | ( 式 )
 *
 * 日本語入力のまま書けるよう、文字列の外の全角英数・記号は半角とみなす（NFKC）。
 * 文字列は "…" か 「…」 で囲む。文字列の中は項目名と突き合わせるので変換しない。
 */

export type ExpressionValue = number | string | boolean

/** 式から呼べる関数の名前 → 引数の数（null は可変長）。構文解析はこれだけを見る */
export type ExpressionFunctionArity = Record<string, number | null>

/** 評価時に実際に呼ぶ関数の表 */
export type ExpressionFunctionTable = Record<
  string,
  (...args: ExpressionValue[]) => ExpressionValue
>

type BinaryOperator =
  "or" | "and" | "==" | "!=" | "<" | "<=" | ">" | ">=" | "+" | "-" | "*" | "/"

export type ExpressionNode =
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "not"; operand: ExpressionNode }
  | { kind: "negate"; operand: ExpressionNode }
  | {
      kind: "binary"
      operator: BinaryOperator
      left: ExpressionNode
      right: ExpressionNode
    }
  | { kind: "call"; name: string; args: ExpressionNode[] }

type Token =
  | { kind: "number"; value: number; position: number }
  | { kind: "string"; value: string; position: number }
  | { kind: "name"; value: string; position: number }
  | { kind: "symbol"; value: string; position: number }
  | { kind: "end"; position: number }

/** 記号（長いものから照合する） */
const SYMBOLS = [
  "==",
  "!=",
  "<>",
  "<=",
  ">=",
  "&&",
  "||",
  "=",
  "≠",
  "≤",
  "≥",
  "<",
  ">",
  "!",
  "+",
  "-",
  "*",
  "/",
  "(",
  ")",
  ",",
]

/** 記号・語を正規の演算子へ */
const OR_WORDS = new Set(["or", "||"])
const AND_WORDS = new Set(["and", "&&"])
const NOT_WORDS = new Set(["not", "!"])
const COMPARISON_OPERATORS: Record<string, BinaryOperator> = {
  "=": "==",
  "==": "==",
  "!=": "!=",
  "<>": "!=",
  "≠": "!=",
  "<": "<",
  "<=": "<=",
  "≤": "<=",
  ">": ">",
  ">=": ">=",
  "≥": ">=",
}

const STRING_QUOTES: Record<string, string> = { '"': '"', "「": "」" }

export class ExpressionError extends Error {}

function describePosition(position: number): string {
  return `${position + 1}文字目`
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = []
  // 文字列の外だけを NFKC で半角化する。位置は元の文字列のまま数える
  const characters = Array.from(expression)
  let index = 0

  const normalizedAt = (at: number) =>
    (characters[at] ?? "").normalize("NFKC").replace(/[“”＂]/g, '"')

  while (index < characters.length) {
    const character = normalizedAt(index)

    if (/\s/.test(character) || character === "") {
      index++
      continue
    }

    // “ ” ＂ は normalizedAt で " になっている
    const closingQuote = STRING_QUOTES[character]
    if (closingQuote !== undefined) {
      const start = index
      index++
      let text = ""
      while (index < characters.length) {
        const inner = characters[index]
        const isClosing =
          inner === closingQuote ||
          (closingQuote === '"' && /[“”＂]/.test(inner))
        if (isClosing) break
        text += inner
        index++
      }
      if (index >= characters.length) {
        throw new ExpressionError(
          `${describePosition(start)}: 文字列が閉じていません（${closingQuote} が必要です）`
        )
      }
      index++
      tokens.push({ kind: "string", value: text, position: start })
      continue
    }

    if (/[0-9.]/.test(character)) {
      const start = index
      let text = ""
      while (index < characters.length && /[0-9.]/.test(normalizedAt(index))) {
        text += normalizedAt(index)
        index++
      }
      if (!/^\d+(\.\d+)?$|^\.\d+$/.test(text)) {
        throw new ExpressionError(
          `${describePosition(start)}: 数値「${text}」を読めません`
        )
      }
      tokens.push({ kind: "number", value: Number(text), position: start })
      continue
    }

    if (/[A-Za-z_]/.test(character)) {
      const start = index
      let text = ""
      while (
        index < characters.length &&
        /[A-Za-z0-9_]/.test(normalizedAt(index))
      ) {
        text += normalizedAt(index)
        index++
      }
      tokens.push({ kind: "name", value: text.toLowerCase(), position: start })
      continue
    }

    const twoCharacters = character + normalizedAt(index + 1)
    const symbol = SYMBOLS.find((candidate) =>
      candidate.length === 2
        ? twoCharacters === candidate
        : character === candidate
    )
    if (symbol) {
      tokens.push({ kind: "symbol", value: symbol, position: index })
      index += symbol.length
      continue
    }

    throw new ExpressionError(
      `${describePosition(index)}: 「${characters[index]}」は使えません（項目名・ラベルは "…" か 「…」 で囲みます）`
    )
  }

  tokens.push({ kind: "end", position: characters.length })
  return tokens
}

function describeToken(token: Token): string {
  if (token.kind === "end") return "式の終わり"
  if (token.kind === "string") return `文字列「${token.value}」`
  return `「${token.value}」`
}

/**
 * 式を構文木にする。関数名と引数の数はここで検査する（打ち間違いを入力時に見せるため）。
 * 構文の誤りは ExpressionError を投げる。
 */
export function parseExpression(
  expression: string,
  functionArity: ExpressionFunctionArity
): ExpressionNode {
  const tokens = tokenize(expression)
  let cursor = 0

  const peek = () => tokens[cursor]
  const advance = () => tokens[cursor++]
  const isSymbol = (token: Token, symbol: string) =>
    token.kind === "symbol" && token.value === symbol
  const isWord = (token: Token, words: Set<string>) =>
    (token.kind === "name" || token.kind === "symbol") && words.has(token.value)
  const expectSymbol = (symbol: string) => {
    const token = advance()
    if (token.kind !== "symbol" || token.value !== symbol) {
      throw new ExpressionError(
        `${describePosition(token.position)}: 「${symbol}」が必要ですが ${describeToken(token)} があります`
      )
    }
  }

  const parseOr = (): ExpressionNode => {
    let left = parseAnd()
    while (isWord(peek(), OR_WORDS)) {
      advance()
      left = { kind: "binary", operator: "or", left, right: parseAnd() }
    }
    return left
  }

  const parseAnd = (): ExpressionNode => {
    let left = parseNot()
    while (isWord(peek(), AND_WORDS)) {
      advance()
      left = { kind: "binary", operator: "and", left, right: parseNot() }
    }
    return left
  }

  const parseNot = (): ExpressionNode => {
    if (isWord(peek(), NOT_WORDS)) {
      advance()
      return { kind: "not", operand: parseNot() }
    }
    return parseComparison()
  }

  const parseComparison = (): ExpressionNode => {
    const left = parseAdditive()
    const token = peek()
    const operator =
      token.kind === "symbol" ? COMPARISON_OPERATORS[token.value] : undefined
    if (!operator) return left
    advance()
    return { kind: "binary", operator, left, right: parseAdditive() }
  }

  const parseAdditive = (): ExpressionNode => {
    let left = parseMultiplicative()
    for (;;) {
      const token = peek()
      if (
        token.kind !== "symbol" ||
        (token.value !== "+" && token.value !== "-")
      )
        return left
      advance()
      left = {
        kind: "binary",
        operator: token.value,
        left,
        right: parseMultiplicative(),
      }
    }
  }

  const parseMultiplicative = (): ExpressionNode => {
    let left = parseUnary()
    for (;;) {
      const token = peek()
      if (
        token.kind !== "symbol" ||
        (token.value !== "*" && token.value !== "/")
      )
        return left
      advance()
      left = {
        kind: "binary",
        operator: token.value,
        left,
        right: parseUnary(),
      }
    }
  }

  const parseUnary = (): ExpressionNode => {
    const token = peek()
    if (isSymbol(token, "-")) {
      advance()
      return { kind: "negate", operand: parseUnary() }
    }
    return parsePrimary()
  }

  const parsePrimary = (): ExpressionNode => {
    const token = advance()
    if (token.kind === "number") return { kind: "number", value: token.value }
    if (token.kind === "string") return { kind: "string", value: token.value }
    if (isSymbol(token, "(")) {
      const inner = parseOr()
      expectSymbol(")")
      return inner
    }
    if (token.kind === "name") {
      if (!Object.hasOwn(functionArity, token.value)) {
        throw new ExpressionError(
          `${describePosition(token.position)}: 関数「${token.value}」はありません（使える関数: ${Object.keys(functionArity).join(" / ")}）`
        )
      }
      const arity = functionArity[token.value]
      expectSymbol("(")
      const args: ExpressionNode[] = []
      if (!isSymbol(peek(), ")")) {
        args.push(parseOr())
        while (isSymbol(peek(), ",")) {
          advance()
          args.push(parseOr())
        }
      }
      expectSymbol(")")
      if (arity !== null && args.length !== arity) {
        throw new ExpressionError(
          `${describePosition(token.position)}: ${token.value}() の引数は${arity}つです（${args.length}つあります）`
        )
      }
      return { kind: "call", name: token.value, args }
    }
    throw new ExpressionError(
      `${describePosition(token.position)}: ${describeToken(token)} の位置に値が必要です`
    )
  }

  const tree = parseOr()
  const trailing = peek()
  if (trailing.kind !== "end") {
    throw new ExpressionError(
      `${describePosition(trailing.position)}: ${describeToken(trailing)} の前に演算子（and / or / = など）が必要です`
    )
  }
  return tree
}

/** 数として読める値なら数に。数字の文字列（"5"）も数として扱う */
function asNumber(value: ExpressionValue): number | null {
  if (typeof value === "number") return value
  if (typeof value === "boolean") return value ? 1 : 0
  const trimmed = value.trim()
  if (trimmed === "") return null
  const parsed = Number(trimmed)
  return Number.isNaN(parsed) ? null : parsed
}

function requireNumber(value: ExpressionValue, operator: string): number {
  const number = asNumber(value)
  if (number === null) {
    throw new ExpressionError(
      `「${String(value)}」は数ではないので ${operator} で計算できません`
    )
  }
  return number
}

function isTruthy(value: ExpressionValue): boolean {
  if (typeof value === "number") return value !== 0 && !Number.isNaN(value)
  return Boolean(value)
}

/** 等しいか。片方が数なら数として比べる（label("評定") = 5 を通すため） */
function isEqual(left: ExpressionValue, right: ExpressionValue): boolean {
  if (typeof left === "number" || typeof right === "number") {
    const leftNumber = asNumber(left)
    const rightNumber = asNumber(right)
    return leftNumber !== null && leftNumber === rightNumber
  }
  return left === right
}

function compareOrder(
  operator: "<" | "<=" | ">" | ">=",
  left: ExpressionValue,
  right: ExpressionValue
): boolean {
  const leftNumber = asNumber(left)
  const rightNumber = asNumber(right)
  if (leftNumber === null || rightNumber === null) {
    throw new ExpressionError(
      `「${String(leftNumber === null ? left : right)}」は数ではないので ${operator} で比べられません`
    )
  }
  if (operator === "<") return leftNumber < rightNumber
  if (operator === "<=") return leftNumber <= rightNumber
  if (operator === ">") return leftNumber > rightNumber
  return leftNumber >= rightNumber
}

export function evaluateExpression(
  node: ExpressionNode,
  functions: ExpressionFunctionTable
): ExpressionValue {
  switch (node.kind) {
    case "number":
    case "string":
      return node.value
    case "not":
      return !isTruthy(evaluateExpression(node.operand, functions))
    case "negate":
      return -requireNumber(evaluateExpression(node.operand, functions), "-")
    case "call": {
      if (!Object.hasOwn(functions, node.name)) {
        throw new ExpressionError(`関数「${node.name}」はありません`)
      }
      return functions[node.name](
        ...node.args.map((argument) => evaluateExpression(argument, functions))
      )
    }
    case "binary": {
      if (node.operator === "and") {
        return (
          isTruthy(evaluateExpression(node.left, functions)) &&
          isTruthy(evaluateExpression(node.right, functions))
        )
      }
      if (node.operator === "or") {
        return (
          isTruthy(evaluateExpression(node.left, functions)) ||
          isTruthy(evaluateExpression(node.right, functions))
        )
      }
      const left = evaluateExpression(node.left, functions)
      const right = evaluateExpression(node.right, functions)
      switch (node.operator) {
        case "==":
          return isEqual(left, right)
        case "!=":
          return !isEqual(left, right)
        case "<":
        case "<=":
        case ">":
        case ">=":
          return compareOrder(node.operator, left, right)
        case "+":
          return requireNumber(left, "+") + requireNumber(right, "+")
        case "-":
          return requireNumber(left, "-") - requireNumber(right, "-")
        case "*":
          return requireNumber(left, "*") * requireNumber(right, "*")
        case "/":
          return requireNumber(left, "/") / requireNumber(right, "/")
      }
    }
  }
}

export function isExpressionTruthy(value: ExpressionValue): boolean {
  return isTruthy(value)
}
