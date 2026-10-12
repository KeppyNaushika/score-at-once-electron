/**
 * @fileoverview 注釈の本文（Discord Markdown + LaTeX記法）を、MathJax に渡す HTML にする
 * @description 本文は DB の値（`.sao` の取り込みで他人の書いた文字も入る）や AI の助言なので、
 * 先に HTML の特殊文字をエスケープし、出すタグは記法から作る自前のもの（strong/em/u/del）だけにする。
 * 数式の TeX もエスケープしたままでよい。HTML として読み込まれた時点で文字に戻り、MathJax は
 * その文字を TeX として読む（`$a<b$` は `$a&lt;b$` と書き、MathJax には `a<b` が届く）。
 */

/** HTML の特殊文字と、それを文字として書く参照 */
const HTML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

/** HTML の特殊文字（`& < > " '`）を文字参照にし、要素や属性として解釈されないようにする */
export function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (character) => HTML_ESCAPES[character] ?? character
  )
}

/** 色として通す形（`#rgb`〜`#rrggbbaa`・数値だけの rgb()/hsl()・英字だけの色名） */
const CSS_COLOR_PATTERNS = [
  /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
  /^(?:rgb|rgba|hsl|hsla)\(\s*[0-9.%\s,/+-]+\)$/i,
  /^[a-z]+$/i,
]

/**
 * 注釈の色（DB の値）を、SVG の文字列の `style` に埋め込める形のときだけ通す。
 * 色の形でなければ `fallbackColor` を返す
 */
export function sanitizeCssColor(color: string, fallbackColor: string): string {
  const trimmedColor = color.trim()
  return CSS_COLOR_PATTERNS.some((pattern) => pattern.test(trimmedColor))
    ? trimmedColor
    : fallbackColor
}

/**
 * 数式内容のサニタイゼーション（LaTeX記法用）
 * @param content サニタイゼーション対象の数式内容
 * @returns string サニタイゼーション済みの内容
 */
function sanitizeMathContent(content: string): string {
  // 数学記号、英数字、基本的なLaTeX記号のみ許可
  return content.replace(/[^a-zA-Z0-9\s+\-*/=(){}[\]^_\\{|}.,α-ωΑ-Ω]/g, "")
}

/**
 * LaTeX記法を$記法に正規化（\( \) → $...$, \[ \] → $$...$$）
 * @param text 変換対象のテキスト
 * @returns string 正規化されたテキスト
 */
function preprocessMathSyntax(text: string): string {
  // \( \) → $...$ 変換（インライン数式）
  const inlineNormalizedText = text.replace(
    /\\[(]\s*(.*?)\s*\\[)]/g,
    (_match, content: string) => `$${sanitizeMathContent(content)}$`
  )

  // \[ \] → $$...$$ 変換（ディスプレイ数式）
  return inlineNormalizedText.replace(
    /\\\[\s*(.*?)\s*\\\]/g,
    (_match, content: string) => `$$${sanitizeMathContent(content)}$$`
  )
}

/**
 * 指定された位置が数式コンテキスト内にあるかチェック
 * @param text 全体のテキスト
 * @param position チェックする位置
 * @returns boolean 数式内の場合はtrue
 */
function isInMathContext(text: string, position: number): boolean {
  // 数式区切り文字のパターン
  const mathPatterns = [
    /\$\$[\s\S]*?\$\$/g, // $$...$$
    /\$[^$\n]*?\$/g, // $...$
    /\\\[([\s\S]*?)\\\]/g, // \[...\]
    /\\\(([\s\S]*?)\\\)/g, // \(...\)
  ]

  return mathPatterns.some((pattern) =>
    Array.from(text.matchAll(pattern)).some(
      (match) =>
        position >= match.index && position < match.index + match[0].length
    )
  )
}

/**
 * 数式コンテキストを考慮した安全な文字列置換
 * @param text 対象テキスト
 * @param searchRegex 検索パターン（g フラグ付き）
 * @param replacement 置換関数（キャプチャした中身を受け取る）
 * @returns string 置換後のテキスト
 */
function safeReplace(
  text: string,
  searchRegex: RegExp,
  replacement: (captured: string) => string
): string {
  return text.replace(
    searchRegex,
    (match: string, captured: string, offset: number) =>
      // 数式コンテキスト内は置換しない
      isInMathContext(text, offset) ? match : replacement(captured)
  )
}

/**
 * Discord Markdown記法をHTMLに変換（数式保護機能付き）
 * @param text 変換対象のテキスト（HTML エスケープ済み）
 * @returns string HTML変換されたテキスト
 */
function parseDiscordMarkdown(text: string): string {
  const boldText = safeReplace(
    text,
    /\*\*(.+?)\*\*/g,
    (captured) => `<strong>${captured}</strong>`
  )
  const italicText = safeReplace(
    boldText,
    /(?<!\*)\*([^*\n]+?)\*(?!\*)/g,
    (captured) => `<em>${captured}</em>`
  )
  const underlinedText = safeReplace(
    italicText,
    /__(.+?)__/g,
    (captured) => `<u>${captured}</u>`
  )
  return safeReplace(
    underlinedText,
    /~~(.+?)~~/g,
    (captured) => `<del>${captured}</del>`
  )
}

/**
 * テキストをDiscord Markdown + LaTeX記法で解析してHTMLに変換
 *
 * 順序: LaTeX記法の正規化 → HTML エスケープ → 記法をタグへ。エスケープは `$`・`\`・`*`・`_`・`~`
 * を変えないので、数式の位置の判定と記法の置換はエスケープ後の文字列でもそのまま効く
 * @param text 変換対象のテキスト
 * @returns string 変換されたHTML
 */
export function parseTextWithMath(text: string): string {
  return parseDiscordMarkdown(escapeHtml(preprocessMathSyntax(text)))
}
