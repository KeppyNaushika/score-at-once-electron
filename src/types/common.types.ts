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

import type { ScoringStatus } from "./scoringStatus.types"
import { defineStringUnion } from "./stringUnion"

/**
 * IPCハンドラーが返すExam型
 * getExamsクエリの戻り値 + 平坦化されたcropRegionsとanswerImages
 */
export type ExamWithDetails = Prisma.ExamGetPayload<{
  include: {
    userExams: { include: { user: true } }
    examPages: {
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
    examSubtotalGroups: {
      include: { subtotalGroup: { include: { subtotals: true } } }
    }
    examStudents: true
    examTags: {
      select: { tag: { select: { id: true; name: true; color: true } } }
    }
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

/**
 * 試験一覧表示用の軽量型
 * ステータスはメインプロセスで事前計算済み
 */
export interface ExamListItem {
  id: string
  examName: string
  examDate: Date | null
  tags: { id: string; name: string; color: string | null }[]
  description: string | null
  createdAt: Date
  updatedAt: Date
  status: {
    step: number
    action: string
    text: string
    url: string
    isCompleted: boolean
    canStart: boolean
  }
}

// =============================================================================
// 型ガード関数
// =============================================================================

/**
 * データがExamWithDetails型かどうかを検証する型ガード
 * @param data - 検証対象のデータ
 * @returns ExamWithDetails型の場合true
 */
export function isValidExam(data: unknown): data is ExamWithDetails {
  if (typeof data !== "object" || data === null) return false

  const record = data as Record<string, unknown>

  // DateはIPC経由でDateオブジェクトとして渡される
  const isValidDate = (value: unknown): boolean =>
    value instanceof Date || typeof value === "string"

  return (
    typeof record.id === "string" &&
    typeof record.examName === "string" &&
    (record.examDate === null || isValidDate(record.examDate)) &&
    (record.description === undefined ||
      record.description === null ||
      typeof record.description === "string") &&
    isValidDate(record.createdAt) &&
    isValidDate(record.updatedAt) &&
    (record.examPages === undefined || Array.isArray(record.examPages)) &&
    (record.cropRegions === undefined || Array.isArray(record.cropRegions)) &&
    (record.examStudents === undefined || Array.isArray(record.examStudents)) &&
    (record.userExams === undefined || Array.isArray(record.userExams)) &&
    (record.examSubtotalGroups === undefined ||
      Array.isArray(record.examSubtotalGroups)) &&
    (record.answerImages === undefined || Array.isArray(record.answerImages))
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
 * 型ガード `isCropRegionAreaType` と境界コンバータ `toCropRegionAreaType`
 * （想定外値は OTHER）。DB 上は String 保存のため境界で narrowing する。
 */
export const { is: isCropRegionAreaType, to: toCropRegionAreaType } =
  defineStringUnion(CROP_REGION_AREA_TYPES, "OTHER")

/**
 * UI表示用のCropRegion型
 * Prisma型のCropRegionをUIで扱いやすい形に変換したもの
 */
export interface CropRegionArea {
  id?: string
  examPageId?: string
  label: string
  type: CropRegionAreaType
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
  status: ScoringStatus
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
  status?: ScoringStatus
}

/**
 * QuestionScore更新用データ型
 * preload.tsでIPC通信時に使用
 */
export interface QuestionScoreUpdateData {
  partialScore?: number | null
  status?: ScoringStatus
}

/**
 * CropRegion作成用データ型
 * preload.tsでIPC通信時に使用
 */
export interface CropRegionCreateData {
  examPageId: string
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
