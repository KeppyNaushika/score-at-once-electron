/**
 * ステップ結果の型定義
 */
export interface StepResult {
  // Step 0: テキスト準備
  processed?: string
  original?: string
  // Step 1: HTML変換
  htmlContent?: string
  container?: HTMLDivElement
  // Step 2: MathJax処理
  processedHTML?: string
  hasMathJax?: boolean
  // Step 3: スタイルクリーンアップ
  cleaned?: boolean
  description?: string
  // Step 4: サイズ測定
  size?: {
    width: number
    height: number
    boundingWidth?: number
    boundingHeight?: number
    scrollWidth?: number
    scrollHeight?: number
    mathJaxHeight?: number
  }
  // Step 5: SVG作成
  svgCreated?: boolean
  svgSize?: { width: number; height: number }
  // Step 6: Canvas描画
  canvas?: HTMLCanvasElement
  completed?: boolean
}

/** 解説する変換ステップ1つ（表示する説明・コード例と、デモ実行の処理） */
export interface ConversionStep {
  id: number
  title: string
  description: string
  code: string
  action: () => void | Promise<void>
}
