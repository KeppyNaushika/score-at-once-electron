/**
 * 07-score-at-once 共通型定義
 * 複数の機能で使用される型をここに統一
 */

// Prismaから基本型とPayload型をインポート
import type { Prisma, QuestionScore } from "@prisma/client"

// Prisma基本型をエクスポート
export type { CropRegion, PageImage, QuestionScore } from "@prisma/client"

/**
 * 採点状態の型定義
 * Prismaスキーマではstring型なので、ここで厳密な型を定義
 */
export type ScoringStatus =
  | "unscored"
  | "correct"
  | "incorrect"
  | "partial"
  | "pending"
  | "no_answer"
  | "proposed"
  | "final"

/**
 * PageImageを学生とProjectStudents情報で拡張したPrisma生成型
 * 変数名: pageImage, pageImages
 */
export type PageImageWithProjectStudents = Prisma.PageImageGetPayload<{
  include: {
    student: {
      include: {
        projectStudents: true
      }
    }
    projectPage: true
  }
}>

/**
 * CropRegionをProjectPage情報で拡張したPrisma生成型
 * 変数名: cropRegion, cropRegions
 */
export type CropRegionWithProjectPage = Prisma.CropRegionGetPayload<{
  include: {
    projectPage: true
  }
}>

/**
 * 採点モード
 */
export type GradingMode = "grid" | "individual"

/**
 * 現在使用中の型定義（既存コードとの互換性を保持）
 * 将来的にPrisma型への移行を検討
 */
export interface QuestionRegion {
  id: string
  label: string
  points: number // null安全性のためnon-null
  x: number
  y: number
  width: number
  height: number
  projectPageId: string
}

export interface StudentAnswer {
  id: string
  studentId: string
  projectId: string // 既存コードで必要
  imagePath: string
  pageNumber: number // 既存コードで必要
  status: "uploaded" | "processing" | "ready" | "graded"
  student: {
    id: string
    studentId: string
    lastName: string
    firstName: string
    projectStudents?: { customOrder: number }[]
  }
}

/**
 * クライアントサイド用のQuestionScore型
 * partialScoreをDecimalからnumberに変更（UI状態管理用）
 */
export interface ClientQuestionScore
  extends Omit<QuestionScore, "partialScore"> {
  partialScore: number | null
}

/**
 * 採点データレコード（クライアントサイド用）
 */
export interface ScoringDataRecord {
  [key: string]: ClientQuestionScore
}

/**
 * 実際の得点を計算する関数
 * DBには partialScore のみ保存し、表示時に適切な値を計算
 */
export function calculateActualScore(
  score: ClientQuestionScore | null,
  maxScore: number,
): number | null {
  if (!score) return null

  switch (score.status) {
    case "correct":
    case "final":
      return maxScore // cropRegion.points を返す
    case "incorrect":
    case "no_answer":
      return 0
    case "unscored":
      return null
    case "partial":
    case "pending":
    case "proposed":
      return score.partialScore // DBから取得した値をそのまま使用
    default:
      return null
  }
}
