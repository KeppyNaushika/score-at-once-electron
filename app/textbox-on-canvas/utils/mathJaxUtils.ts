/**
 * @fileoverview MathJax処理ユーティリティ
 * @description MathJax数式処理とSVG生成の高度な機能を提供
 */

import { MATHJAX_SETTINGS, FONT_SETTINGS, DOM_STYLES, SVG_SETTINGS } from '../constants'
import type { MeasuredSize, MathJaxProcessingOptions } from '../types'

/**
 * ブラウザの描画完了を待機する
 * @param frames 待機するフレーム数（デフォルト: 2）
 * @returns Promise<void>
 */
export async function waitForRenderingComplete(frames: number = MATHJAX_SETTINGS.DEFAULT_WAIT_FRAMES): Promise<void> {
  for (let i = 0; i < frames; i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
}

/**
 * MathJax数式の組版処理を実行する
 * @param container 処理対象のDOM要素
 * @returns Promise<void>
 */
export async function processMathJax(container: HTMLElement): Promise<void> {
  const MathJax = (window as any).MathJax
  
  if (!MathJax || !MathJax.typesetPromise) {
    console.warn('⚠️ MathJax is not available')
    return
  }

  try {
    console.log('🧮 MathJax処理開始:', { 
      mathJaxExists: !!MathJax, 
      typesetExists: !!MathJax.typesetPromise,
      containerHTML: container.innerHTML.substring(0, 100)
    })
    
    await MathJax.typesetPromise([container])
    await waitForRenderingComplete()
    
    console.log('✅ MathJax処理完了:', container.innerHTML.substring(0, 100))
  } catch (error) {
    console.error('❌ MathJax処理エラー:', error)
    // MathJax処理失敗時も継続
  }
}

/**
 * DOM要素のスタイルをクリーンアップする（MathJax用最適化）
 * @param container クリーンアップ対象のコンテナ
 */
export function cleanupElementStyles(container: HTMLElement): void {
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
 * @param initialWidth 初期幅
 * @param initialHeight 初期高さ
 * @returns Promise<MeasuredSize> 測定されたサイズ
 */
export async function measureMathJaxContentSize(
  htmlContent: string,
  initialWidth: number,
  initialHeight: number
): Promise<MeasuredSize> {
  // 一時的なDOM要素を作成
  const tempDiv = document.createElement('div')
  tempDiv.style.cssText = `
    position: absolute;
    left: -9999px;
    top: -9999px;
    font-size: ${FONT_SETTINGS.DEFAULT_SIZE}px;
    line-height: ${FONT_SETTINGS.DEFAULT_LINE_HEIGHT};
    color: ${FONT_SETTINGS.DEFAULT_COLOR};
    visibility: hidden;
    width: max-content;
    height: max-content;
  `
  tempDiv.innerHTML = htmlContent
  document.body.appendChild(tempDiv)

  let measuredSize: MeasuredSize = {
    width: initialWidth,
    height: initialHeight
  }

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
        initialWidth,
        Math.ceil(Math.max(boundingRect.width, scrollSize.width))
      ),
      height: Math.max(
        initialHeight,
        Math.ceil(Math.max(boundingRect.height, scrollSize.height, maxMathJaxHeight))
      )
    }

    console.log('📏 MathJax処理後実測サイズ:', {
      original: { width: initialWidth, height: initialHeight },
      boundingRect: { width: boundingRect.width, height: boundingRect.height },
      scrollSize,
      maxMathHeight: maxMathJaxHeight,
      final: measuredSize
    })

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
 * @returns 生成されたSVG要素
 */
export function createOptimizedSVG(htmlContent: string, measuredSize: MeasuredSize): SVGSVGElement {
  const svgString = `
    <svg xmlns="${SVG_SETTINGS.NAMESPACE}" 
         width="${measuredSize.width}" 
         height="${measuredSize.height}" 
         viewBox="0 0 ${measuredSize.width} ${measuredSize.height}" 
         overflow="${SVG_SETTINGS.DEFAULT_OVERFLOW}">
      <foreignObject x="0" y="0" 
                     width="${measuredSize.width}" 
                     height="${measuredSize.height}" 
                     overflow="${SVG_SETTINGS.DEFAULT_OVERFLOW}">
        <div xmlns="${SVG_SETTINGS.XHTML_NAMESPACE}">
          <div style="font-size: ${FONT_SETTINGS.DEFAULT_SIZE}px; 
                     line-height: ${FONT_SETTINGS.DEFAULT_LINE_HEIGHT}; 
                     color: ${FONT_SETTINGS.DEFAULT_COLOR}; 
                     overflow: visible;">
            <style>${DOM_STYLES.MATHJAX_OVERFLOW_CSS}</style>
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
 * HTML内容からMathJax対応の高品質SVGを生成する
 * @param htmlContent 変換対象のHTML文字列
 * @param initialWidth 初期幅
 * @param initialHeight 初期高さ
 * @returns Promise<SVGSVGElement> 生成されたSVG要素
 */
export async function createMathJaxSVG(
  htmlContent: string,
  initialWidth: number,
  initialHeight: number
): Promise<SVGSVGElement> {
  // MathJax処理後の正確なサイズを測定
  const measuredSize = await measureMathJaxContentSize(htmlContent, initialWidth, initialHeight)
  
  // 測定結果に基づいて最適なSVGを生成
  return createOptimizedSVG(htmlContent, measuredSize)
}