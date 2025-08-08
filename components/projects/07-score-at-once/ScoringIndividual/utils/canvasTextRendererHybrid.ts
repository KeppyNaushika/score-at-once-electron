/**
 * @fileoverview 個別表示テキストボックス用Canvas描画システム
 * @description textbox-on-canvasの完璧なロジックを個別表示機能に完全移植
 * 
 * ## 主要機能
 * - MathJax数式の高精度レンダリング
 * - 動的サイズ測定（余白なし完璧測定）
 * - ReactMarkdown + MathJax完全統合
 * - ベースライン配置による美しいテキスト表示
 */

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeMathjax from 'rehype-mathjax/svg'
import { createRoot } from 'react-dom/client'

/**
 * テキストレンダリングオプション
 */
export interface TextRenderOptions {
  text: string
  color: string
  fontSize: number
  maxWidth: number
  maxHeight: number
  backgroundColor?: string
}

/**
 * テキスト描画寸法情報
 */
export interface TextDimensions {
  width: number
  height: number
  scale: number
}

/**
 * フォント設定定数
 */
const FONT_SETTINGS = {
  DEFAULT_FAMILY: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans JP", "Hiragino Kaku Gothic ProN", "ヒラギノ角ゴ ProN W3", Arial, sans-serif',
  DEFAULT_LINE_HEIGHT: 1,
} as const

/**
 * SVG設定定数
 */
const SVG_SETTINGS = {
  NAMESPACE: 'http://www.w3.org/2000/svg',
  XHTML_NAMESPACE: 'http://www.w3.org/1999/xhtml',
  OVERFLOW: 'visible',
} as const

/**
 * MathJax overflow対策CSS
 */
const MATHJAX_OVERFLOW_CSS = `
  mjx-container[jax="SVG"] > svg { overflow: visible !important; }
  mjx-container svg { overflow: visible !important; }
`

/**
 * ブラウザの描画完了を待機する
 * @param frames 待機するフレーム数
 */
async function waitForRenderingComplete(frames: number = 2): Promise<void> {
  for (let i = 0; i < frames; i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
}

/**
 * MathJax数式の組版処理を実行する
 * @param container 処理対象のDOM要素
 */
async function processMathJax(container: HTMLElement): Promise<void> {
  const MathJax = (window as any).MathJax
  
  if (!MathJax || !MathJax.typesetPromise) {
    return
  }

  try {
    await MathJax.typesetPromise([container])
    await waitForRenderingComplete()
  } catch (error) {
    // MathJax処理失敗時も継続
  }
}

/**
 * DOM要素のスタイルをクリーンアップする（MathJax用最適化）
 * @param container クリーンアップ対象のコンテナ
 */
function cleanupElementStyles(container: HTMLElement): void {
  // 全要素のマージン・パディング・ボーダーをリセット
  const allElements = container.querySelectorAll('*')
  allElements.forEach((element) => {
    const htmlElement = element as HTMLElement
    htmlElement.style.margin = '0'
    htmlElement.style.padding = '0'
    htmlElement.style.border = '0'
  })

  // 段落要素の特別処理
  const paragraphs = container.querySelectorAll('p')
  paragraphs.forEach((p) => {
    const htmlP = p as HTMLElement
    htmlP.style.margin = '0'
    htmlP.style.padding = '0'
    htmlP.style.lineHeight = FONT_SETTINGS.DEFAULT_LINE_HEIGHT.toString()
  })

  // MathJax要素のベースライン配置処理
  const mjxElements = container.querySelectorAll('mjx-container')
  mjxElements.forEach((mjx) => {
    const htmlMjx = mjx as HTMLElement
    htmlMjx.style.margin = '0'
    htmlMjx.style.padding = '0'
    htmlMjx.style.verticalAlign = 'baseline' // ベースライン配置
  })
}

/**
 * MathJax処理後の実際のコンテンツサイズを正確に測定する
 * @param htmlContent 測定対象のHTML文字列
 * @param fontSize フォントサイズ
 * @param color テキスト色
 */
async function measureMathJaxContentSize(
  htmlContent: string,
  fontSize: number,
  color: string
): Promise<{ width: number; height: number }> {
  // 一時的なDOM要素を作成
  const tempDiv = document.createElement('div')
  tempDiv.style.cssText = `
    position: absolute;
    left: -9999px;
    top: -9999px;
    font-size: ${fontSize}px;
    line-height: ${FONT_SETTINGS.DEFAULT_LINE_HEIGHT};
    color: ${color};
    visibility: hidden;
    width: max-content;
    height: max-content;
  `
  tempDiv.innerHTML = htmlContent
  document.body.appendChild(tempDiv)

  let measuredSize = { width: 200, height: 50 }

  try {
    // MathJax処理を完了まで待機
    await processMathJax(tempDiv)
    await waitForRenderingComplete(2)

    // 全要素の実際のサイズを測定
    const boundingRect = tempDiv.getBoundingClientRect()
    const scrollSize = {
      width: tempDiv.scrollWidth,
      height: tempDiv.scrollHeight
    }

    // MathJax要素の詳細測定
    const mjxContainers = tempDiv.querySelectorAll('mjx-container')
    let maxMathJaxHeight = 0
    
    mjxContainers.forEach((mjx) => {
      const mjxRect = mjx.getBoundingClientRect()
      maxMathJaxHeight = Math.max(maxMathJaxHeight, mjxRect.height)
    })

    // 最大値を採用（完璧な測定のため余白なし）
    measuredSize = {
      width: Math.max(
        200,
        Math.ceil(Math.max(boundingRect.width, scrollSize.width))
      ),
      height: Math.max(
        50,
        Math.ceil(Math.max(boundingRect.height, scrollSize.height, maxMathJaxHeight))
      )
    }

  } catch (error) {
    console.error('MathJax測定エラー:', error)
  } finally {
    // 必ずクリーンアップする
    if (document.body.contains(tempDiv)) {
      document.body.removeChild(tempDiv)
    }
  }

  return measuredSize
}

/**
 * 測定結果に基づいて最適なSVGを生成する
 * @param htmlContent HTML内容
 * @param measuredSize 測定されたサイズ
 * @param fontSize フォントサイズ
 * @param color テキスト色
 */
function createOptimizedSVG(
  htmlContent: string, 
  measuredSize: { width: number; height: number },
  fontSize: number,
  color: string
): SVGSVGElement {
  const svgString = `
    <svg xmlns="${SVG_SETTINGS.NAMESPACE}" 
         width="${measuredSize.width}" 
         height="${measuredSize.height}" 
         viewBox="0 0 ${measuredSize.width} ${measuredSize.height}" 
         overflow="${SVG_SETTINGS.OVERFLOW}">
      <foreignObject x="0" y="0" 
                     width="${measuredSize.width}" 
                     height="${measuredSize.height}" 
                     overflow="${SVG_SETTINGS.OVERFLOW}">
        <div xmlns="${SVG_SETTINGS.XHTML_NAMESPACE}">
          <div style="font-size: ${fontSize}px; 
                     line-height: ${FONT_SETTINGS.DEFAULT_LINE_HEIGHT}; 
                     color: ${color}; 
                     overflow: visible;">
            <style>${MATHJAX_OVERFLOW_CSS}</style>
            ${htmlContent}
          </div>
        </div>
      </foreignObject>
    </svg>
  `

  const parser = new DOMParser()
  const svgDoc = parser.parseFromString(svgString, 'image/svg+xml')
  return svgDoc.documentElement as unknown as SVGSVGElement
}

/**
 * 一時的なDOM容器を作成する（ReactMarkdown用）
 */
function createTempPreviewContainer(fontSize: number, color: string): HTMLDivElement {
  const tempDiv = document.createElement('div')
  tempDiv.style.cssText = `
    position: absolute;
    left: -9999px;
    top: -9999px;
    font-family: ${FONT_SETTINGS.DEFAULT_FAMILY};
    font-size: ${fontSize}px;
    line-height: ${FONT_SETTINGS.DEFAULT_LINE_HEIGHT};
    color: ${color};
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
 */
function performCleanup(root: any, container: HTMLDivElement): void {
  try {
    root.unmount()
    if (document.body.contains(container)) {
      document.body.removeChild(container)
    }
  } catch (cleanupError) {
    // クリーンアップ失敗時も継続
  }
}

/**
 * Markdownテキストを高品質なSVG要素に変換する
 * @param text 変換対象のMarkdownテキスト
 * @param fontSize フォントサイズ
 * @param color テキスト色
 */
async function convertTextToSvg(
  text: string,
  fontSize: number,
  color: string
): Promise<SVGSVGElement | null> {
  if (!text.trim()) {
    return null
  }

  try {
    const tempPreviewDiv = createTempPreviewContainer(fontSize, color)
    const root = renderReactMarkdown(tempPreviewDiv, text)

    return new Promise<SVGSVGElement | null>((resolve) => {
      let renderingComplete = false

      const observer = new MutationObserver(async (mutations) => {
        if (renderingComplete) return

        if (hasSignificantChanges(mutations) && tempPreviewDiv.children.length > 0) {
          renderingComplete = true
          observer.disconnect()

          try {
            await waitForRenderingComplete()
            await processMathJax(tempPreviewDiv)
            cleanupElementStyles(tempPreviewDiv)
            await waitForRenderingComplete(1)

            // HTML内容を取得してSVG生成
            const htmlContent = tempPreviewDiv.innerHTML
            
            // MathJax対応の高品質SVG生成
            const measuredSize = await measureMathJaxContentSize(htmlContent, fontSize, color)
            const svgElement = createOptimizedSVG(htmlContent, measuredSize, fontSize, color)
            
            performCleanup(root, tempPreviewDiv)
            resolve(svgElement)
            
          } catch (error) {
            performCleanup(root, tempPreviewDiv)
            resolve(null)
          }
        }
      })

      observer.observe(tempPreviewDiv, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false,
      })

      // フォールバックタイムアウト（10秒）
      setTimeout(() => {
        if (!renderingComplete) {
          observer.disconnect()
          performCleanup(root, tempPreviewDiv)
          resolve(null)
        }
      }, 10000)
    })

  } catch (error) {
    console.error('convertTextToSvg全体エラー:', error)
    return null
  }
}

/**
 * SVG要素をCanvasに高品質描画する（アスペクト比維持スケーリング付き）
 */
async function renderSvgToCanvas(
  svgElement: SVGSVGElement,
  maxWidth: number,
  maxHeight: number,
  backgroundColor: string = 'transparent'
): Promise<{ canvas: HTMLCanvasElement; actualWidth: number; actualHeight: number; scale: number }> {
  return new Promise((resolve) => {
    try {
      const svgData = new XMLSerializer().serializeToString(svgElement)
      const svgBlob = new Blob([svgData], {
        type: 'image/svg+xml;charset=utf-8',
      })
      const svgUrl = URL.createObjectURL(svgBlob)

      const img = new Image()
      img.onload = () => {
        // アスペクト比を維持しながらテキストボックスに合わせてスケーリング
        const originalWidth = img.width
        const originalHeight = img.height
        
        // スケール計算（アスペクト比維持）
        const scaleX = maxWidth / originalWidth
        const scaleY = maxHeight / originalHeight
        const scale = Math.min(scaleX, scaleY) // より小さい方を選択してアスペクト比維持
        
        // スケーリング後のサイズ
        const scaledWidth = originalWidth * scale
        const scaledHeight = originalHeight * scale
        
        // Canvas作成
        const canvas = document.createElement('canvas')
        canvas.width = scaledWidth
        canvas.height = scaledHeight
        const ctx = canvas.getContext('2d')!
        
        // 背景描画
        if (backgroundColor !== 'transparent') {
          ctx.fillStyle = backgroundColor
          ctx.fillRect(0, 0, scaledWidth, scaledHeight)
        }
        
        // 中央配置のための位置調整
        const offsetX = (scaledWidth - scaledWidth) / 2  // 0になるが一貫性のため
        const offsetY = (scaledHeight - scaledHeight) / 2  // 0になるが一貫性のため
        
        // スケーリングして描画
        ctx.drawImage(img, 
          offsetX, offsetY, 
          scaledWidth, scaledHeight
        )

        URL.revokeObjectURL(svgUrl)
        resolve({ 
          canvas, 
          actualWidth: scaledWidth, 
          actualHeight: scaledHeight, 
          scale 
        })
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(svgUrl)
        resolve({ 
          canvas: document.createElement('canvas'), 
          actualWidth: 0, 
          actualHeight: 0, 
          scale: 0 
        })
      }
      
      img.src = svgUrl
    } catch (error) {
      resolve({ 
        canvas: document.createElement('canvas'), 
        actualWidth: 0, 
        actualHeight: 0, 
        scale: 0 
      })
    }
  })
}

/**
 * textbox-on-canvasの完璧なロジックを使った個別表示テキストボックス機能
 * @param options テキストレンダリングオプション
 * @returns Canvas要素と描画寸法情報
 */
export async function renderMarkdownToCanvas(
  options: TextRenderOptions
): Promise<{ canvas: HTMLCanvasElement; dimensions: TextDimensions }> {
  const { text, color, fontSize, maxWidth, maxHeight, backgroundColor = 'transparent' } = options
  
  if (!text.trim()) {
    // 空テキストの場合は空のCanvasを返す
    const canvas = document.createElement('canvas')
    canvas.width = maxWidth
    canvas.height = maxHeight
    return {
      canvas,
      dimensions: { width: maxWidth, height: maxHeight, scale: 1 }
    }
  }

  try {
    // textbox-on-canvasの成功したSVG変換ロジックを使用
    const svgElement = await convertTextToSvg(text, fontSize, color)
    
    if (svgElement) {
      // textbox-on-canvasの成功したCanvas描画ロジックを使用
      const result = await renderSvgToCanvas(svgElement, maxWidth, maxHeight, backgroundColor)
      
      return {
        canvas: result.canvas,
        dimensions: {
          width: result.actualWidth,
          height: result.actualHeight,
          scale: result.scale
        }
      }
    }

    // フォールバック: 空のCanvas
    const canvas = document.createElement('canvas')
    canvas.width = maxWidth
    canvas.height = maxHeight
    return {
      canvas,
      dimensions: { width: maxWidth, height: maxHeight, scale: 1 }
    }
    
  } catch (error) {
    console.error('renderMarkdownToCanvas エラー:', error)
    // エラー時のフォールバック
    const canvas = document.createElement('canvas')
    canvas.width = maxWidth
    canvas.height = maxHeight
    return {
      canvas,
      dimensions: { width: maxWidth, height: maxHeight, scale: 1 }
    }
  }
}

/**
 * テキストボックスに合わせた最適なフォントサイズを計算
 */
export function calculateOptimalFontSize(
  text: string,
  boxWidth: number,
  boxHeight: number,
  baseFontSize: number = 16,
  minFontSize: number = 8,
  maxFontSize: number = 72
): number {
  const lines = text.split('\\n')
  const maxLineLength = Math.max(...lines.map(line => 
    line.replace(/\$.*?\$/g, 'XX').replace(/\*\*(.*?)\*\*/g, '$1').length
  ))
  
  // 横幅基準（数式は約2文字分として計算）
  const widthBasedSize = boxWidth / (maxLineLength * 0.6)
  
  // 高さ基準（数式行は1.5倍の高さとして計算）
  const mathLines = lines.filter(line => line.includes('$')).length
  const adjustedLines = lines.length + mathLines * 0.5
  const heightBasedSize = boxHeight / (adjustedLines * 1.4)
  
  // 制限適用
  const optimalSize = Math.min(widthBasedSize, heightBasedSize, baseFontSize)
  return Math.max(Math.min(optimalSize, maxFontSize), minFontSize)
}