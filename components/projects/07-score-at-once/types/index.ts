/**
 * 07-score-at-once 統合型定義
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
      return maxScore // cropRegion.points を返す
    case "incorrect":
    case "no_answer":
      return 0
    case "unscored":
      return null
    case "partial":
    case "pending":
      return score.partialScore // DBから取得した値をそのまま使用
    default:
      return null
  }
}

/**
 * 採点データの基本インターフェース
 * QuestionScore + Student + CropRegion + PageImage の結合データから変換されたもの
 */
export interface ScoringData {
  id: string // PageImage.id または master用の生成ID
  studentId: string // Student.studentId または "MASTER"
  studentName: string // "${lastName} ${firstName}" または "模範解答"
  imageUrl: string // "appimg://${imagePath}"
  currentScore?: number // QuestionScore.partialScore
  maxScore: number // CropRegion.points
  status: ScoringStatus | "master" // QuestionScore.status または "master"
  questionRegion: CropRegionWithProjectPage // CropRegion データ（設問領域情報）
  isMaster?: boolean // 模範解答フラグ
}

/**
 * 学生の採点データ（模範解答以外）
 */
export interface StudentScoringData extends ScoringData {
  isMaster?: never // 学生データでは常にundefined
}

/**
 * 模範解答の採点データ
 */
export interface MasterScoringData extends Omit<ScoringData, "status"> {
  studentId: "MASTER"
  studentName: "模範解答"
  currentScore: undefined
  status: "master"
  isMaster: true
}