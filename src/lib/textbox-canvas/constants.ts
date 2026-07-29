/**
 * @fileoverview Constants for textbox-on-canvas functionality
 * @description 数学式対応テキストボックス Canvas システムの定数定義
 */

/**
 * デフォルトのフォント設定
 */
export const FONT_SETTINGS = {
  /** デフォルトフォントサイズ（px） */
  DEFAULT_SIZE: 24,
  /** デフォルト行の高さ */
  DEFAULT_LINE_HEIGHT: 1,
  /** デフォルトフォントファミリー */
  DEFAULT_FAMILY:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans JP", "Hiragino Kaku Gothic ProN", "ヒラギノ角ゴ ProN W3", Arial, sans-serif',
  /** デフォルトテキスト色 */
  DEFAULT_COLOR: "#000000",
} as const

/**
 * MathJax処理の設定
 */
export const MATHJAX_SETTINGS = {
  /** 描画完了待機のデフォルトフレーム数 */
  DEFAULT_WAIT_FRAMES: 2,
  /** MathJax処理のタイムアウト（ms） */
  PROCESSING_TIMEOUT: 5000,
} as const

/**
 * Canvas描画の設定
 */
export const CANVAS_SETTINGS = {
  /** デバッグ用赤枠の色 */
  DEBUG_BORDER_COLOR: "red",
  /** デバッグ用赤枠の線幅 */
  DEBUG_BORDER_WIDTH: 1,
  /** 選択されたテキストボックスの枠色 */
  SELECTED_BORDER_COLOR: "#2563eb",
  /** 非選択テキストボックスの枠色 */
  UNSELECTED_BORDER_COLOR: "#6b7280",
  /** 作成中テキストボックスの枠色 */
  CREATING_BORDER_COLOR: "#3b82f6",
  /** 選択されたテキストボックスの背景色 */
  SELECTED_BACKGROUND_COLOR: "rgba(37, 99, 235, 0.1)",
  /** アンカー点の半径（px） */
  ANCHOR_RADIUS: 6,
  /** アンカー点の色 */
  ANCHOR_COLOR: "#2563eb",
  /** 選択されたアンカー点の色 */
  SELECTED_ANCHOR_COLOR: "#1d4ed8",
} as const

/**
 * DOM要素のスタイル設定
 */
export const DOM_STYLES = {
  /** 非表示要素の位置設定 */
  HIDDEN_POSITION: {
    position: "absolute",
    left: "-9999px",
    top: "-9999px",
    visibility: "hidden",
  },
  /** コンテンツサイズ最適化設定 */
  CONTENT_SIZING: {
    width: "max-content",
    height: "max-content",
  },
  /** MathJax overflow対策CSS */
  MATHJAX_OVERFLOW_CSS: `
    mjx-container[jax="SVG"] > svg { overflow: visible !important; }
    mjx-container svg { overflow: visible !important; }
  `,
} as const

/**
 * SVG生成の設定
 */
export const SVG_SETTINGS = {
  /** SVG名前空間 */
  NAMESPACE: "http://www.w3.org/2000/svg",
  /** XHTML名前空間 */
  XHTML_NAMESPACE: "http://www.w3.org/1999/xhtml",
  /** デフォルトのoverflow設定 */
  DEFAULT_OVERFLOW: "visible",
} as const
