/**
 * 朱書きだけをまとめて反映するときの対象（採点の確定とは別に確定する）。
 *
 * 例えば「部分点の答案にだけ朱書きを入れ、誤答には入れない」のように、AI の判定の
 * 状態で絞って反映する。点を採用したかどうかとは関係しない。
 */

import type { ScoringStatus } from "@/types/scoringStatus.types"

import type { ReviewedAiGradingAnswer } from "./answerReview"

/** 朱書きを入れるかを選べる、AI の判定の状態（並び＝画面の並び） */
export const ANNOTATION_TARGET_STATUSES = [
  "correct",
  "partial",
  "pending",
  "incorrect",
  "no_answer",
] as const satisfies readonly ScoringStatus[]
export type AnnotationTargetStatus = (typeof ANNOTATION_TARGET_STATUSES)[number]

/** 既定で朱書きを入れる状態。部分点だけ（正答・誤答には入れない） */
export const DEFAULT_ANNOTATION_TARGET_STATUSES: ReadonlySet<AnnotationTargetStatus> =
  new Set(["partial"])

/**
 * 朱書きを反映する答案。表示中の試行が成功していて、AI の判定が選んだ状態のいずれかで、
 * 朱書きの文があり、その試行の朱書きをまだ反映していないもの
 */
export function selectAnnotationAdoptionTargets(
  reviewedAnswers: readonly ReviewedAiGradingAnswer[],
  targetStatuses: ReadonlySet<AnnotationTargetStatus>
): ReviewedAiGradingAnswer[] {
  return reviewedAnswers.filter(({ review }) => {
    const attempt = review.displayedAttempt?.attempt
    if (!attempt || attempt.state !== "succeeded") return false
    const isTargetStatus = ANNOTATION_TARGET_STATUSES.some(
      (targetStatus) =>
        targetStatus === attempt.status && targetStatuses.has(targetStatus)
    )
    return (
      isTargetStatus &&
      attempt.annotationText.trim() !== "" &&
      attempt.adoptedDrawingAnnotationId === null
    )
  })
}
