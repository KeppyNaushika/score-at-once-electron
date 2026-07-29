/**
 * @fileoverview テキスト変換ユーティリティ (V3版 - Discord Markdown + LaTeX記法)
 * @description Discord Markdownスタイル記法とMathJaxを使用したテキスト→SVG変換機能を提供
 */

import { FONT_SETTINGS } from "./constants"
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
    ""
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
    return text
  }

  // \( \) → $...$ 変換（インライン数式）
  text = text.replace(/\\[(]\s*(.*?)\s*\\[)]/g, (_match, content) => {
    const safeContent = sanitizeMathContent(content)
    return `$${safeContent}$`
  })

  // \[ \] → $$...$$ 変換（ディスプレイ数式）
  text = text.replace(/\\\[\s*(.*?)\s*\\\]/g, (_match, content) => {
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
    /\$\$[\s\S]*?\$\$/g, // $$...$$
    /\$[^$\n]*?\$/g, // $...$
    /\\\[([\s\S]*?)\\\]/g, // \[...\]
    /\\\(([\s\S]*?)\\\)/g, // \(...\)
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
  replacement: string | ((match: string, ...args: unknown[]) => string)
): string {
  let result = text
  let match
  let offset = 0

  // グローバルフラグを確保
  const globalRegex = new RegExp(
    searchRegex.source,
    searchRegex.flags.includes("g")
      ? searchRegex.flags
      : searchRegex.flags + "g"
  )

  while ((match = globalRegex.exec(text)) !== null) {
    const matchPosition = match.index

    // 数式コンテキスト内でない場合のみ置換
    if (!isInMathContext(text, matchPosition)) {
      const replacementText =
        typeof replacement === "function"
          ? replacement(match[0], ...match.slice(1))
          : replacement

      // 実際の置換位置を計算（これまでの置換によるオフセットを考慮）
      const actualPosition = matchPosition + offset
      const actualLength = match[0].length

      result =
        result.slice(0, actualPosition) +
        replacementText +
        result.slice(actualPosition + actualLength)

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
  // 注意: safeReplaceの文字列置換では$1がリテラル扱いされるため、関数置換を使用
  result = safeReplace(
    result,
    /\*\*(.+?)\*\*/g,
    (_m, p1) => `<strong>${p1}</strong>`
  ) // 太字
  result = safeReplace(
    result,
    /(?<!\*)\*([^*\n]+?)\*(?!\*)/g,
    (_m, p1) => `<em>${p1}</em>`
  ) // 斜体
  result = safeReplace(result, /__(.+?)__/g, (_m, p1) => `<u>${p1}</u>`) // 下線
  result = safeReplace(result, /~~(.+?)~~/g, (_m, p1) => `<del>${p1}</del>`) // 取り消し線

  return result
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
 * MathJax処理用の一時的なDOM容器を作成する
 * 各テキスト要素ごとに独立したコンテナを使用し、並列処理を可能にする
 * @param fontSize フォントサイズ（デフォルト: FONT_SETTINGS.DEFAULT_SIZE）
 * @returns 新しいDIV要素
 */
function createMathJaxContainer(
  fontSize: number = FONT_SETTINGS.DEFAULT_SIZE
): HTMLDivElement {
  const container = document.createElement("div")
  container.style.cssText = `
    position: absolute;
    left: -9999px;
    top: -9999px;
    font-family: ${FONT_SETTINGS.DEFAULT_FAMILY};
    font-size: ${fontSize}px;
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
  document.body.appendChild(container)
  return container
}

/**
 * 一時的なDOM容器を破棄する
 * @param container 破棄するコンテナ
 */
function destroyMathJaxContainer(container: HTMLDivElement): void {
  if (container && container.parentNode) {
    container.parentNode.removeChild(container)
  }
}

/**
 * SVG変換のための処理
 * @param container 処理済みのDOM要素
 * @param fontSize フォントサイズ
 * @returns Promise<SVGSVGElement | null> 生成されたSVG要素またはnull
 */
async function convertContainerToSvg(
  container: HTMLDivElement,
  fontSize: number = FONT_SETTINGS.DEFAULT_SIZE
): Promise<SVGSVGElement | null> {
  try {
    // MathJax処理済みのHTML内容を取得
    const processedHtml = container.innerHTML

    // SVG生成（fontSizeを渡す）
    const svgElement = await createMathJaxSVG(processedHtml, 200, 50, fontSize)

    // SVGプレビューに表示（デバッグ用）
    displaySvgPreview(svgElement)

    return svgElement
  } catch {
    return null
  }
}

/**
 * SVG変換結果をプレビュー表示する
 * @param svgElement 表示するSVG要素
 */
function displaySvgPreview(svgElement: SVGSVGElement | null): void {
  const previewContainer = document.getElementById("svg-preview-container")
  if (!previewContainer) return

  if (svgElement) {
    // 既存の内容をクリア
    previewContainer.innerHTML = ""

    // SVGをクローンして表示
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement
    clonedSvg.style.border = "1px solid #007acc"
    clonedSvg.style.backgroundColor = "white"
    clonedSvg.style.margin = "4px"

    previewContainer.appendChild(clonedSvg)
  } else {
    previewContainer.innerHTML =
      '<div class="text-red-500 text-sm">SVG生成失敗</div>'
  }
}

export async function convertTextToSvg(
  text: string,
  _width: number,
  _height: number,
  horizontalAlign: "left" | "center" | "right" = "left",
  verticalAlign: "top" | "center" | "bottom" = "top",
  textSize: number = FONT_SETTINGS.DEFAULT_SIZE,
  textColor: string = "#000000"
): Promise<SVGSVGElement | null> {
  if (!text.trim()) {
    return null
  }

  try {
    // 1. \nで改行分割
    const lines = text.split("\n").filter((line) => line.trim() !== "")

    if (lines.length === 0) {
      return null
    }

    // 2. 各行をSVGに変換（fontSizeを渡す）
    const lineSvgs: SVGSVGElement[] = []

    for (const line of lines) {
      const lineSvg = await convertSingleLineToSvg(line.trim(), textSize)
      if (lineSvg) {
        lineSvgs.push(lineSvg)
      }
    }

    if (lineSvgs.length === 0) {
      return null
    }

    // 3. 複数行SVGを結合（5px間隔、fontSizeを渡す）
    return combineLineSvgs(
      lineSvgs,
      5,
      _width,
      _height,
      horizontalAlign,
      verticalAlign,
      textColor,
      textSize
    )
  } catch {
    return null
  }
}

/**
 * 単一行をSVGに変換（改行なし）
 * 並列処理対応: 各呼び出しで独立したコンテナを使用
 * @param lineText 単一行のテキスト
 * @param fontSize フォントサイズ
 * @returns Promise<SVGSVGElement | null> 生成されたSVG要素またはnull
 */
async function convertSingleLineToSvg(
  lineText: string,
  fontSize: number = FONT_SETTINGS.DEFAULT_SIZE
): Promise<SVGSVGElement | null> {
  if (!lineText.trim()) {
    return null
  }

  // 各行ごとに独立したコンテナを作成（並列処理で競合しない）
  const container = createMathJaxContainer(fontSize)

  try {
    // 1. テキストをHTMLに変換
    const htmlContent = parseTextWithMath(lineText)

    // 2. MathJax処理を実行（単一行、overflow: hidden）
    await processSingleLineMathJax(container, htmlContent)

    // 3. 処理済みコンテナをSVGに変換（fontSizeを渡す）
    return await convertContainerToSvg(container, fontSize)
  } catch {
    return null
  } finally {
    // 4. コンテナを破棄（メモリリーク防止）
    destroyMathJaxContainer(container)
  }
}

/**
 * 単一行用MathJax処理（改行禁止）
 * @param container 処理対象のDOM要素
 * @param htmlContent 処理するHTML内容
 */
async function processSingleLineMathJax(
  container: HTMLDivElement,
  htmlContent: string
): Promise<void> {
  // 1. HTML内容を設定（改行禁止スタイル適用）
  container.innerHTML = `<div style="white-space: nowrap; overflow: hidden;">${htmlContent}</div>`

  // 2. レンダリング完了まで待機
  await waitForRenderingComplete()

  // 3. MathJax処理
  await processMathJax(container)

  // 4. スタイルクリーンアップ
  cleanupElementStyles(container)
  await waitForRenderingComplete(1)
}

function combineLineSvgs(
  lineSvgs: SVGSVGElement[],
  spacing: number,
  _targetWidth?: number,
  _targetHeight?: number,
  horizontalAlign: "left" | "center" | "right" = "left",
  verticalAlign: "top" | "center" | "bottom" = "top",
  textColor: string = "#000000",
  fontSize: number = FONT_SETTINGS.DEFAULT_SIZE
): SVGSVGElement {
  // 各行のサイズを取得
  const lineInfos = lineSvgs.map((svg) => ({
    svg,
    width: parseFloat(svg.getAttribute("width") || "0"),
    height: parseFloat(svg.getAttribute("height") || "0"),
  }))

  // 自然サイズを計算（拡大縮小なし）
  const naturalWidth = Math.max(...lineInfos.map((info) => info.width))
  const naturalHeight =
    lineInfos.reduce((sum, info) => sum + info.height, 0) +
    (lineInfos.length - 1) * spacing

  // Flexboxを使用した配置のためのCSS変数
  const justifyContent =
    horizontalAlign === "left"
      ? "flex-start"
      : horizontalAlign === "center"
        ? "center"
        : "flex-end"
  const alignItems =
    verticalAlign === "top"
      ? "flex-start"
      : verticalAlign === "center"
        ? "center"
        : "flex-end"

  // コンテンツを行ごとに収集
  const contentLines: string[] = []
  lineInfos.forEach(({ svg }) => {
    const foreignObject = svg.querySelector("foreignObject")
    const innerDiv = foreignObject?.querySelector("div > div")
    const divContent = innerDiv?.innerHTML || ""
    contentLines.push(divContent)
  })

  // Flexbox構造でSVG生成（自然サイズを使用）
  const combinedSvgContent = `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="${naturalWidth}"
         height="${naturalHeight}"
         viewBox="0 0 ${naturalWidth} ${naturalHeight}">
      <foreignObject x="0" y="0" width="${naturalWidth}" height="${naturalHeight}" overflow="visible">
        <div xmlns="http://www.w3.org/1999/xhtml" style="
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: ${alignItems};
          align-items: ${justifyContent};
          gap: 5px;
          padding: 0;
          margin: 0;
          box-sizing: border-box;
        ">
          ${contentLines
            .map(
              (content) => `
            <div style="
              font-size: ${fontSize}px;
              line-height: 1;
              color: ${textColor};
              text-align: left;
              text-justify: none;
              word-break: normal;
              white-space: nowrap;
              text-decoration: none;
              letter-spacing: normal;
              word-spacing: normal;
              text-rendering: optimizeSpeed;
              overflow: hidden;
            ">
              <style>
                mjx-container[jax="SVG"] > svg { overflow: visible !important; }
                mjx-container svg { overflow: visible !important; }
              </style>
              ${content}
            </div>
          `
            )
            .join("")}
        </div>
      </foreignObject>
    </svg>
  `

  const parser = new DOMParser()
  const svgDoc = parser.parseFromString(combinedSvgContent, "image/svg+xml")
  return svgDoc.documentElement as unknown as SVGSVGElement
}
