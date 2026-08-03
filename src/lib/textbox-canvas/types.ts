/**
 * @fileoverview テキストボックスCanvas機能の型定義
 * @description 数学式対応テキストボックス Canvas システムの型定義（リファクタリング版）
 *
 * ## 型分類
 * - Core Types: 基本データ構造
 * - UI Types: ユーザーインターフェース関連
 * - Rendering Types: 描画・変換関連
 * - Hook Types: カスタムフック関連
 *
 * アンカー方向はここでは宣言しない。DB 列 `DrawingAnnotation.anchorDirection` の
 * union が正本（`@/types/drawingAnnotation.types` の `defineStringUnion`）で、
 * 同じ9方向を手書きで並べると SSOT に方向を足したときにここだけ取り残される。
 */

import type { AnchorDirection } from "@/types/drawingAnnotation.types"

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
