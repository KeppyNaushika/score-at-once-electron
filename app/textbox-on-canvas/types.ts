/**
 * @fileoverview Type definitions for textbox-on-canvas functionality
 * @description 数学式対応テキストボックス Canvas システムの型定義
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