/**
 * Discord風インラインマークアップパーサー
 *
 * サポート記法:
 * - **text** → 太字
 * - *text* → 斜体
 * - __text__ → 下線
 * - ~~text~~ → 打消線
 * - $formula$ → MathJax数式（インライン）
 * - $$formula$$ → MathJax数式（別行立て / ディスプレイモード）
 * - ||text|| → 模範解答
 *
 * $...$ 内では他のマークアップを無視（数式保護）。
 * 閉じられていないデリミタはリテラルテキストとして扱う。
 * ネスト対応（**bold *bold-italic* bold** → 3セグメント）。
 */

export interface InlineSegment {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  math?: boolean
  displayMath?: boolean
  modelAnswer?: boolean
}

interface StyleState {
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  modelAnswer: boolean
}

/** デリミタ定義（長い順にマッチ） */
const DELIMITERS = [
  { pattern: "**", style: "bold" as const },
  { pattern: "__", style: "underline" as const },
  { pattern: "~~", style: "strikethrough" as const },
  { pattern: "||", style: "modelAnswer" as const },
  { pattern: "*", style: "italic" as const },
] as const

type StyleKey = (typeof DELIMITERS)[number]["style"]

export function parseInlineMarkup(input: string): InlineSegment[] {
  if (!input) return []

  const segments: InlineSegment[] = []
  const styleStack: StyleKey[] = []
  const style: StyleState = {
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    modelAnswer: false,
  }
  let current = ""
  let i = 0

  function pushSegment(text: string) {
    if (!text) return
    const seg: InlineSegment = { text }
    if (style.bold) seg.bold = true
    if (style.italic) seg.italic = true
    if (style.underline) seg.underline = true
    if (style.strikethrough) seg.strikethrough = true
    if (style.modelAnswer) seg.modelAnswer = true
    segments.push(seg)
  }

  while (i < input.length) {
    // 別行立て数式: $$...$$（$...$ より先にチェック）
    if (input[i] === "$" && input[i + 1] === "$") {
      const end = input.indexOf("$$", i + 2)
      if (end !== -1) {
        pushSegment(current)
        current = ""
        const mathText = input.slice(i + 2, end)
        const seg: InlineSegment = {
          text: mathText,
          math: true,
          displayMath: true,
        }
        if (style.modelAnswer) seg.modelAnswer = true
        segments.push(seg)
        i = end + 2
        continue
      }
      // 閉じられていない $$ はリテラルとして扱う
      current += "$$"
      i += 2
      continue
    }

    // インライン数式: $...$
    if (input[i] === "$") {
      const end = input.indexOf("$", i + 1)
      if (end !== -1) {
        pushSegment(current)
        current = ""
        const mathText = input.slice(i + 1, end)
        const seg: InlineSegment = { text: mathText, math: true }
        if (style.modelAnswer) seg.modelAnswer = true
        segments.push(seg)
        i = end + 1
        continue
      }
    }

    // デリミタチェック
    let matched = false
    for (const delim of DELIMITERS) {
      if (input.startsWith(delim.pattern, i)) {
        const styleKey = delim.style

        if (style[styleKey] && styleStack.includes(styleKey)) {
          // 閉じデリミタ
          pushSegment(current)
          current = ""
          style[styleKey] = false
          const idx = styleStack.lastIndexOf(styleKey)
          if (idx !== -1) styleStack.splice(idx, 1)
          i += delim.pattern.length
          matched = true
          break
        } else if (!style[styleKey]) {
          // 開きデリミタ: 閉じがあるか先読み
          const rest = input.slice(i + delim.pattern.length)
          if (rest.includes(delim.pattern)) {
            pushSegment(current)
            current = ""
            style[styleKey] = true
            styleStack.push(styleKey)
            i += delim.pattern.length
            matched = true
            break
          }
          // ** が閉じない場合、* にフォールバックさせずリテラル扱い
          if (delim.pattern.length > 1) {
            current += delim.pattern
            i += delim.pattern.length
            matched = true
            break
          }
        }
      }
    }

    if (!matched) {
      current += input[i]
      i++
    }
  }

  pushSegment(current)

  // セグメントが空の場合は素テキストを返す
  if (segments.length === 0) return [{ text: input }]

  return segments
}

/** マークアップ記法を除去してプレーンテキストを返す */
export function stripMarkup(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\$\$([^$]+)\$\$/g, "$1")
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/\|\|([^|]+)\|\|/g, "$1")
}
