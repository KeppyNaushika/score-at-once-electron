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
  DEFAULT_FAMILY: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans JP", "Hiragino Kaku Gothic ProN", "ヒラギノ角ゴ ProN W3", Arial, sans-serif',
  /** デフォルトテキスト色 */
  DEFAULT_COLOR: '#000000',
} as const

/**
 * DOM測定のための設定
 */
export const MEASUREMENT_SETTINGS = {
  /** 測定用要素の最小幅 */
  MIN_WIDTH: 20,
  /** 測定用要素の最小高さ */
  MIN_HEIGHT: 20,
  /** 左右の余白（px） */
  HORIZONTAL_PADDING: 20,
  /** 上下の余白（px） - 完璧な結果のため0に設定 */
  VERTICAL_PADDING: 0,
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
  DEBUG_BORDER_COLOR: 'red',
  /** デバッグ用赤枠の線幅 */
  DEBUG_BORDER_WIDTH: 1,
  /** 選択されたテキストボックスの枠色 */
  SELECTED_BORDER_COLOR: '#2563eb',
  /** 非選択テキストボックスの枠色 */
  UNSELECTED_BORDER_COLOR: '#6b7280',
  /** 作成中テキストボックスの枠色 */
  CREATING_BORDER_COLOR: '#3b82f6',
  /** 選択されたテキストボックスの背景色 */
  SELECTED_BACKGROUND_COLOR: 'rgba(37, 99, 235, 0.1)',
} as const

/**
 * DOM要素のスタイル設定
 */
export const DOM_STYLES = {
  /** 非表示要素の位置設定 */
  HIDDEN_POSITION: {
    position: 'absolute',
    left: '-9999px',
    top: '-9999px',
    visibility: 'hidden',
  },
  /** コンテンツサイズ最適化設定 */
  CONTENT_SIZING: {
    width: 'max-content',
    height: 'max-content',
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
  NAMESPACE: 'http://www.w3.org/2000/svg',
  /** XHTML名前空間 */
  XHTML_NAMESPACE: 'http://www.w3.org/1999/xhtml',
  /** デフォルトのoverflow設定 */
  DEFAULT_OVERFLOW: 'visible',
} as const

/**
 * サンプル画像のSVGデータ
 */
export const SAMPLE_IMAGE_URL = 'data:image/svg+xml,' + 
  encodeURIComponent(`
    <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="600" fill="#f8f9fa" stroke="#dee2e6" stroke-width="2"/>
      <text x="400" y="50" text-anchor="middle" font-size="24" font-family="Arial" fill="#495057">
        テキストボックステスト用キャンバス
      </text>
      <text x="400" y="100" text-anchor="middle" font-size="16" font-family="Arial" fill="#6c757d">
        ドラッグしてテキストボックスを作成してください
      </text>
      <line x1="50" y1="150" x2="750" y2="150" stroke="#dee2e6" stroke-width="1"/>
      <line x1="50" y1="300" x2="750" y2="300" stroke="#dee2e6" stroke-width="1"/>
      <line x1="50" y1="450" x2="750" y2="450" stroke="#dee2e6" stroke-width="1"/>
      <line x1="200" y1="120" x2="200" y2="580" stroke="#dee2e6" stroke-width="1"/>
      <line x1="400" y1="120" x2="400" y2="580" stroke="#dee2e6" stroke-width="1"/>
      <line x1="600" y1="120" x2="600" y2="580" stroke="#dee2e6" stroke-width="1"/>
    </svg>
  `)