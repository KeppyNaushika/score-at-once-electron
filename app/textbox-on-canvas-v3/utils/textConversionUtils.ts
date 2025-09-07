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
 * Discord Markdown記法をHTMLに変換（数式保護機能付き）
 * @param text 変換対象のテキスト
 * @returns string HTML変換されたテキスト
 */
function parseDiscordMarkdown(text: string): string {
  // 1. MathJax構文を一時保護（プレースホルダーを変更）
  const mathParts: string[] = []
  let protectedText = text.replace(/\$\$.*?\$\$|\$.*?\$/g, (match) => {
    mathParts.push(match)
    return `<MATHPROTECT>${mathParts.length - 1}</MATHPROTECT>`
  })

  // 2. Discord Markdown → HTML変換
  protectedText = protectedText
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") // 太字
    .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, "<em>$1</em>") // 斜体（前後に*がない場合のみ）
    .replace(/__(.+?)__/g, "<u>$1</u>") // 下線
    .replace(/~~(.+?)~~/g, "<del>$1</del>") // 取り消し線

  // 3. MathJax構文を復元
  mathParts.forEach((math, index) => {
    protectedText = protectedText.replace(`<MATHPROTECT>${index}</MATHPROTECT>`, math)
  })

  return protectedText
}

/**
 * テキストをDiscord Markdown + LaTeX記法で解析してHTMLに変換
 * @param text 変換対象のテキスト
 * @returns string 変換されたHTML
 */
function parseTextWithMath(text: string): string {
  // 1. LaTeX記法を$記法に正規化
  const normalizedText = preprocessMathSyntax(text)

  // 2. Discord Markdown処理
  return parseDiscordMarkdown(normalizedText)
}

/**
 * 一時的なDOM容器を作成する（Discord Markdown用）
 * @returns 作成された一時的なDIV要素
 */
function createTempPreviewContainer(): HTMLDivElement {
  const tempDiv = document.createElement("div")
  tempDiv.style.cssText = `
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
  document.body.appendChild(tempDiv)
  return tempDiv
}

/**
 * DOM要素をクリーンアップする
 * @param container 削除するコンテナ要素
 */
function performCleanup(container: HTMLDivElement): void {
  try {
    if (document.body.contains(container)) {
      document.body.removeChild(container)
    }
  } catch (removeError) {
    // 削除エラーは無視
  }
}

/**
 * レンダリング完了後のコンテンツ処理
 * @param container レンダリングされたコンテナ
 * @param resolve Promise解決関数
 */
async function processRenderedContent(
  container: HTMLDivElement,
  resolve: (value: SVGSVGElement | null) => void,
): Promise<void> {
  try {
    // レンダリング完了まで待機
    await waitForRenderingComplete()

    // MathJax処理
    await processMathJax(container)

    // スタイルクリーンアップ
    cleanupElementStyles(container)
    await waitForRenderingComplete(1)

    // HTML内容を取得してSVG生成
    const htmlContent = container.innerHTML

    // MathJax対応の高品質SVG生成
    const svgElement = await createMathJaxSVG(htmlContent, 200, 50)

    // クリーンアップ
    performCleanup(container)

    resolve(svgElement)
  } catch (error) {
    performCleanup(container)
    resolve(null)
  }
}

/**
 * Discord Markdown + LaTeX記法テキストを高品質なSVG要素に変換する (V3版)
 * @param text 変換対象のテキスト（Discord Markdown + LaTeX記法対応）
 * @param _width 幅（互換性のため保持、実際は動的測定）
 * @param _height 高さ（互換性のため保持、実際は動的測定）
 * @returns Promise<SVGSVGElement | null> 変換されたSVG要素またはnull
 */
export async function convertTextToSvg(
  text: string,
  _width: number,
  _height: number,
): Promise<SVGSVGElement | null> {
  if (!text.trim()) {
    return null
  }

  try {
    // 1. Discord Markdown + LaTeX記法を解析してHTMLに変換
    const htmlContent = parseTextWithMath(text)

    // 2. DOM容器を作成してHTMLを配置
    const tempPreviewDiv = createTempPreviewContainer()
    tempPreviewDiv.innerHTML = htmlContent

    // 3. MathJax処理とSVG生成を実行
    return new Promise<SVGSVGElement | null>((resolve) => {
      // 短時間待機後に処理開始（DOM配置完了を確保）
      setTimeout(async () => {
        await processRenderedContent(tempPreviewDiv, resolve)
      }, 10)
    })
  } catch (error) {
    return null
  }
}
