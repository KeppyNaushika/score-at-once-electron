// Excel・PDF出力で共通的に使用される型定義

import type { ExamStudentStatus } from "@/types/examStudentStatus.types"
import type {
  ScoringValidationResult,
  ScoringValidationWarnings,
} from "@/types/exportValidation.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

/**
 * 出力に必要な生徒ごとの表示学級情報（採番学級の解決結果）。
 *
 * 採番学級の解決は renderer 側（`resolveExamClassroomPlacement`）で行い、書き出しに
 * 必要な値だけをこの lean な形で main へ渡す（export は型制限の対象外・DB へ書き戻さない）。
 * 未指定の生徒は fetchExportData 側で `student.memberships[0]` にフォールバックする。
 */
export interface StudentExportPlacement {
  grade: number | null
  className: string | null
  attendanceNumber: number | null
}

export interface ExportGradingDataOptions {
  examId: string
  selectedExamStudentIds: string[]
  outputPath?: string
  forceExport?: boolean // 警告を無視して強制実行
  /**
   * renderer が採番解決して渡す表示学級情報。**キーは Student.id**
   * （学級所属は人に紐づくので、採番学級の解決も Student キーになる）。
   * 受験者IDではないことに注意 — 両方 string なので取り違えても型検査は通る。
   */
  studentPlacements?: Record<string, StudentExportPlacement>
}

export interface ScoringData {
  /** 採点データの同定に使う受験者ID（ExamStudent.id） */
  examStudentId: string
  /** 人としての生徒ID。学級所属（Student キー）との突き合わせに使う */
  studentId: string
  studentName: string
  studentNumber: string
  grade?: string
  className?: string
  attendanceNumber?: number | null
  status?: ExamStudentStatus
  scores: ScoreDetail[]
  totalScore: number | null
  totalMaxScore: number
  subtotalScores: SubtotalScore[]
}

export interface SubtotalScore {
  /** Subtotal ID */
  subtotalId: string
  /** SubtotalGroup ID */
  subtotalGroupId: string
  /** SubtotalGroup名 */
  subtotalGroupName: string
  /** 小計点ラベル（Subtotal.name） */
  subtotalLabel: string
  /** 得点（全設問unscoredの場合はnull） */
  score: number | null
  /** 最大点 */
  maxScore: number
  /** QUESTION_ASSIGNMENTが存在するか（設問と関連付けられているか） */
  hasQuestionAssignments: boolean
}

/** SubtotalGroupとその小計項目の情報（Excel・個人成績表出力で共通） */
export interface SubtotalGroupData {
  groupId: string
  groupName: string
  subtotals: Array<{
    id: string
    name: string
    order: number
  }>
}

export interface ScoreDetail {
  questionId: string
  questionLabel: string
  daimon?: string
  shomon?: string
  shimon?: string
  score: number | null
  maxScore: number
  status: ScoringStatus
}

export interface ExportResult {
  success: boolean
  outputPath?: string
  error?: string
  warnings?: ScoringValidationWarnings
  validationResult?: ScoringValidationResult
}

// 問題分析関連の型定義
export type DiscriminationLevel =
  "good" | "acceptable" | "marginal" | "poor" | "negative" | "insufficient"
