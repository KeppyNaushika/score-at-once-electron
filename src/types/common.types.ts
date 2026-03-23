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
      select: { tag: { select: { id: true; name: true } } }
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
  tags: { id: string; name: string }[]
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

  const obj = data as Record<string, unknown>

  // DateはIPC経由でDateオブジェクトとして渡される
  const isValidDate = (val: unknown): boolean =>
    val instanceof Date || typeof val === "string"

  return (
    typeof obj.id === "string" &&
    typeof obj.examName === "string" &&
    (obj.examDate === null || isValidDate(obj.examDate)) &&
    (obj.description === undefined ||
      obj.description === null ||
      typeof obj.description === "string") &&
    isValidDate(obj.createdAt) &&
    isValidDate(obj.updatedAt) &&
    (obj.examPages === undefined || Array.isArray(obj.examPages)) &&
    (obj.cropRegions === undefined || Array.isArray(obj.cropRegions)) &&
    (obj.examStudents === undefined || Array.isArray(obj.examStudents)) &&
    (obj.userExams === undefined || Array.isArray(obj.userExams)) &&
    (obj.examSubtotalGroups === undefined ||
      Array.isArray(obj.examSubtotalGroups)) &&
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
  examPageId?: string
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
