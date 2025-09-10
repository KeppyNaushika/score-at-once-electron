/**
 * @fileoverview Type definitions for textbox-on-canvas-v4 functionality
 * @description 数学式対応テキストボックス Canvas システムの型定義（リファクタリング版）
 * 
 * ## 型分類
 * - Core Types: 基本データ構造
 * - UI Types: ユーザーインターフェース関連
 * - Rendering Types: 描画・変換関連
 * - Hook Types: カスタムフック関連
 */

/**
 * テキストボックスの基本データ構造
 */
export interface TextBox {
  /** 一意識別子 */
  id: string
  /** X座標 */
  x: number
  /** Y座標 */
  y: number
  /** 幅 */
  width: number
  /** 高さ */
  height: number
  /** テキスト内容 */
  text: string
  /** 選択状態 */
  isSelected: boolean
  /** 水平方向の配置 */
  horizontalAlign: 'left' | 'center' | 'right'
  /** 垂直方向の配置 */
  verticalAlign: 'top' | 'center' | 'bottom'
}

/**
 * 2D座標点
 */
export interface Point {
  /** X座標 */
  x: number
  /** Y座標 */
  y: number
}

/**
 * ドラッグ操作の状態
 */
export interface DragState {
  /** ドラッグ開始X座標 */
  startX: number
  /** ドラッグ開始Y座標 */
  startY: number
  /** 現在のX座標 */
  currentX: number
  /** 現在のY座標 */
  currentY: number
}

/**
 * サイズ測定結果
 */
export interface MeasuredSize {
  /** 測定された幅 */
  width: number
  /** 測定された高さ */
  height: number
}

/**
 * SVG描画結果
 */
export interface SvgRenderResult {
  /** 描画されたCanvas要素 */
  canvas?: HTMLCanvasElement
  /** 実際の描画幅 */
  width: number
  /** 実際の描画高さ */
  height: number
}

/**
 * MathJax処理オプション
 */
export interface MathJaxProcessingOptions {
  /** フォントサイズ */
  fontSize: number
  /** 行の高さ */
  lineHeight: number
  /** テキスト色 */
  color: string
  /** 待機フレーム数 */
  waitFrames?: number
}

/**
 * DOM要素の測定情報
 */
export interface ElementMeasurement {
  /** 要素のタグ名 */
  tagName: string
  /** CSSクラス名 */
  className: string
  /** MathJaxの子要素かどうか */
  isMathJaxChild?: boolean
  /** bounding rectangle情報 */
  rect: {
    top: number
    bottom: number
    left: number
    right: number
    width: number
    height: number
  }
}

/**
 * コンテンツ測定の詳細結果
 */
export interface DetailedMeasurement {
  /** コンテナのbounding rectangle */
  containerRect: DOMRect
  /** 最終的な境界 */
  finalBounds: {
    top: number
    bottom: number
    left: number
    right: number
  }
  /** 最終サイズ */
  finalSize: MeasuredSize
  /** 測定された要素数 */
  elementCount: number
  /** 最下部の要素 */
  bottomMostElement: ElementMeasurement | null
  /** 下部要素のリスト */
  bottomElements: ElementMeasurement[]
}

// =============================================================================
// UI Types - ユーザーインターフェース関連
// =============================================================================

/**
 * プレビューコンポーネントの共通Props
 */
export interface PreviewComponentProps {
  /** 対象のテキストボックス */
  textBox: TextBox
}

/**
 * レンダリング状態の種類
 */
export type RenderingStatus = 
  | "待機中"
  | "SVG生成中..."
  | "Image生成中..."
  | "Canvas描画中..."
  | "SVG生成完了"
  | "Image生成完了"
  | "Canvas描画完了"
  | "SVG生成失敗"
  | "Image生成失敗"
  | "Canvas描画失敗"
  | "SVG生成エラー"
  | "Image生成エラー"
  | "Canvas描画エラー"
  | "描画完了"
  | "描画エラー"

// =============================================================================
// Rendering Types - 描画・変換関連
// =============================================================================

/**
 * SVG変換オプション（統合版）
 */
export interface SvgConversionOptions {
  /** テキスト内容 */
  text: string
  /** 幅 */
  width: number
  /** 高さ */
  height: number
  /** 水平方向の配置 */
  horizontalAlign?: 'left' | 'center' | 'right'
  /** 垂直方向の配置 */
  verticalAlign?: 'top' | 'center' | 'bottom'
}

/**
 * 描画結果の統一データ構造
 */
export interface RenderResult {
  /** 描画幅 */
  width: number
  /** 描画高さ */
  height: number
  /** 成功フラグ */
  success: boolean
  /** エラーメッセージ */
  error?: string
}

/**
 * Canvas描画状態
 */
export interface CanvasState {
  /** Canvas参照 */
  canvasRef: React.RefObject<HTMLCanvasElement>
  /** 現在の状態 */
  status: RenderingStatus
}

// =============================================================================
// Hook Types - カスタムフック関連
// =============================================================================

/**
 * Canvas管理フックの戻り値
 */
export interface CanvasManagementHook {
  /** Canvas要素の参照 */
  canvasRef: React.RefObject<HTMLCanvasElement>
  /** 現在の状態 */
  status: string
  /** テキストをCanvasに描画する関数 */
  renderTextToCanvas: (
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    horizontalAlign?: 'left' | 'center' | 'right',
    verticalAlign?: 'top' | 'center' | 'bottom'
  ) => Promise<void>
  /** Canvas全体を再描画する関数 */
  redrawCanvas: (
    textBoxes: TextBox[],
    currentDrag: DragState | null,
    isCreatingTextBox: boolean,
    backgroundImageUrl?: string
  ) => Promise<void>
}

/**
 * テキストボックス操作フックの戻り値
 */
export interface TextBoxOperationsHook {
  // 状態
  textBoxes: TextBox[]
  selectedTextBoxId: string | null
  currentDrag: DragState | null
  isCreatingTextBox: boolean
  showTextInput: boolean
  textInputValue: string
  setTextInputValue: (value: string) => void

  // 操作メソッド
  handleMouseDown: (e: React.MouseEvent, zoom: number) => void
  handleMouseMove: (e: React.MouseEvent, zoom: number) => void
  handleMouseUp: () => void
  handleTextSubmit: () => void
  handleTextCancel: () => void
  getSelectedTextBox: () => TextBox | null

  // 直接操作
  setTextBoxes: React.Dispatch<React.SetStateAction<TextBox[]>>
  setSelectedTextBoxId: React.Dispatch<React.SetStateAction<string | null>>
}