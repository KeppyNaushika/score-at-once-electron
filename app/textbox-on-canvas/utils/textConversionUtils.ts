/**
 * @fileoverview テキスト変換ユーティリティ
 * @description ReactMarkdown、MutationObserver、テキスト-SVG変換の統合機能
 */

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeMathjax from 'rehype-mathjax/svg'
import { createRoot } from 'react-dom/client'

import { FONT_SETTINGS, DOM_STYLES } from '../constants'
import { waitForRenderingComplete, processMathJax, cleanupElementStyles, createMathJaxSVG } from './mathJaxUtils'

/**
 * 一時的なDOM容器を作成する（ReactMarkdown用）
 * @returns 作成された一時的なDIV要素
 */
function createTempPreviewContainer(): HTMLDivElement {
  const tempDiv = document.createElement('div')
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
      text
    )
  )
  return root
}

/**
 * DOM変更が重要な変更かどうかを判定する
 * @param mutations MutationObserverからの変更記録
 * @returns 重要な変更があった場合はtrue
 */
function hasSignificantChanges(mutations: MutationRecord[]): boolean {
  return mutations.some(
    (mutation) =>
      mutation.type === 'childList' &&
      (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)
  )
}

/**
 * 一時的なDOM要素をクリーンアップする
 * @param root Reactのルート
 * @param container 削除するコンテナ
 */
function performCleanup(root: any, container: HTMLDivElement): void {
  try {
    root.unmount()
    if (document.body.contains(container)) {
      document.body.removeChild(container)
    }
  } catch (cleanupError) {
    console.warn('クリーンアップに失敗しましたが処理を継続します:', cleanupError)
  }
}

/**
 * レンダリング完了後のコンテンツ処理を実行する
 * @param container レンダリング済みコンテナ
 * @param root Reactルート（クリーンアップ用）
 * @param resolve Promise解決関数
 */
async function processRenderedContent(
  container: HTMLDivElement,
  root: any,
  resolve: (value: SVGSVGElement | null) => void
): Promise<void> {
  try {
    console.log('🔄 レンダリング後処理開始:', container.innerHTML.substring(0, 100))
    
    // レンダリング完了まで待機
    await waitForRenderingComplete()
    
    // MathJax処理
    console.log('🧮 MathJax処理中...')
    await processMathJax(container)
    
    // スタイルクリーンアップ
    console.log('🧹 スタイルクリーンアップ中...')
    cleanupElementStyles(container)
    await waitForRenderingComplete(1)

    // HTML内容を取得してSVG生成
    const htmlContent = container.innerHTML
    console.log('📄 HTML内容取得完了:', htmlContent.substring(0, 200))
    
    // MathJax対応の高品質SVG生成
    const svgElement = await createMathJaxSVG(htmlContent, 200, 50)
    
    // クリーンアップ
    performCleanup(root, container)
    
    console.log('✅ SVG生成完了')
    resolve(svgElement)
    
  } catch (error) {
    console.error('❌ レンダリング後処理エラー:', error)
    performCleanup(root, container)
    resolve(null)
  }
}

/**
 * MutationObserverのコールバック処理
 * @param mutations 変更記録
 * @param container 監視対象コンテナ
 * @param root Reactルート
 * @param resolve Promise解決関数
 * @param renderingComplete 処理完了フラグの参照
 * @param observer MutationObserver（停止用）
 */
async function handleMutationObserver(
  mutations: MutationRecord[],
  container: HTMLDivElement,
  root: any,
  resolve: (value: SVGSVGElement | null) => void,
  renderingComplete: { current: boolean },
  observer: MutationObserver
): Promise<void> {
  console.log('🔍 MutationObserver発火:', {
    mutationsCount: mutations.length,
    hasChanges: hasSignificantChanges(mutations),
    childrenCount: container.children.length
  })

  if (renderingComplete.current) return

  if (hasSignificantChanges(mutations) && container.children.length > 0) {
    console.log('✨ 描画完了検出、SVG生成開始...')
    renderingComplete.current = true
    observer.disconnect()
    await processRenderedContent(container, root, resolve)
  }
}

/**
 * Markdownテキストを高品質なSVG要素に変換する
 * @param text 変換対象のMarkdownテキスト
 * @param _width 幅（互換性のため保持、実際は動的測定）
 * @param _height 高さ（互換性のため保持、実際は動的測定）
 * @returns Promise<SVGSVGElement | null> 変換されたSVG要素またはnull
 */
export async function convertTextToSvg(
  text: string,
  _width: number,
  _height: number
): Promise<SVGSVGElement | null> {
  if (!text.trim()) {
    console.log('空のテキストのため変換をスキップ')
    return null
  }

  try {
    console.log('🏗️ DOM容器作成中...')
    const tempPreviewDiv = createTempPreviewContainer()
    
    console.log('⚛️ ReactMarkdown描画中...')
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
          observer
        )
      })

      observer.observe(tempPreviewDiv, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false,
      })

      console.log('👀 MutationObserver開始')

      // デバッグ用: 初期状態チェック
      setTimeout(() => {
        console.log('🔍 1秒後のコンテナ状態:', {
          childrenCount: tempPreviewDiv.children.length,
          innerHTML: tempPreviewDiv.innerHTML.substring(0, 100),
          textContent: tempPreviewDiv.textContent?.substring(0, 100)
        })
      }, 1000)

      // フォールバックタイムアウト（10秒）
      setTimeout(() => {
        if (!renderingComplete.current) {
          console.log('⏰ タイムアウト発生（10秒）')
          console.log('💀 最終コンテナ状態:', {
            childrenCount: tempPreviewDiv.children.length,
            innerHTML: tempPreviewDiv.innerHTML.substring(0, 200)
          })
          observer.disconnect()
          performCleanup(root, tempPreviewDiv)
          resolve(null)
        }
      }, 10000)
    })

  } catch (error) {
    console.error('💥 convertTextToSvg全体エラー:', error)
    return null
  }
}