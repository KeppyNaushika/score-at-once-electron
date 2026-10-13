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
