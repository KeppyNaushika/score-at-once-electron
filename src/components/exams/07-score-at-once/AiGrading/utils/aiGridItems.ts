/**
 * AI採点モードの一覧のマス（一覧表示と同じ部品に渡す形）。
 */

import type { MasterGridItem } from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { toScoringStatus } from "@/types/scoringStatus.types"

import type { AiGridItem } from "../types"
import { answerImageUrl, studentDisplayName } from "./answerDisplay"
import type { ReviewedAiGradingAnswer } from "./answerReview"

/** 表示順の無い受験者を末尾へ送るための値（一覧表示と同じ） */
const NO_CUSTOM_ORDER = 999999

/** 答案1件のマス。色と点は自分の採点（一覧表示と同じ） */
export function toAiGridItem(
  reviewedAnswer: ReviewedAiGradingAnswer,
  cropRegion: QuestionAnswerRegionRow
): AiGridItem {
  const { studentAnswerImage, questionScore } = reviewedAnswer.answer
  return {
    id: studentAnswerImage.examStudentId,
    examStudentId: studentAnswerImage.examStudentId,
    studentName: studentDisplayName(studentAnswerImage),
    imageUrl: answerImageUrl(studentAnswerImage),
    currentScore: questionScore?.partialScore ?? undefined,
    maxScore: cropRegion.points ?? 0,
    status: toScoringStatus(questionScore?.status),
    questionRegion: cropRegion,
    customOrder: studentAnswerImage.examStudent.customOrder ?? NO_CUSTOM_ORDER,
    reviewedAnswer,
  }
}

/**
 * マスの答案画像の id（一覧表示の一括採点が受け取る形）。マスの id は examStudentId で、
 * 一覧表示の答案の id（StudentAnswerImage.id）とは違う
 */
export function toStudentAnswerImageIds(
  gridItems: readonly AiGridItem[]
): string[] {
  return gridItems.map(
    (gridItem) => gridItem.reviewedAnswer.answer.studentAnswerImage.id
  )
}

/** 先頭に置く模範解答のマス（一覧表示の `useQuestionScoringData` と同じ形） */
export function toMasterGridItem(
  cropRegion: QuestionAnswerRegionRow
): MasterGridItem {
  const masterImagePath = cropRegion.examPage.imagePath
  return {
    id: `master-${cropRegion.id}`,
    examStudentId: "MASTER",
    studentName: "模範解答",
    imageUrl: masterImagePath ? `appimg:///${masterImagePath}` : "",
    maxScore: cropRegion.points || 0,
    status: "master",
    questionRegion: cropRegion,
    customOrder: -1,
    isMaster: true,
  }
}
