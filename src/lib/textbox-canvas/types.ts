/**
 * @fileoverview テキストボックスCanvas機能の型定義
 * @description 数学式対応テキストボックス Canvas システムの型定義（リファクタリング版）
 *
 * ## 型分類
 * - Core Types: 基本データ構造
 * - UI Types: ユーザーインターフェース関連
 * - Rendering Types: 描画・変換関連
 * - Hook Types: カスタムフック関連
 */

/**
 * アンカー方向（8方向）
 */
export type AnchorDirection =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right"

/**
 * 座標系の種類
 */
export type CoordinateSystem = "absolute" | "relative"

/**
 * テキストボックスの基本データ構造（アンカーベース）
 */
export interface TextBox {
  /** 一意識別子 */
  id: string
  /** X座標（絶対座標: px、相対座標: 0.0-1.0） */
  x: number
  /** Y座標（絶対座標: px、相対座標: 0.0-1.0） */
  y: number
  /** テキスト内容 */
  text: string
  /** 選択状態 */
  isSelected: boolean
  /** アンカー方向（テキストの配置位置） */
  anchorDirection: AnchorDirection
  /** テキストサイズ（px） */
  textSize: number
  /** 座標系（デフォルトは absolute） */
  coordinateSystem?: CoordinateSystem
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
 * 座標変換のオプション
 */
export interface CoordinateConversionOptions {
  /** Canvas/画像の幅 */
  canvasWidth: number
  /** Canvas/画像の高さ */
  canvasHeight: number
}

/**
 * 座標変換ユーティリティの型定義
 */
export interface CoordinateConversionUtils {
  /** 相対座標を絶対座標に変換 */
  relativeToAbsolute: (
    point: Point,
    options: CoordinateConversionOptions
  ) => Point
  /** 絶対座標を相対座標に変換 */
  absoluteToRelative: (
    point: Point,
    options: CoordinateConversionOptions
  ) => Point
  /** TextBoxを相対座標系に変換 */
  textBoxToRelative: (
    textBox: TextBox,
    options: CoordinateConversionOptions
  ) => TextBox
  /** TextBoxを絶対座標系に変換 */
  textBoxToAbsolute: (
    textBox: TextBox,
    options: CoordinateConversionOptions
  ) => TextBox
}
