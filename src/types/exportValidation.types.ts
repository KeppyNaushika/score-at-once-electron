/**
 * 出力前の採点データ検証の型。
 *
 * 警告は「対処が必要（採点者間の食い違い）」と「知っておけばよい（作業途中）」の
 * 二層に分ける。未採点は採点中に出力すれば必ず出るため、全件をフラットに並べると
 * 対処が要る数件が数百行に埋もれて読まれなくなる。内訳は設問ごとに集約する。
 */
import type { ScoreDecisionCell } from "./scoreDecision.types"

/** 設問ごとに集約した警告 */
export interface QuestionWarning {
  cropRegionId: string
  questionLabel: string
  count: number
  /** 対象の生徒名（内訳を開いたときに出す） */
  studentNames: string[]
}

/** 採点者間で結果が食い違ったセル。出力では未採点になるため対処が必要 */
export interface ConflictWarning extends ScoreDecisionCell {
  questionLabel: string
  maxScore: number
}

export interface ScoringValidationWarnings {
  /** 採点データが存在しない（未着手） */
  noScoringData: QuestionWarning[]
  /** 未採点（データはあるが判定されていない） */
  ungraded: QuestionWarning[]
  /** 部分点・保留で点数が未入力 */
  missingPartialScore: QuestionWarning[]
  /** 採点者間の食い違い（対処が必要） */
  conflicted: ConflictWarning[]
}

export interface ScoringValidationResult {
  hasWarnings: boolean
  /** 対処が必要な件数（= conflicted.length）。0 なら出力を止める理由は無い */
  actionRequiredCount: number
  /** 食い違いが未解決のまま出力されることで合計点から失われる最大値 */
  conflictScoreImpact: number
  /**
   * 食い違いの検査自体に失敗した理由。設定されている場合、
   * `conflicted` が空でも「食い違いが無い」ことは意味しない。
   * 黙って「問題なし」に化けさせないため、警告として必ず表示する。
   */
  conflictCheckError?: string
  warnings: ScoringValidationWarnings
}
