/**
 * 02-template (採点領域作成) 関連の型定義統合ファイル
 */

import { type CropRegion, type ExamPage, User } from "@prisma/client"

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
 * 採点領域のタイプ定義
 * - QUESTION_ANSWER: 解答欄
 * - STUDENT_NAME: 氏名欄
 * - STUDENT_ID: 生徒番号欄
 * - TOTAL_SCORE: 合計点欄
 * - SUBTOTAL_SCORE: 小計欄
 * - MARK: マーク欄
 * - COMMENT: コメント欄
 * - OTHER: その他
 */
export type AreaType =
  | "QUESTION_ANSWER"
  | "STUDENT_NAME"
  | "STUDENT_ID"
  | "TOTAL_SCORE"
  | "SUBTOTAL_SCORE"
  | "MARK"
  | "COMMENT"
  | "OTHER"

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

/**
 * データベース操作のタイプ
 */
export type DatabaseOperation = "create" | "update"

// ============================================================================
// State Management Types
// ============================================================================

/**
 * 初期データ読み込みの状態
 */
export interface InitialDataState {
  /** 現在のユーザー */
  currentUser: User | null
  /** マスター画像一覧 */
  masterImages: ExamPage[]
  /** 選択中のマスター画像 */
  selectedMasterImage: ExamPage | null
  /** 背景画像のURL */
  backgroundImageUrl: string | null
  /** 画像の寸法 */
  imageDimensions: ImageDimensions | null
  /** 採点領域一覧 */
  cropRegions: CropRegionArea[]
  /** レイアウトID */
  layoutId: string | undefined
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
  areaIndex: number
  handle: "nw" | "ne" | "sw" | "se"
  startCoords: { x: number; y: number }
  originalArea: { x: number; y: number; width: number; height: number }
}

/**
 * State for tracking move operations
 */
export interface MoveState {
  areaIndex: number
  startCoords: { x: number; y: number }
  originalArea: { x: number; y: number; width: number; height: number }
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
    index: number,
    coords: { x: number; y: number; width: number; height: number }
  ) => void
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
