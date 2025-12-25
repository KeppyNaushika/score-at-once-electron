/**
 * @fileoverview SVG→Canvas変換統合ユーティリティ
 * @description 全プレビューコンポーネントで共通使用されるSVG変換ロジックを統一
 */

import { convertTextToSvg } from "./textConversionUtils"

/**
 * SVG変換設定のインターフェース
 */
export interface SvgConversionOptions {
  text: string
  width: number
  height: number
  horizontalAlign?: "left" | "center" | "right"
  verticalAlign?: "top" | "center" | "bottom"
}

/**
 * MathJax defsをSVGデータに追加する統一関数
 * Image・Canvasプレビューで共通使用
 * @param svgData 元のSVGデータ
 * @returns defs追加済みのSVGデータ
 */
export function addMathJaxDefsToSvg(svgData: string): string {
  // MathJax要素が含まれている場合は、グローバルdefsを強制追加
  const hasMathJaxElements =
    svgData.includes("mjx-container") || svgData.includes("<use")

  if (hasMathJaxElements) {
    // ページ全体からMathJax defsを取得
    const globalDefs = document.querySelector("#MJX-SVG-global-cache defs")
    if (globalDefs && globalDefs.innerHTML.length > 10) {
      const defsContent = globalDefs.outerHTML
      // SVGの開始タグ直後にdefsを強制挿入
      svgData = svgData.replace(/(<svg[^>]*>)/, `$1${defsContent}`)
    }
  }

  return svgData
}

/**
 * SVG要素を生成する統一関数
 * 全プレビューコンポーネントで共通使用
 * @param options SVG変換オプション
 * @returns 生成されたSVG要素またはnull
 */
export async function generateSvgElement(
  options: SvgConversionOptions,
): Promise<SVGSVGElement | null> {
  return await convertTextToSvg(
    options.text,
    options.width,
    options.height,
    options.horizontalAlign || "left",
    options.verticalAlign || "top",
  )
}

/**
 * SVG→Image変換用のBlob URLを作成する統一関数
 * ImageプレビューとCanvasプレビューで共通使用
 * @param svgElement SVG要素
 * @returns Blob URLまたはnull
 */
export function createSvgBlobUrl(svgElement: SVGSVGElement): string | null {
  try {
    // SVGをシリアライズ
    let svgData = new XMLSerializer().serializeToString(svgElement)

    // MathJax defs追加
    svgData = addMathJaxDefsToSvg(svgData)

    // Blob作成
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" })
    return URL.createObjectURL(svgBlob)
  } catch {
    return null
  }
}

/**
 * SVG→Image変換の統一Promise関数
 * @param svgElement SVG要素
 * @returns Promise<HTMLImageElement | null>
 */
export function convertSvgToImage(
  svgElement: SVGSVGElement,
): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const svgUrl = createSvgBlobUrl(svgElement)
    if (!svgUrl) {
      resolve(null)
      return
    }

    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(svgUrl)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(svgUrl)
      resolve(null)
    }
    img.src = svgUrl
  })
}

/**
 * 描画結果の統一データ構造
 */
export interface RenderResult {
  width: number
  height: number
  success: boolean
  error?: string
}

/**
 * レンダリング状態の統一管理
 */
export class RenderingStatusManager {
  private status: string = "待機中"
  private callbacks: ((status: string) => void)[] = []

  /**
   * ステータス更新
   */
  setStatus(status: string): void {
    this.status = status
    this.callbacks.forEach((callback) => callback(status))
  }

  /**
   * ステータス取得
   */
  getStatus(): string {
    return this.status
  }

  /**
   * ステータス変更の監視
   */
  onStatusChange(callback: (status: string) => void): () => void {
    this.callbacks.push(callback)
    return () => {
      const index = this.callbacks.indexOf(callback)
      if (index > -1) {
        this.callbacks.splice(index, 1)
      }
    }
  }
}
