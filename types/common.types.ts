/**
 * 共通型定義ファイル
 *
 * このファイルは複数のモジュールで共有される型定義を提供します。
 * 方針:
 * 1. Prisma型を第一優先で使用（型再宣言しない）
 * 2. IPC通信ではDateオブジェクトをそのまま渡す（Structured Clone対応）
 * 3. 未使用の型は削除
 */

import type { Prisma } from "@prisma/client"

/**
 * IPCハンドラーが返すProject型
 * getProjectsクエリの戻り値 + 平坦化されたcropRegionsとanswerImages
 */
export type ProjectWithDetails = Prisma.ProjectGetPayload<{
  include: {
    userProjects: { include: { user: true } }
    projectPages: {
      include: {
        masterImages: true
        studentAnswerImages: { include: { student: true } }
        cropRegions: {
          include: {
            questionScores: { include: { student: true; user: true } }
          }
        }
      }
    }
    projectSubtotalGroups: {
      include: { subtotalGroup: { include: { subtotals: true } } }
    }
    projectStudents: true
  }
}> & {
  /** IPCハンドラーで平坦化されるcropRegions */
  cropRegions?: Prisma.CropRegionGetPayload<{
    include: {
      questionScores: { include: { student: true; user: true } }
    }
  }>[]
  /** IPCハンドラーで抽出されるanswerImages */
  answerImages?: (Prisma.StudentAnswerImageGetPayload<{
    include: { student: true }
  }> & {
    pageNumber: number
  })[]
}

/** @deprecated Use ProjectWithDetails instead */
export type SerializedProject = ProjectWithDetails

// =============================================================================
// 型ガード関数
// =============================================================================

/**
 * データがProjectWithDetails型かどうかを検証する型ガード
 * @param data - 検証対象のデータ
 * @returns ProjectWithDetails型の場合true
 */
export function isValidProject(data: unknown): data is ProjectWithDetails {
  if (typeof data !== "object" || data === null) return false

  const obj = data as Record<string, unknown>

  // DateはIPC経由でDateオブジェクトとして渡される
  const isValidDate = (val: unknown): boolean =>
    val instanceof Date || typeof val === "string"

  return (
    typeof obj.id === "string" &&
    typeof obj.examName === "string" &&
    (obj.examDate === null || isValidDate(obj.examDate)) &&
    (obj.subject === undefined ||
      obj.subject === null ||
      typeof obj.subject === "string") &&
    (obj.description === undefined ||
      obj.description === null ||
      typeof obj.description === "string") &&
    isValidDate(obj.createdAt) &&
    isValidDate(obj.updatedAt) &&
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
 * QuestionScoreのデータ型
 * IPC通信およびUI表示で使用
 * v0.4.0+: studentId, userId は必須
 */
export interface QuestionScoreData {
  id: string
  cropRegionId: string
  studentId: string
  partialScore: number | null
  status: string // unscored, correct, incorrect, partial, no_answer
  userId: string
  createdAt: Date
  updatedAt: Date
}

/**
 * QuestionScore作成用データ型
 * preload.tsでIPC通信時に使用
 * v0.4.0+: studentId, userId は必須
 */
export interface QuestionScoreCreateData {
  cropRegionId: string
  studentId: string
  partialScore?: number | null
  userId: string
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
// その他の共有型
// =============================================================================

/**
 * StudentTable等で使用する生徒データ型
 * Prisma.StudentGetPayloadの簡略版
 */
export interface StudentData {
  id: string
  studentNumber: string
  name: string
  furigana?: string
  admissionYear?: number
  createdAt: Date
  updatedAt: Date
}
