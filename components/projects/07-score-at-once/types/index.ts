/**
 * 07-score-at-once 統合型定義
 * 複数の機能で使用される型をここに統一
 */

/** Prismaから基本型とPayload型をインポート */
import type { Prisma, QuestionScore } from "@prisma/client"

/** Prisma基本型をエクスポート */
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
 * レイアウト方向
 */
export type LayoutDirection =
  | "right-down"
  | "left-down"
  | "down-right"
  | "down-left"

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
      return maxScore
    case "incorrect":
    case "no_answer":
      return 0
    case "unscored":
      return null
    case "partial":
    case "pending":
      return score.partialScore
    default:
      return null
  }
}

/**
 * 採点データの基本インターフェース
 * QuestionScore + Student + CropRegion + PageImage の結合データから変換されたもの
 * 注意: 学生データのみを管理し、模範解答は別途管理する
 */
export interface ScoringData {
  /** PageImage.id */
  id: string
  /** Student.id (UUID) */
  studentId: string
  /** 生徒氏名 */
  studentName: string
  /** 画像URL (appimg://...) */
  imageUrl: string
  /** QuestionScore.partialScore */
  currentScore?: number
  /** CropRegion.points */
  maxScore: number
  /** QuestionScore.status */
  status: ScoringStatus
  /** 採点領域情報 */
  questionRegion: CropRegionWithProjectPage
  /** ProjectStudent.customOrder (必須・ソート用) */
  customOrder: number
}

export type MasterStatus = "master"

export interface MasterGridItem {
  id: string
  studentId: "MASTER"
  studentName: string
  imageUrl: string
  maxScore: number
  status: MasterStatus
  questionRegion: CropRegionWithProjectPage
  customOrder: number
  isMaster: true
}

/**
 * QuestionScore配列からの検索ユーティリティ関数
 * シンプルな線形検索でscoringDataオブジェクトを置き換え
 */
export function findQuestionScore(
  questionScores: QuestionScore[],
  studentId: string,
  cropRegionId: string,
): QuestionScore | undefined {
  return questionScores.find(
    (score) =>
      score.studentId === studentId && score.cropRegionId === cropRegionId,
  )
}

/**
 * QuestionScore配列から採点状況を取得
 */
export function getScoringStatusFromArray(
  questionScores: QuestionScore[],
  studentId: string,
  cropRegionId?: string,
): ScoringStatus {
  if (!cropRegionId) return "unscored"

  const score = findQuestionScore(questionScores, studentId, cropRegionId)
  return (score?.status as ScoringStatus) ?? "unscored"
}

/**
 * Prisma.Decimalを安全にnumberに変換
 */
export function decimalToNumber(
  decimal: Prisma.Decimal | number | string | null | undefined,
): number | null {
  if (decimal === null || decimal === undefined) return null
  return Number(decimal.toString())
}
