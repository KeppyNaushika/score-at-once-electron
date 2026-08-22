/**
 * 採点の確定（裁定）に関する型。
 *
 * 裁定の対象は「resolveEffectiveScores が有効スコアを解決できなかったセル」だけ。
 * 単独採点では提案が常に1件なので構造的に発生せず、確定フローは表に出ない。
 * 全セルを確定して回る必要は無い。
 */
import type { ScoringStatus } from "./scoringStatus.types"

/** 裁定対象セルにおける採点者ごとの提案 */
export interface ScoreProposal {
  questionScoreId: string
  userId: string
  userName: string
  status: ScoringStatus
  partialScore: number | null
  /** status と partialScore から算出した実得点（未採点は null） */
  scoreValue: number | null
  updatedAt: string
}

/** 確定済みセルの内容（裁定パネルの初期値・再確認の判断材料） */
export interface ScoreDecisionSnapshot {
  verdict: ScoringStatus
  score: number | null
  comment: string | null
  decidedByName: string
  decidedAt: string
}

/** 裁定が必要になった理由 */
export type ScoreDecisionReason =
  /** 提案が食い違い有効スコアを解決できない（出力では未採点になる） */
  | "conflict"
  /** 確定済みだが、その後に新しい提案が入った（再確認が必要） */
  | "stale"

/** 裁定対象の受験者×設問セル */
export interface ScoreDecisionCell {
  examStudentId: string
  studentName: string
  cropRegionId: string
  reason: ScoreDecisionReason
  /** 採点者ごとの提案（unscored を除く） */
  proposals: ScoreProposal[]
  /** 既存の確定（未確定なら null） */
  decision: ScoreDecisionSnapshot | null
  /**
   * このセルが未解決のまま出力されることで合計点から失われる最大値。
   * stale は確定値が出力されるため 0。
   */
  scoreImpact: number
}

/** 設問の採点担当と、その担当者の進み具合 */
export interface AssignedGrader {
  userId: string
  userName: string
  /** この設問でこの担当者が採点した（unscored でない）セル数 */
  scoredCount: number
}

/** 設問ごとの担当・進捗・裁定状況 */
export interface ScoreDecisionQuestion {
  cropRegionId: string
  questionLabel: string
  maxScore: number
  orderIndex: number
  /**
   * 採点担当（0人なら全員担当とみなす — 割当漏れで採点不能にしないため）。
   * 担当者ごとの進捗もここに畳む（設問×担当者を添字で突き合わせない）。
   */
  assignees: AssignedGrader[]
  /** 答案がある受験者数（この設問の分母） */
  totalStudents: number
  /** 誰か1人でも採点したセル数 */
  scoredCount: number
  /** 裁定対象のセル（受験生徒順） */
  cells: ScoreDecisionCell[]
  /** この設問で確定済みのセル数 */
  decidedCount: number
}

/** 採点担当の割当1件（採点画面の設問絞り込みが使う軽量な形） */
export interface CropRegionAssignmentSummary {
  cropRegionId: string
  userId: string
  userName: string
}

/** 割当先の候補（試験のメンバー） */
export interface ExamMemberSummary {
  userId: string
  userName: string
  role: string
}

/** 試験全体の裁定サマリ */
export interface ExamDecisionSummary {
  /** 提案（unscored 以外）を1件以上持つ distinct な採点者数。1以下なら単独採点 */
  graderCount: number
  conflictCount: number
  staleCount: number
  decidedCount: number
  /** conflict の解消により回復しうる合計点の最大値 */
  totalScoreImpact: number
  /** 全ての設問（orderIndex 昇順）。裁定対象が無い設問も担当・進捗のために含む */
  questions: ScoreDecisionQuestion[]
  /** 割当先に選べる試験メンバー */
  members: ExamMemberSummary[]
  /** 現在のユーザーが確定・担当割当をできるか（試験 OWNER のみ） */
  canDecide: boolean
}
