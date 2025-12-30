/**
 * 共通型定義ファイル
 *
 * このファイルは複数のモジュールで共有される型定義を提供します。
 * 方針:
 * 1. Prisma型を第一優先で使用（型再宣言しない）
 * 2. IPC通信でのシリアライゼーション拡張は一箇所に集約
 * 3. 未使用の型は削除
 */

import type { PageImage, Student } from "@prisma/client"
import type { ProjectPayload } from "@/electron-src/lib/prisma/project"

// =============================================================================
// シリアライゼーション型 - IPC通信でDate→stringに変換される問題に対応
// =============================================================================

/**
 * Date型をstring型に変換する再帰的ユーティリティ型
 * IPC通信でオブジェクトがJSON.stringify/parseされる際に使用
 */
export type Serialized<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T

/**
 * Prisma型ベースのシリアライゼーション済みProject型
 * IPCハンドラーで追加されるプロパティを含む
 */
export type SerializedProject = Serialized<ProjectPayload> & {
  /** IPCハンドラーで平坦化されるcropRegions（questionScoresを含む） */
  cropRegions?: Serialized<
    NonNullable<ProjectPayload["projectPages"][number]["cropRegions"]>[number]
  >[]
  /** IPCハンドラーで抽出されるanswerImages */
  answerImages?: {
    id: string
    projectPageId: string
    studentId: string | null
    imagePath: string
    imageType: string
    pageNumber: number
    createdAt: string
    updatedAt: string
    student?: Serialized<Student> | null
  }[]
}

/** ProjectWithDetailsはSerializedProjectのエイリアス */
export type ProjectWithDetails = SerializedProject

// =============================================================================
// 型ガード関数
// =============================================================================

/**
 * データがSerializedProject型かどうかを検証する型ガード
 * @param data - 検証対象のデータ
 * @returns SerializedProject型の場合true
 */
export function isValidProject(data: unknown): data is SerializedProject {
  if (typeof data !== "object" || data === null) return false

  const obj = data as Record<string, unknown>

  return (
    typeof obj.id === "string" &&
    typeof obj.examName === "string" &&
    (obj.examDate === null || typeof obj.examDate === "string") &&
    (obj.subject === undefined ||
      obj.subject === null ||
      typeof obj.subject === "string") &&
    (obj.description === undefined ||
      obj.description === null ||
      typeof obj.description === "string") &&
    typeof obj.createdAt === "string" &&
    typeof obj.updatedAt === "string" &&
    (obj.projectPages === undefined || Array.isArray(obj.projectPages)) &&
    (obj.cropRegions === undefined || Array.isArray(obj.cropRegions)) &&
    (obj.projectStudents === undefined || Array.isArray(obj.projectStudents)) &&
    (obj.userProjects === undefined || Array.isArray(obj.userProjects)) &&
    (obj.projectSubtotalGroups === undefined ||
      Array.isArray(obj.projectSubtotalGroups)) &&
    (obj.answerImages === undefined || Array.isArray(obj.answerImages))
  )
}

// =============================================================================
// CropRegion関連型 - 採点領域定義
// =============================================================================

/** CropRegion領域タイプの定数配列 */
export const CROP_REGION_AREA_TYPES = [
  "QUESTION_ANSWER",
  "STUDENT_NAME",
  "STUDENT_ID",
  "TOTAL_SCORE",
  "SUBTOTAL_SCORE",
  "MARK",
  "COMMENT",
  "OTHER",
] as const

/** CropRegion領域タイプのユニオン型 */
export type CropRegionAreaType = (typeof CROP_REGION_AREA_TYPES)[number]

/**
 * UI表示用のCropRegion型
 * Prisma型のCropRegionをUIで扱いやすい形に変換したもの
 */
export interface CropRegionArea {
  id?: string
  projectPageId?: string
  label: string
  type: string
  x: number
  y: number
  width: number
  height: number
  orderIndex?: number | null
  points?: number | string | null
  createdAt?: Date
  updatedAt?: Date
  questionScores?: QuestionScoreData[]
}

// =============================================================================
// QuestionScore関連型 - 採点データ
// =============================================================================

/**
 * QuestionScoreのシリアライズ済みデータ型
 * IPC通信およびUI表示で使用
 */
export interface QuestionScoreData {
  id: string
  cropRegionId: string
  studentId?: string | null
  partialScore: number | null
  status: string // unscored, correct, incorrect, partial, no_answer
  scoredByUserId?: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * QuestionScore作成用データ型
 * preload.tsでIPC通信時に使用
 */
export interface QuestionScoreCreateData {
  cropRegionId: string
  studentId?: string | null
  partialScore?: number | null
  scoredByUserId?: string | null
  status?: string
}

/**
 * QuestionScore更新用データ型
 * preload.tsでIPC通信時に使用
 */
export interface QuestionScoreUpdateData {
  partialScore?: number | null
  status?: string
}

/**
 * CropRegion作成用データ型
 * preload.tsでIPC通信時に使用
 */
export interface CropRegionCreateData {
  projectPageId: string
  label: string
  type: CropRegionAreaType
  x: number
  y: number
  width: number
  height: number
  orderIndex?: number
  points?: number
}

/**
 * CropRegion更新用データ型
 * preload.tsでIPC通信時に使用
 */
export interface CropRegionUpdateData {
  label?: string
  type?: CropRegionAreaType
  x?: number
  y?: number
  width?: number
  height?: number
  orderIndex?: number
  points?: number
}

// =============================================================================
// 後方互換性エイリアス - 段階的移行用
// =============================================================================

/** @deprecated CropRegionAreaTypeを使用してください */
export type LayoutRegionAreaType = CropRegionAreaType

/** @deprecated CROP_REGION_AREA_TYPESを使用してください */
export const LAYOUT_REAGION_AREA_TYPES = CROP_REGION_AREA_TYPES

/** @deprecated CropRegionAreaを使用してください */
export type LayoutRegionArea = CropRegionArea

/** @deprecated CropRegionCreateDataを使用してください */
export type LayoutRegionCreateData = CropRegionCreateData

/** @deprecated CropRegionUpdateDataを使用してください */
export type LayoutRegionUpdateData = CropRegionUpdateData

// =============================================================================
// その他の共有型
// =============================================================================

/**
 * StudentTable等で使用する生徒データ型
 * Prisma.StudentGetPayloadの簡略版
 */
export interface StudentData {
  id: string
  studentId: string
  name: string
  furigana?: string
  admissionYear?: number
  createdAt: Date
  updatedAt: Date
}

/**
 * 01-upload等で使用するマスター解答データ型
 * 後方互換性のために維持
 */
export interface MasterAnswerData {
  id: string
  projectId: string
  imagePath: string
  pageNumber: number
  createdAt: Date
  updatedAt: Date
}

/**
 * 採点マーク設定型
 * PDF出力時のマーク表示設定
 */
export interface ScoringMarkConfig {
  position:
    | "top-left"
    | "top-center"
    | "top-right"
    | "center-left"
    | "center"
    | "center-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right"
  size: number
  showCorrect: boolean
  showIncorrect: boolean
  showPartial: boolean
}
