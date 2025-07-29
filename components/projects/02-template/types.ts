import { Project, User } from "@prisma/client"

type MasterImage = {
  id: string
  projectId: string
  imagePath: string
  pageNumber: number
  createdAt: Date
  updatedAt: Date
}
import { CropRegionArea } from "@/types/common.types"

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
 * レイアウト領域の基本情報
 */
export interface LayoutRegionData {
  /** データベースID（新規作成時は未定義） */
  id?: string
  /** プロジェクトID */
  projectId?: string
  /** 領域のタイプ */
  type: AreaType
  /** X座標（相対座標 0-1） */
  x: number
  /** Y座標（相対座標 0-1） */
  y: number
  /** 幅（相対座標 0-1） */
  width: number
  /** 高さ（相対座標 0-1） */
  height: number
  /** 領域のラベル */
  label: string
  /** 配点（CropRegionArea互換性のため） */
  points?: number | string | null
  /** 順序インデックス */
  orderIndex?: number | null
  /** 関連するマスター画像のID */
  masterImageId?: string
  /** 作成日時 */
  createdAt?: Date
  /** 更新日時 */
  updatedAt?: Date
}

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
 * テンプレートページのプロパティ型
 */
export interface TemplatePageProps {
  /** プロジェクトID */
  projectId: string
}

/**
 * データベース操作のタイプ
 */
export type DatabaseOperation = 'create' | 'update'

/**
 * 初期データ読み込みの状態
 */
export interface InitialDataState {
  /** プロジェクト情報 */
  project: Project | null
  /** 現在のユーザー */
  currentUser: User | null
  /** マスター画像一覧 */
  masterImages: MasterImage[]
  /** 選択中のマスター画像 */
  selectedMasterImage: MasterImage | null
  /** 背景画像のURL */
  backgroundImageUrl: string | null
  /** 画像の寸法 */
  imageDimensions: ImageDimensions | null
  /** レイアウト領域一覧 */
  layoutRegions: CropRegionArea[]
  /** レイアウトID */
  layoutId: string | undefined
}

/**
 * UI状態の管理
 */
export interface UIState {
  /** 選択中の行インデックス */
  selectedRowIndex: number | null
  /** 読み込み中フラグ */
  isLoading: boolean
  /** 保存中フラグ */
  isSaving: boolean
  /** 検出中フラグ */
  isDetecting: boolean
}