/**
 * 02-template (採点領域作成) 関連の型定義統合ファイル
 */

import { type CropRegion } from "@prisma/client"

import type { CropRegionAreaType } from "@/types/cropRegionAreaType.types"

/**
 * UI表示用のCropRegion型。
 * Prisma の CropRegion を採点領域エディタで扱いやすい形に拡張したもの。
 * 保存前は id/examPageId/timestamps が未確定のため optional。
 * type は SSOT の CropRegionAreaType に narrowing、points はフォーム入力時に string を許容。
 */
export type CropRegionArea = Omit<
  CropRegion,
  | "id"
  | "examPageId"
  | "orderIndex"
  | "createdAt"
  | "updatedAt"
  | "type"
  | "points"
> &
  Partial<
    Pick<
      CropRegion,
      "id" | "examPageId" | "orderIndex" | "createdAt" | "updatedAt"
    >
  > & {
    type: CropRegionAreaType
    points?: number | string | null
  }

// ============================================================================
// Core Type Definitions
// ============================================================================

/**
 * 座標情報のみを表す型
 */
export interface RegionCoordinates {
  /** X座標（相対座標 0-1） */
  x: number
  /** Y座標（相対座標 0-1） */
  y: number
  /** 幅（相対座標 0-1） */
  width: number
  /** 高さ（相対座標 0-1） */
  height: number
}

/**
 * 画像の寸法情報
 */
export interface ImageDimensions {
  /** 画像の幅（ピクセル） */
  width: number
  /** 画像の高さ（ピクセル） */
  height: number
}

// ============================================================================
// Canvas Interaction Types
// ============================================================================

/**
 * State for tracking drag operations
 */
export interface DragState {
  x: number
  y: number
}

/**
 * State for tracking resize operations
 */
export interface ResizeState {
  cropRegionId: string
  handle: "nw" | "ne" | "sw" | "se"
  startCoords: { x: number; y: number }
  originalArea: RegionCoordinates
}

/**
 * State for tracking move operations
 */
export interface MoveState {
  cropRegionId: string
  startCoords: { x: number; y: number }
  originalArea: RegionCoordinates
}

/**
 * 掴んでいる間の領域の姿。
 *
 * リサイズ・移動の途中はここに置くだけで DB へは書かない。指を離したときに
 * 1回だけ書く（`usePointerHandlers`）。
 *
 * **指すのは添字ではなく id。** `areas` は取得したものなので、他の教員が領域を
 * 消せば並びが変わる。添字で持つと、掴んだのとは別の領域を書き換える。
 */
export interface AdjustingArea {
  cropRegionId: string
  coords: RegionCoordinates
}

/**
 * Props for the image canvas interaction hook
 */
export interface UseImageCanvasInteractionProps {
  disabled: boolean
  backgroundImageUrl: string | null
  imageDimensions: { width: number; height: number } | null
  examPageId: string | null
  areas: CropRegionArea[]
  onAddAreaByDrag: (
    type: CropRegionAreaType,
    coords: { x: number; y: number; width: number; height: number }
  ) => void
  onUpdateArea: (
    cropRegionId: string,
    coords: RegionCoordinates
  ) => Promise<void>
  zoom: number
  // 検出関連のプロパティ（オプション）
  detectionMode?: DetectionMode
  onSnapToDetectedRects?: (dragRect: {
    x: number
    y: number
    width: number
    height: number
  }) => DragSelectionResult
}

// ============================================================================
// Frame Detection Types (採点枠自動認識)
// ============================================================================

/**
 * 検出された長方形
 */
export interface DetectedRect {
  /** 一意識別子（UUID） */
  id: string
  /** X座標（相対座標 0-1） */
  x: number
  /** Y座標（相対座標 0-1） */
  y: number
  /** 幅（相対座標 0-1） */
  width: number
  /** 高さ（相対座標 0-1） */
  height: number
  /** 検出信頼度 0-1 */
  confidence: number
}

/**
 * 検出設定（シンプル版）
 */
export interface DetectionSettings {
  /** 線の延長ピクセル デフォルト: 0 */
  lineExtension: number
  /** 最小幅（相対座標）デフォルト: 0.02 */
  minWidth: number
  /** 最小高さ（相対座標）デフォルト: 0.01 */
  minHeight: number
  /** 検出感度 1-5（高いほど薄い線を検出）デフォルト: 3 */
  sensitivity: number
}

/**
 * 検出モード
 * - manual: 手動
 * - auto: 自動（オーバーレイ表示 + スナップ補正）
 */
export type DetectionMode = "manual" | "auto"

/**
 * ドラッグ選択結果
 */
export interface DragSelectionResult {
  /** 選択された検出枠 */
  selectedRects: DetectedRect[]
  /** マージされた境界 */
  mergedBounds: {
    x: number
    y: number
    width: number
    height: number
  }
}
