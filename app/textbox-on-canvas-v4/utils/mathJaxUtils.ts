/**
 * @fileoverview MathJax処理ユーティリティ (V3 - scrollWidth/scrollHeight専用版)
 * @description MathJax数式処理とSVG生成の高度な機能を提供
 */

import {
  DOM_STYLES,
  FONT_SETTINGS,
  MATHJAX_SETTINGS,
  SVG_SETTINGS,
} from "../constants"
import type { MeasuredSize } from "../types"

/**
 * ブラウザの描画完了を待機する
 * @param frames 待機するフレーム数（デフォルト: 2）
 * @returns Promise<void>
 */
export async function waitForRenderingComplete(
  frames: number = MATHJAX_SETTINGS.DEFAULT_WAIT_FRAMES,
): Promise<void> {
  for (let i = 0; i < frames; i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
}

/**
 * MathJax数式の組版処理を実行する（MathJax 4対応版）
 * @param container 処理対象のDOM要素
 * @returns Promise<void>
 */
export async function processMathJax(container: HTMLElement): Promise<void> {
  const MathJax = (window as any).MathJax

  if (!MathJax) {
    console.warn("MathJaxが利用できません")
    return
  }

  try {
    // MathJax 4では初期化完了を待つ必要がある
    if (MathJax.startup && !MathJax.startup.document) {
      console.log("MathJax初期化を待機中...")
      await new Promise(resolve => {
        if ((window as any).mathJaxReady) {
          resolve(void 0)
        } else {
          const timeout = setTimeout(() => {
            console.warn("MathJax初期化タイムアウト")
            resolve(void 0)
          }, 3000)
          
          window.addEventListener('mathjax-ready', () => {
            clearTimeout(timeout)
            resolve(void 0)
          }, { once: true })
        }
      })
    }

    if (MathJax.typesetPromise) {
      console.log("MathJax typesetPromise実行中...")
      
      // タイムアウト付きでtypesetPromiseを実行
      const typesetTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("MathJax typeset timeout")), 5000)
      })
      
      try {
        await Promise.race([
          MathJax.typesetPromise([container]),
          typesetTimeout
        ])
        console.log("MathJax typeset完了")
      } catch (error) {
        console.warn("MathJax typeset中断:", error)
        // フォールバックとして同期版を試行
        if (MathJax.typeset) {
          console.log("フォールバック: 同期typeset実行")
          MathJax.typeset([container])
        }
      }
    } else if (MathJax.typeset) {
      console.log("MathJax typeset実行中...")
      MathJax.typeset([container])
    } else {
      console.warn("MathJaxの組版メソッドが見つかりません")
    }
    
    await waitForRenderingComplete(2)
    console.log("MathJax処理完了")
  } catch (error) {
    console.error("MathJax処理エラー:", error)
  }
}

/**
 * DOM要素のスタイルをクリーンアップする（MathJax用最適化）
 * @param container クリーンアップ対象のコンテナ
 */
export function cleanupElementStyles(container: HTMLElement): void {
  // 全要素のマージン・パディング・ボーダーをリセット
  const allElements = container.querySelectorAll("*")
  allElements.forEach((element) => {
    const htmlElement = element as HTMLElement
    htmlElement.style.margin = "0"
    htmlElement.style.padding = "0"
    htmlElement.style.border = "0"
  })

  // 段落要素の特別処理
  const paragraphs = container.querySelectorAll("p")
  paragraphs.forEach((p) => {
    const htmlP = p as HTMLElement
    htmlP.style.margin = "0"
    htmlP.style.padding = "0"
    htmlP.style.lineHeight = FONT_SETTINGS.DEFAULT_LINE_HEIGHT.toString()
  })

  // MathJax要素のベースライン配置処理
  const mjxElements = container.querySelectorAll("mjx-container")
  mjxElements.forEach((mjx) => {
    const htmlMjx = mjx as HTMLElement
    htmlMjx.style.margin = "0"
    htmlMjx.style.padding = "0"
    htmlMjx.style.verticalAlign = "baseline" // ベースライン配置
  })
}

/**
 * MathJax処理後の実際のコンテンツサイズを正確に測定する (V3専用: scrollWidth/scrollHeight版)
 * @param htmlContent 測定対象のHTML文字列
 * @param initialWidth 初期幅
 * @param initialHeight 初期高さ
 * @returns Promise<MeasuredSize> 測定されたサイズ
 */
export async function measureMathJaxContentSize(
  htmlContent: string,
  initialWidth: number,
  initialHeight: number,
): Promise<MeasuredSize> {
  // 一時的なDOM要素を作成（scrollWidth/scrollHeight専用設定）
  const tempDiv = document.createElement("div")
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
    min-width: 0;
    min-height: 0;
    padding: 0;
    margin: 0;
    border: 0;
  `
  tempDiv.innerHTML = htmlContent
  document.body.appendChild(tempDiv)

  let measuredSize: MeasuredSize = {
    width: initialWidth,
    height: initialHeight,
  }

  try {
    // MathJax処理を完了まで待機
    await processMathJax(tempDiv)
    await waitForRenderingComplete(2)

    // ScrollWidth/ScrollHeightのみで測定（V3専用ロジック）
    const scrollSize = {
      width: tempDiv.scrollWidth,
      height: tempDiv.scrollHeight,
    }

    // 最小サイズを確保してscrollWidth/scrollHeightのみ採用
    measuredSize = {
      width: Math.max(20, scrollSize.width),
      height: Math.max(20, scrollSize.height),
    }
  } catch (error) {
    console.error("MathJax測定エラー:", error)
  } finally {
    // 必ずクリーンアップする
    if (document.body.contains(tempDiv)) {
      document.body.removeChild(tempDiv)
    }
  }

  return measuredSize
}

/**
 * ページ内のMathJax defs要素を取得する（MathJax 4対応版）
 * @returns MathJaxの<defs>要素のHTML文字列
 */
function extractMathJaxDefs(): string {
  console.group('🔍 MathJax 4 defs抽出デバッグ')
  
  // まず、MathJax要素が存在するかチェック
  const mjxContainers = document.querySelectorAll('mjx-container')
  console.log(`mjx-container要素数: ${mjxContainers.length}`)
  
  if (mjxContainers.length > 0) {
    mjxContainers.forEach((container, index) => {
      console.log(`mjx-container[${index}]:`, container)
      const svg = container.querySelector('svg')
      if (svg) {
        console.log(`  - SVG要素あり: ID=${svg.id || '(なし)'}, サイズ=${svg.getAttribute('width')}x${svg.getAttribute('height')}`)
        const defs = svg.querySelector('defs')
        if (defs) {
          console.log(`  - defs要素あり: 内容長=${defs.innerHTML.length}文字`)
        } else {
          console.log(`  - defs要素なし`)
        }
      } else {
        console.log(`  - SVG要素なし`)
      }
    })
  }
  
  // MathJax 4では構造が変更されている可能性があるため、より包括的な検索を実行
  const selectors = [
    // MathJax 4の新しい構造
    '#MJX-SVG-global-cache defs',
    'mjx-container svg defs',
    'svg[id*="MJX"] defs',
    'defs[id*="MJX"]',
    // 従来の構造
    'svg defs',
    'style[id*="MJX"]',
    // MathJax 4の追加候補
    '[data-mjx] svg defs',
    '.MathJax svg defs',
    '.mjx-svg defs',
    // 頻繁に使用される要素
    'mjx-container defs'
  ]
  
  let defsContent = ''
  const processedIds = new Set<string>()
  
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector)
    console.log(`セレクタ "${selector}": ${elements.length}個の要素`)
    
    elements.forEach((element, index) => {
      console.log(`  - 要素${index}:`, element)
      
      // 要素にIDがある場合は重複チェック
      const elementId = element.id || `${selector}-${index}`
      if (processedIds.has(elementId)) {
        console.log(`    スキップ（重複）: ${elementId}`)
        return
      }
      
      if (element && element.innerHTML) {
        defsContent += element.outerHTML
        processedIds.add(elementId)
        console.log(`    内容追加: ${element.innerHTML.length}文字, ID: ${elementId}`)
      }
    })
  })
  
  // ページ全体のSVG要素を詳細調査（MathJax 4対応）
  const allSvgs = document.querySelectorAll('svg')
  console.log(`ページ内の全SVG要素: ${allSvgs.length}個`)
  
  allSvgs.forEach((svg, index) => {
    const defs = svg.querySelector('defs')
    if (defs) {
      console.log(`SVG${index}にdefs発見:`, defs)
      console.log(`  - ID: ${svg.id || '(なし)'}`)
      console.log(`  - クラス: ${svg.className.baseVal || svg.className || '(なし)'}`)
      console.log(`  - data-mjx: ${svg.getAttribute('data-mjx') || '(なし)'}`)
      console.log(`  - defs内容長: ${defs.innerHTML.length}文字`)
      console.log(`  - defs ID: ${defs.id || '(なし)'}`)
      
      // より厳密な重複チェック（ID + 内容のハッシュ）
      const defsId = defs.id || `svg-${index}-defs`
      const contentHash = defs.innerHTML.slice(0, 100) // 最初の100文字でハッシュ代替
      const uniqueKey = `${defsId}-${contentHash}`
      
      if (!processedIds.has(uniqueKey)) {
        defsContent += defs.outerHTML
        processedIds.add(uniqueKey)
        console.log(`  - defs内容を追加しました (${uniqueKey})`)
      } else {
        console.log(`  - defs内容をスキップ（重複）: ${uniqueKey}`)
      }
    }
  })
  
  console.log(`最終的なdefs内容長: ${defsContent.length}文字`)
  console.log(`処理した要素数: ${processedIds.size}個`)
  console.log('defs内容プレビュー:', defsContent.substring(0, 300) + '...')
  console.groupEnd()
  
  return defsContent
}

/**
 * MathJax要素の完全な初期化を待機する（MathJax 4用）
 * 既にdefsが存在する場合は即座に完了
 * @returns Promise<boolean> 初期化が完了したかどうか
 */
async function waitForMathJaxDefsGeneration(): Promise<boolean> {
  // 既にグローバルdefsが存在するかチェック
  const existingGlobalDefs = document.querySelector('#MJX-SVG-global-cache defs')
  if (existingGlobalDefs && existingGlobalDefs.innerHTML.length > 100) {
    console.log(`✅ 既存のMathJax defs確認: ${existingGlobalDefs.innerHTML.length}文字`)
    return true
  }
  
  // グローバルdefsが存在しない場合は、コンテナ内defsを検索
  const mjxContainers = document.querySelectorAll('mjx-container svg defs')
  if (mjxContainers.length > 0) {
    console.log(`✅ MathJax defs生成確認: ${mjxContainers.length}個`)
    return true
  }
  
  console.log(`📝 MathJax defsは不要（純粋なSVG出力）`)
  return true // defsが不要な場合もある
}

/**
 * 測定結果に基づいて最適なSVGを生成する（MathJax defs統合版）
 * @param htmlContent HTML内容
 * @param measuredSize 測定されたサイズ
 * @returns 生成されたSVG要素
 */
export async function createOptimizedSVG(
  htmlContent: string,
  measuredSize: MeasuredSize,
): Promise<SVGSVGElement> {
  // MathJax 4では、defs生成を待機する必要がある
  await waitForMathJaxDefsGeneration()
  
  // MathJax defsを抽出
  const mathJaxDefs = extractMathJaxDefs()
  
  console.group('🎨 MathJax 4 SVG生成詳細')
  console.log('defs情報:', { 
    defsLength: mathJaxDefs.length, 
    hasContent: mathJaxDefs.length > 0,
    width: measuredSize.width,
    height: measuredSize.height
  })
  console.log('抽出されたdefs内容（最初の500文字）:', mathJaxDefs.substring(0, 500))
  
  const svgString = `
    <svg xmlns="${SVG_SETTINGS.NAMESPACE}"
         xmlns:xlink="http://www.w3.org/1999/xlink"
         width="${measuredSize.width}"
         height="${measuredSize.height}"
         viewBox="0 0 ${measuredSize.width} ${measuredSize.height}"
         overflow="${SVG_SETTINGS.DEFAULT_OVERFLOW}">
      ${mathJaxDefs ? mathJaxDefs : ''}
      <foreignObject x="0" y="0"
                     width="${measuredSize.width}"
                     height="${measuredSize.height}"
                     overflow="${SVG_SETTINGS.DEFAULT_OVERFLOW}">
        <div xmlns="${SVG_SETTINGS.XHTML_NAMESPACE}">
          <div style="font-size: ${FONT_SETTINGS.DEFAULT_SIZE}px;
                     line-height: ${FONT_SETTINGS.DEFAULT_LINE_HEIGHT};
                     color: ${FONT_SETTINGS.DEFAULT_COLOR};
                     overflow: visible;
                     text-align: left;
                     text-justify: none;
                     word-break: normal;
                     white-space: normal;
                     text-decoration: none;
                     letter-spacing: normal;
                     word-spacing: normal;
                     text-rendering: optimizeSpeed;">
            <style>${DOM_STYLES.MATHJAX_OVERFLOW_CSS}</style>
            ${htmlContent}
          </div>
        </div>
      </foreignObject>
    </svg>
  `

  console.log('生成されたSVG文字列（最初の1000文字）:', svgString.substring(0, 1000))

  const parser = new DOMParser()
  const svgDoc = parser.parseFromString(svgString, "image/svg+xml")
  const svgElement = svgDoc.documentElement as unknown as SVGSVGElement
  
  // 詳細なSVG解析
  const defsInSvg = svgElement.querySelector('defs')
  console.log('パースされたSVG要素:', svgElement)
  console.log('SVG内のdefs要素:', defsInSvg)
  console.log('defs要素の存在:', defsInSvg !== null)
  if (defsInSvg) {
    console.log('defs内容長:', defsInSvg.innerHTML.length)
    console.log('defs ID:', defsInSvg.id || '(ID なし)')
    console.log('defs内容プレビュー:', defsInSvg.innerHTML.substring(0, 200))
  }
  
  // XMLSerializerでの再シリアライズテスト
  const reserializedSvg = new XMLSerializer().serializeToString(svgElement)
  const defsInReserializedSvg = reserializedSvg.includes('<defs')
  console.log('再シリアライズ後のdefs存在:', defsInReserializedSvg)
  console.log('再シリアライズSVG（最初の800文字）:', reserializedSvg.substring(0, 800))
  console.groupEnd()
  
  return svgElement
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
  initialHeight: number,
): Promise<SVGSVGElement> {
  // MathJax処理後の正確なサイズを測定
  const measuredSize = await measureMathJaxContentSize(
    htmlContent,
    initialWidth,
    initialHeight,
  )

  // 測定結果に基づいて最適なSVGを生成
  return await createOptimizedSVG(htmlContent, measuredSize)
}
