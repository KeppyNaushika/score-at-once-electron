/**
 * @fileoverview テキスト変換ユーティリティ (V3版)
 * @description ReactMarkdownとMathJaxを使用したテキスト→SVG変換の高度な機能を提供
 */

import React from "react"
import { createRoot } from "react-dom/client"
import ReactMarkdown from "react-markdown"
import rehypeMathjax from "rehype-mathjax/svg"
import remarkMath from "remark-math"

import { FONT_SETTINGS } from "../constants"
import {
  cleanupElementStyles,
  createMathJaxSVG,
  processMathJax,
  waitForRenderingComplete,
} from "./mathJaxUtils"

/**
 * MutationObserverで使用する変更検出の重要度判定
 * @param mutations 変更記録の配列
 * @returns boolean 重要な変更があるかどうか
 */
function hasSignificantChanges(mutations: MutationRecord[]): boolean {
  return mutations.some(
    (mutation) =>
      mutation.type === "childList" &&
      (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0),
  )
}

/**
 * 一時的なDOM容器を作成する（ReactMarkdown用）
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
 * ReactMarkdownコンテンツを指定されたコンテナにレンダリングする
 * @param container レンダリング先のコンテナ
 * @param text レンダリングするMarkdownテキスト
 * @returns Reactのルート（クリーンアップ用）
 */
function renderReactMarkdown(container: HTMLDivElement, text: string) {
  const root = createRoot(container)
  root.render(
    React.createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkMath],
        rehypePlugins: [rehypeMathjax],
      },
      text,
    ),
  )
  return root
}

/**
 * クリーンアップ処理を実行する
 * @param root React Root インスタンス
 * @param container 削除するコンテナ要素
 */
function performCleanup(root: any, container: HTMLDivElement): void {
  try {
    if (root) {
      root.unmount()
    }
  } catch (cleanupError) {
    // クリーンアップエラーは無視
  }

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
 * @param root React Root インスタンス
 * @param resolve Promise解決関数
 */
async function processRenderedContent(
  container: HTMLDivElement,
  root: any,
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
    performCleanup(root, container)

    resolve(svgElement)
  } catch (error) {
    performCleanup(root, container)
    resolve(null)
  }
}

/**
 * MutationObserverのコールバック処理
 * @param mutations 変更記録の配列
 * @param container 監視対象のコンテナ
 * @param root React Root インスタンス
 * @param resolve Promise解決関数
 * @param renderingComplete レンダリング完了フラグ
 * @param observer MutationObserverインスタンス
 */
async function handleMutationObserver(
  mutations: MutationRecord[],
  container: HTMLDivElement,
  root: any,
  resolve: (value: SVGSVGElement | null) => void,
  renderingComplete: { current: boolean },
  observer: MutationObserver,
): Promise<void> {
  if (renderingComplete.current) return

  if (hasSignificantChanges(mutations) && container.children.length > 0) {
    renderingComplete.current = true
    observer.disconnect()
    await processRenderedContent(container, root, resolve)
  }
}

/**
 * Markdownテキストを高品質なSVG要素に変換する (V3版)
 * @param text 変換対象のMarkdownテキスト
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
    const tempPreviewDiv = createTempPreviewContainer()
    const root = renderReactMarkdown(tempPreviewDiv, text)

    return new Promise<SVGSVGElement | null>((resolve) => {
      const renderingComplete = { current: false }

      const observer = new MutationObserver(async (mutations) => {
        await handleMutationObserver(
          mutations,
          tempPreviewDiv,
          root,
          resolve,
          renderingComplete,
          observer,
        )
      })

      observer.observe(tempPreviewDiv, {
        childList: true,
        subtree: true,
        attributes: true,
      })

      // タイムアウト設定（10秒）
      setTimeout(async () => {
        if (!renderingComplete.current) {
          observer.disconnect()
          performCleanup(root, tempPreviewDiv)
          resolve(null)
        }
      }, 10000)
    })
  } catch (error) {
    return null
  }
}
