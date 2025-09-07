/**
 * @fileoverview テキスト変換ユーティリティ (V3版 - Discord Markdown + LaTeX記法)
 * @description Discord Markdownスタイル記法とMathJaxを使用したテキスト→SVG変換機能を提供
 */

import { FONT_SETTINGS } from "../constants"
import {
  cleanupElementStyles,
  createMathJaxSVG,
  processMathJax,
  waitForRenderingComplete,
} from "./mathJaxUtils"

/**
 * セキュリティチェック: 危険なパターンを検出
 * @param text チェック対象のテキスト
 * @returns boolean 危険なパターンが含まれている場合はtrue
 */
function isDangerous(text: string): boolean {
  const dangerousPatterns = [
    /javascript:/i,
    /<script/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ]
  return dangerousPatterns.some((pattern) => pattern.test(text))
}

/**
 * 数式内容のサニタイゼーション（LaTeX記法用）
 * @param content サニタイゼーション対象の数式内容
 * @returns string サニタイゼーション済みの内容
 */
function sanitizeMathContent(content: string): string {
  // 数学記号、英数字、基本的なLaTeX記号のみ許可
  return content.replace(
    /[^a-zA-Z0-9\s+\-*/=(){}[\]^_\\{|}.,\u03B1-\u03C9\u0391-\u03A9]/g,
    "",
  )
}

/**
 * LaTeX記法を$記法に正規化（\( \) → $...$, \[ \] → $$...$$）
 * @param text 変換対象のテキスト
 * @returns string 正規化されたテキスト
 */
function preprocessMathSyntax(text: string): string {
  // セキュリティチェック
  if (isDangerous(text)) {
    console.warn("危険なパターンが検出されました")
    return text
  }

  // \( \) → $...$ 変換（インライン数式）
  text = text.replace(/\\[(]\s*(.*?)\s*\\[)]/g, (_match, content) => {
    const safeContent = sanitizeMathContent(content)
    return `$${safeContent}$`
  })

  // \[ \] → $$...$$ 変換（ディスプレイ数式）
  text = text.replace(/\\[\[]\s*(.*?)\s*\\[\]]/g, (_match, content) => {
    const safeContent = sanitizeMathContent(content)
    return `$$${safeContent}$$`
  })

  return text
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
    /\$\$[\s\S]*?\$\$/g,  // $$...$$
    /\$[^$\n]*?\$/g,      // $...$
    /\\[\[]([\s\S]*?)\\[\]]/g,  // \[...\]
    /\\[(]([\s\S]*?)\\[)]/g     // \(...\)
  ]

  for (const pattern of mathPatterns) {
    let match
    pattern.lastIndex = 0 // Reset regex state
    while ((match = pattern.exec(text)) !== null) {
      if (position >= match.index && position < match.index + match[0].length) {
        return true
      }
    }
  }

  return false
}

/**
 * 数式コンテキストを考慮した安全な文字列置換
 * @param text 対象テキスト
 * @param searchRegex 検索パターン
 * @param replacement 置換文字列または関数
 * @returns string 置換後のテキスト
 */
function safeReplace(
  text: string,
  searchRegex: RegExp,
  replacement: string | ((match: string, ...args: any[]) => string)
): string {
  let result = text
  let match
  let offset = 0

  // グローバルフラグを確保
  const globalRegex = new RegExp(searchRegex.source, searchRegex.flags.includes('g') ? searchRegex.flags : searchRegex.flags + 'g')

  while ((match = globalRegex.exec(text)) !== null) {
    const matchPosition = match.index

    // 数式コンテキスト内でない場合のみ置換
    if (!isInMathContext(text, matchPosition)) {
      const replacementText = typeof replacement === 'function'
        ? replacement(match[0], ...match.slice(1))
        : replacement

      // 実際の置換位置を計算（これまでの置換によるオフセットを考慮）
      const actualPosition = matchPosition + offset
      const actualLength = match[0].length

      result = result.slice(0, actualPosition) + replacementText + result.slice(actualPosition + actualLength)

      // オフセットを更新
      offset += replacementText.length - match[0].length
    }
  }

  return result
}

/**
 * Discord Markdown記法をHTMLに変換（数式保護機能付き）
 * @param text 変換対象のテキスト
 * @returns string HTML変換されたテキスト
 */
function parseDiscordMarkdown(text: string): string {
  let result = text

  // Discord Markdown → HTML変換（数式コンテキストを考慮）
  result = safeReplace(result, /\*\*(.+?)\*\*/g, "<strong>$1</strong>") // 太字
  result = safeReplace(result, /(?<!\*)\*([^*\n]+?)\*(?!\*)/g, "<em>$1</em>") // 斜体
  result = safeReplace(result, /__(.+?)__/g, "<u>$1</u>") // 下線
  result = safeReplace(result, /~~(.+?)~~/g, "<del>$1</del>") // 取り消し線

  return result
}

/**
 * テキストをDiscord Markdown + LaTeX記法で解析してHTMLに変換
 * @param text 変換対象のテキスト
 * @returns string 変換されたHTML
 */
export function parseTextWithMath(text: string): string {
  // 1. LaTeX記法を$記法に正規化
  const normalizedText = preprocessMathSyntax(text)

  // 2. Discord Markdown処理
  return parseDiscordMarkdown(normalizedText)
}

// MathJax処理用の永続的なDOM容器
let sharedMathJaxContainer: HTMLDivElement | null = null

/**
 * MathJax処理用の永続的なDOM容器を取得または作成する
 * DIVプレビューとSVG変換で共通のDOM管理方式を使用
 * @returns 永続的なDIV要素
 */
function getSharedMathJaxContainer(): HTMLDivElement {
  if (!sharedMathJaxContainer || !document.body.contains(sharedMathJaxContainer)) {
    sharedMathJaxContainer = document.createElement("div")
    sharedMathJaxContainer.style.cssText = `
      position: absolute;
      left: -9999px;
      top: -9999px;
      font-family: ${FONT_SETTINGS.DEFAULT_FAMILY};
      font-size: ${FONT_SETTINGS.DEFAULT_SIZE}px;
      line-height: ${FONT_SETTINGS.DEFAULT_LINE_HEIGHT};
      color: ${FONT_SETTINGS.DEFAULT_COLOR};
      background: white;
      padding: 0;
      margin: 0;
      border: 0;
      width: max-content;
      height: max-content;
      display: block;
    `
    document.body.appendChild(sharedMathJaxContainer)
  }
  return sharedMathJaxContainer
}

/**
 * MathJax処理を実行する共通ロジック
 * DIVプレビューとSVG変換で共通使用
 * @param container 処理対象のDOM要素
 * @param htmlContent 処理するHTML内容
 */
export async function processMathJaxContent(
  container: HTMLDivElement,
  htmlContent: string,
): Promise<void> {
  // 1. HTML内容を設定
  container.innerHTML = htmlContent

  // 2. レンダリング完了まで待機
  await waitForRenderingComplete()

  // 3. MathJax処理
  await processMathJax(container)

  // 4. スタイルクリーンアップ
  cleanupElementStyles(container)
  await waitForRenderingComplete(1)
}

/**
 * SVG変換のための処理
 * @param container 処理済みのDOM要素
 * @returns Promise<SVGSVGElement | null> 生成されたSVG要素またはnull
 */
async function convertContainerToSvg(
  container: HTMLDivElement,
): Promise<SVGSVGElement | null> {
  try {
    // MathJax処理済みのHTML内容を取得
    const processedHtml = container.innerHTML

    // SVG生成
    const svgElement = await createMathJaxSVG(processedHtml, 200, 50)
    return svgElement
  } catch (error) {
    console.error("SVG変換エラー:", error)
    return null
  }
}

/**
 * Discord Markdown + LaTeX記法テキストを高品質なSVG要素に変換する (V3版)
 * @param text 変換対象のテキスト（Discord Markdown + LaTeX記法対応）
 * @param _width 幅（互換性のため保持、実際は動的測定）
 * @param _height 高さ（互換性のため保持、実際は動的測定）
 * @returns Promise<SVGSVGElement | null> 変換されたSVG要素またはnull
 */
/**
 * 安全な文字列置換のテスト用関数
 * @param text テスト対象のテキスト
 * @returns string 処理結果のデバッグ情報
 */
export function testSafeReplace(text: string): string {
  console.log("=== 安全な文字列置換テスト ===")
  console.log("入力:", text)

  const result = parseDiscordMarkdown(text)

  console.log("出力:", result)
  console.log("============================")

  return result
}

export async function convertTextToSvg(
  text: string,
  _width: number,
  _height: number,
): Promise<SVGSVGElement | null> {
  if (!text.trim()) {
    return null
  }

  try {
    // 1. テキストをHTMLに変換
    const htmlContent = parseTextWithMath(text)

    // 2. 共通のMathJax処理コンテナを取得
    const container = getSharedMathJaxContainer()

    // 3. MathJax処理を実行（DIVプレビューと同じロジック）
    await processMathJaxContent(container, htmlContent)

    // 4. 処理済みコンテナをSVGに変換
    return await convertContainerToSvg(container)

  } catch (error) {
    console.error("テキストからSVG変換エラー:", error)
    return null
  }
}
