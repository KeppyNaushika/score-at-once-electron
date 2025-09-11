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
    // MathJax 4の初期化完了を確認
    console.log("MathJax状態確認:", {
      startup: !!MathJax.startup,
      document: !!MathJax.startup?.document,
      typesetPromise: !!MathJax.typesetPromise,
      typeset: !!MathJax.typeset,
      mathJaxReady: (window as any).mathJaxReady
    })

    // MathJaxが完全に初期化されるまで待機（非同期読み込み対応）
    if (!MathJax.startup?.document && !(window as any).mathJaxReady) {
      console.log("MathJax初期化を待機中...")
      await new Promise((resolve) => {
        // 既に初期化済みの場合
        if ((window as any).mathJaxReady || (MathJax.startup?.document)) {
          resolve(void 0)
          return
        }

        let attempts = 0
        const maxAttempts = 20 // 10秒間（500ms間隔）

        const checkReady = () => {
          attempts++
          if ((window as any).mathJaxReady || MathJax.startup?.document || MathJax.typesetPromise) {
            console.log(`MathJax初期化完了 (${attempts * 500}ms後)`)
            resolve(void 0)
          } else if (attempts >= maxAttempts) {
            console.warn("MathJax初期化タイムアウト - 処理を継続")
            resolve(void 0)
          } else {
            setTimeout(checkReady, 500)
          }
        }

        // イベント待機と定期チェックを併用
        window.addEventListener(
          "mathjax-ready",
          () => {
            console.log("MathJax ready イベント受信")
            resolve(void 0)
          },
          { once: true },
        )

        checkReady()
      })
    }

    // typesetPromiseが利用可能な場合
    if (MathJax.typesetPromise && typeof MathJax.typesetPromise === 'function') {
      console.log("MathJax typesetPromise実行中...")

      try {
        const typesetTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("MathJax typeset timeout")), 8000)
        })

        await Promise.race([
          MathJax.typesetPromise([container]),
          typesetTimeout,
        ])
        console.log("MathJax typesetPromise完了")
      } catch (error) {
        console.warn("MathJax typesetPromise失敗:", error)
        
        // フォールバック: 同期typeset
        if (MathJax.typeset && typeof MathJax.typeset === 'function') {
          console.log("フォールバック: 同期typeset実行")
          MathJax.typeset([container])
        } else {
          console.warn("フォールバックtypesetも利用不可")
        }
      }
    }
    // typesetが利用可能な場合
    else if (MathJax.typeset && typeof MathJax.typeset === 'function') {
      console.log("MathJax typeset（同期）実行中...")
      MathJax.typeset([container])
      console.log("MathJax typeset（同期）完了")
    }
    // どちらも利用不可な場合
    else {
      console.warn("MathJaxの組版メソッドが見つかりません", {
        typesetPromise: MathJax.typesetPromise,
        typeset: MathJax.typeset,
        allMethods: Object.keys(MathJax).filter(k => typeof MathJax[k] === 'function')
      })
      
      // 最終フォールバック: 手動再初期化を試行
      if (MathJax.startup && typeof MathJax.startup.defaultReady === 'function') {
        console.log("MathJax再初期化を試行...")
        try {
          await MathJax.startup.defaultReady()
          if (MathJax.typeset) {
            MathJax.typeset([container])
            console.log("再初期化後のtypeset完了")
          }
        } catch (reinitError) {
          console.warn("MathJax再初期化失敗:", reinitError)
        }
      }
    }

    await waitForRenderingComplete(3) // 待機時間を延長
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
 * ページ内のMathJax defs要素を取得する（軽量化版）
 * @returns MathJaxの<defs>要素のHTML文字列
 */
function extractMathJaxDefs(): string {
  // 最も効率的で確実な方法：グローバルキャッシュから取得
  const globalCache = document.querySelector("#MJX-SVG-global-cache defs")
  if (globalCache && globalCache.innerHTML.length > 100) {
    console.log(`📦 グローバルdefs取得: ${globalCache.innerHTML.length}文字`)
    return globalCache.outerHTML
  }

  // フォールバック：MathJaxスタイル要素も含める
  const styleElement = document.querySelector('style[id*="MJX"]')
  if (styleElement && styleElement.innerHTML.length > 100) {
    console.log(`📦 MathJaxスタイル取得: ${styleElement.innerHTML.length}文字`)
    return styleElement.outerHTML
  }

  // 最終フォールバック：何も見つからない場合は空文字を返す
  console.log(`📝 MathJax defsが見つかりません（純粋なテキスト表示）`)
  return ""
}

/**
 * MathJax要素の完全な初期化を待機する（MathJax 4用）
 * 既にdefsが存在する場合は即座に完了
 * @returns Promise<boolean> 初期化が完了したかどうか
 */
async function waitForMathJaxDefsGeneration(): Promise<boolean> {
  // 既にグローバルdefsが存在するかチェック
  const existingGlobalDefs = document.querySelector(
    "#MJX-SVG-global-cache defs",
  )
  if (existingGlobalDefs && existingGlobalDefs.innerHTML.length > 100) {
    console.log(
      `✅ 既存のMathJax defs確認: ${existingGlobalDefs.innerHTML.length}文字`,
    )
    return true
  }

  // グローバルdefsが存在しない場合は、コンテナ内defsを検索
  const mjxContainers = document.querySelectorAll("mjx-container svg defs")
  if (mjxContainers.length > 0) {
    console.log(`✅ MathJax defs生成確認: ${mjxContainers.length}個`)
    return true
  }

  console.log(`📝 MathJax defsは不要（純粋なSVG出力）`)
  return true // defsが不要な場合もある
}

/**
 * 測定結果に基づいて最適なSVGを生成する（軽量版）
 * @param htmlContent HTML内容
 * @param measuredSize 測定されたサイズ
 * @returns 生成されたSVG要素
 */
export async function createOptimizedSVG(
  htmlContent: string,
  measuredSize: MeasuredSize,
): Promise<SVGSVGElement> {
  // MathJax defsを抽出（軽量化）
  const mathJaxDefs = extractMathJaxDefs()

  console.log(`🎨 SVG生成: ${measuredSize.width}x${measuredSize.height}, defs: ${mathJaxDefs.length > 0 ? 'あり' : 'なし'}`)

  const svgString = `
    <svg xmlns="${SVG_SETTINGS.NAMESPACE}"
         xmlns:xlink="http://www.w3.org/1999/xlink"
         width="${measuredSize.width}"
         height="${measuredSize.height}"
         viewBox="0 0 ${measuredSize.width} ${measuredSize.height}"
         overflow="${SVG_SETTINGS.DEFAULT_OVERFLOW}">
      ${mathJaxDefs}
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

  const parser = new DOMParser()
  const svgDoc = parser.parseFromString(svgString, "image/svg+xml")
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
