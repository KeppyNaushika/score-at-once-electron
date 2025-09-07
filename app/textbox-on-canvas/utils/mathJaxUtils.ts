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

    // デバッグ用: 全要素に紫色の枠を表示
    const allElements = tempDiv.querySelectorAll('*')
    allElements.forEach((element, index) => {
      const htmlElement = element as HTMLElement
      const rect = htmlElement.getBoundingClientRect()
      htmlElement.style.border = '2px solid purple'
      htmlElement.style.boxSizing = 'border-box'
      
      console.log(`🔍 要素${index + 1} (${htmlElement.tagName}):`, {
        boundingRect: { 
          width: rect.width, 
          height: rect.height,
          left: rect.left,
          top: rect.top
        },
        scrollSize: {
          width: htmlElement.scrollWidth,
          height: htmlElement.scrollHeight
        },
        offsetSize: {
          width: htmlElement.offsetWidth,
          height: htmlElement.offsetHeight
        },
        innerHTML: htmlElement.innerHTML.substring(0, 50)
      })
    })

    // tempDiv自体にも紫色の枠を表示
    tempDiv.style.border = '3px solid purple'
    tempDiv.style.boxSizing = 'border-box'
    // MathJax要素の詳細測定とSVG getBBox デバッグデータ収集
    const mjxContainers = tempDiv.querySelectorAll('mjx-container')
    let maxMathJaxHeight = 0
    let svgBBoxData: any[] = []
    
    mjxContainers.forEach((mjx, index) => {
      const mjxRect = mjx.getBoundingClientRect()
      const htmlMjx = mjx as HTMLElement
      htmlMjx.style.border = '2px solid darkviolet'
      htmlMjx.style.boxSizing = 'border-box'
      
      // SVG要素のgetBBox()を試行
      const svgElement = htmlMjx.querySelector('svg')
      
      if (svgElement) {
        try {
          const bbox = svgElement.getBBox()
          const bboxInfo = {
            width: bbox.width,
            height: bbox.height,
            x: bbox.x,
            y: bbox.y
          }
          
          // SVG自体の属性も取得
          const svgWidth = svgElement.getAttribute('width')
          const svgHeight = svgElement.getAttribute('height')
          const viewBox = svgElement.getAttribute('viewBox')
          
          svgBBoxData.push({
            index: index + 1,
            tagName: htmlMjx.tagName,
            getBBox: bboxInfo,
            svgAttributes: {
              width: svgWidth,
              height: svgHeight,
              viewBox: viewBox
            },
            boundingClientRect: {
              width: mjxRect.width,
              height: mjxRect.height
            },
            difference: {
              width: mjxRect.width - bbox.width,
              height: mjxRect.height - bbox.height
            }
          })
        } catch (error) {
          svgBBoxData.push({
            index: index + 1,
            tagName: htmlMjx.tagName,
            error: (error as Error).message,
            boundingClientRect: {
              width: mjxRect.width,
              height: mjxRect.height
            }
          })
        }
      }
      
      console.log(`🧮 MathJax要素${index + 1}:`, {
        boundingRect: { 
          width: mjxRect.width, 
          height: mjxRect.height,
          left: mjxRect.left,
          top: mjxRect.top
        },
        scrollSize: {
          width: htmlMjx.scrollWidth,
          height: htmlMjx.scrollHeight
        }
      })
      
      maxMathJaxHeight = Math.max(maxMathJaxHeight, mjxRect.height)
    })

    // フォントメトリクス詳細測定
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    ctx.font = `${FONT_SETTINGS.DEFAULT_SIZE}px ${FONT_SETTINGS.DEFAULT_FAMILY}`
    
    // Canvas APIによるテキストメトリクス取得
    const metrics = ctx.measureText(tempDiv.textContent || '')
    
    // DIVに表示するためのフォントメトリクス情報
    const visualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
    const fontHeight = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent
    const diffVisual = boundingRect.height - visualHeight
    const diffFont = boundingRect.height - fontHeight

    const metricsDisplay = document.getElementById('font-metrics-display')
    if (metricsDisplay) {
      metricsDisplay.innerHTML = `
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-2 rounded border">
            <div className="font-medium text-blue-700 mb-2">Canvas APIメトリクス</div>
            <div>幅: ${metrics.width.toFixed(1)}px</div>
            <div>Ascent (実際): ${metrics.actualBoundingBoxAscent.toFixed(1)}px</div>
            <div>Descent (実際): ${metrics.actualBoundingBoxDescent.toFixed(1)}px</div>
            <div>視覚的高さ: ${visualHeight.toFixed(1)}px</div>
            <div className="mt-1 text-gray-600">
              <div>Ascent (フォント): ${metrics.fontBoundingBoxAscent.toFixed(1)}px</div>
              <div>Descent (フォント): ${metrics.fontBoundingBoxDescent.toFixed(1)}px</div>
              <div>フォント高さ: ${fontHeight.toFixed(1)}px</div>
            </div>
          </div>
          
          <div className="bg-white p-2 rounded border">
            <div className="font-medium text-red-700 mb-2">DOM測定結果</div>
            <div>boundingRect高さ: ${boundingRect.height.toFixed(1)}px</div>
            <div>scrollHeight: ${scrollSize.height.toFixed(1)}px</div>
            <div>offsetHeight: ${tempDiv.offsetHeight.toFixed(1)}px</div>
            <div className="mt-2 border-t pt-2">
              <div className="font-medium text-purple-700">差異分析</div>
              <div>vs 視覚的高さ: ${diffVisual > 0 ? '+' : ''}${diffVisual.toFixed(1)}px</div>
              <div>vs フォント高さ: ${diffFont > 0 ? '+' : ''}${diffFont.toFixed(1)}px</div>
            </div>
          </div>
        </div>
        
        <div className="mt-3 p-2 bg-white rounded border">
          <div className="font-medium text-green-700 mb-1">測定対象テキスト</div>
          <div className="font-mono text-gray-800">"${(tempDiv.textContent || '').substring(0, 100)}${(tempDiv.textContent || '').length > 100 ? '...' : ''}"</div>
        </div>
        
        <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
          <div className="font-medium text-red-700 mb-1">🔴 赤枠サイズ（最終測定結果）</div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>初期: ${initialWidth}×${initialHeight}px</div>
            <div>測定: ${Math.ceil(Math.max(boundingRect.width, scrollSize.width))}×${Math.ceil(Math.max(boundingRect.height, scrollSize.height))}px</div>
            <div>最終: <span class="font-bold text-red-800">${Math.max(initialWidth, Math.ceil(Math.max(boundingRect.width, scrollSize.width)))}×${Math.max(initialHeight, Math.ceil(Math.max(boundingRect.height, scrollSize.height)))}px</span></div>
          </div>
        </div>
        
      `
    }

    // SVG getBBox情報を別のDIVに表示
    const svgBBoxDisplay = document.getElementById('svg-bbox-display')
    if (svgBBoxDisplay) {
      svgBBoxDisplay.innerHTML = svgBBoxData.length === 0 ? 
        '<div class="text-gray-400 italic text-sm">MathJax SVG要素が見つかりません</div>' : 
        svgBBoxData.map(data => `
          <div class="mb-3 p-2 bg-white rounded border text-xs">
            <div class="font-medium text-purple-800 mb-1">MathJax要素 ${data.index} (${data.tagName})</div>
            ${data.error ? 
              `<div class="text-red-600">エラー: ${data.error}</div>` :
              `<div class="grid grid-cols-2 gap-2">
                <div>
                  <div class="font-medium text-blue-700">getBBox()</div>
                  <div>幅: ${data.getBBox.width.toFixed(2)}px</div>
                  <div>高さ: ${data.getBBox.height.toFixed(2)}px</div>
                  <div>x: ${data.getBBox.x.toFixed(2)}, y: ${data.getBBox.y.toFixed(2)}</div>
                </div>
                <div>
                  <div class="font-medium text-red-700">getBoundingClientRect()</div>
                  <div>幅: ${data.boundingClientRect.width.toFixed(2)}px</div>
                  <div>高さ: ${data.boundingClientRect.height.toFixed(2)}px</div>
                  <div class="text-orange-600">差異: ${data.difference.width.toFixed(2)}×${data.difference.height.toFixed(2)}</div>
                </div>
              </div>
              <div class="mt-2 text-gray-600">
                <div>SVG属性: ${data.svgAttributes.width}×${data.svgAttributes.height}</div>
                <div>viewBox: ${data.svgAttributes.viewBox || 'なし'}</div>
              </div>`
            }
          </div>
        `).join('')
    }

    console.log('📐 フォントメトリクス詳細:', {
      visualHeight: visualHeight.toFixed(1),
      fontHeight: fontHeight.toFixed(1),
      boundingRectHeight: boundingRect.height.toFixed(1),
      difference: diffVisual.toFixed(1)
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