/**
 * キャンバス参照管理フック
 * - 複数キャンバスの参照（メイン、オーバーレイ、テキスト）
 * - 画像要素参照
 * - コンテナ参照
 * - 各種キャッシュ参照
 */
import { useRef } from "react"

import type { CanvasRefs } from "./types"

/**
 * キャンバス関連のref管理を行うフック
 * @returns キャンバス参照オブジェクト
 */
export function useCanvasRefs(): CanvasRefs {
  // メインキャンバス（画像・描画要素）
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // オーバーレイキャンバス（ハンドル専用）
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  // テキスト専用レイヤー
  const textCanvasRef = useRef<HTMLCanvasElement>(null)
  // 座標計算用の隠し画像要素
  const imageRef = useRef<HTMLImageElement>(null)
  // コンテナ要素（リサイズ検出用）
  const containerRef = useRef<HTMLDivElement>(null)

  // テキスト要素のレンダリング結果キャッシュ（ヒットテスト用）
  const textBoundsCacheRef = useRef<
    Map<string, { x: number; y: number; width: number; height: number }>
  >(new Map())

  // 採点記号画像のキャッシュ
  const scoringMarkImagesRef = useRef<Map<string, HTMLImageElement>>(new Map())

  return {
    canvasRef,
    overlayCanvasRef,
    textCanvasRef,
    imageRef,
    containerRef,
    textBoundsCacheRef,
    scoringMarkImagesRef,
  }
}
