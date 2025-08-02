import type { ScoringStatus } from "@/components/projects/07-score-at-once/types/shared.types"

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
  questionRegion: any // CropRegion データ（設問領域情報）
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
