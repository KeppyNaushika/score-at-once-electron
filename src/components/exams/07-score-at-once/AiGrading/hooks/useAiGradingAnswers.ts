import { useMemo } from "react"

import type { WhitenessByAnswerId } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useAnswerWhiteness"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { QuestionScoreRow } from "@/queries/scoring"
import type { StudentAnswerImageWithExamPageAndStudent } from "@/types/prismaExtensions"

import type { AiGradingAnswer, AiGradingRunRow } from "../types"
import { groupAttemptsByExamStudent } from "../utils/attemptSelection"
import { findOwnQuestionScore } from "../utils/scoreComparison"

interface UseAiGradingAnswersOptions {
  cropRegion: QuestionAnswerRegionRow
  currentUserId: string
  /** 試験の答案すべて（設問のページのものだけを使う） */
  studentAnswerImages: readonly StudentAnswerImageWithExamPageAndStudent[]
  /** 設問の採点行（誰の分も） */
  questionScores: readonly QuestionScoreRow[]
  /** 設問の自分の実行（試行付き） */
  runs: readonly AiGradingRunRow[]
  /** 答案画像 id → 設問 id → 白さ（一覧表示と同じ測定）。まだ届いていなければ空 */
  whitenessByAnswerImageId: WhitenessByAnswerId
}

/**
 * 設問の答案を、自分の採点・自分の試行・白さと束ねる（表示順）。
 *
 * 行は射影せずそのまま持つ。束ねるだけなので、表示の値は描くときに求める。
 */
export function useAiGradingAnswers({
  cropRegion,
  currentUserId,
  studentAnswerImages,
  questionScores,
  runs,
  whitenessByAnswerImageId,
}: UseAiGradingAnswersOptions): AiGradingAnswer[] {
  return useMemo(() => {
    const attemptsByExamStudentId = groupAttemptsByExamStudent(runs)
    return studentAnswerImages
      .filter(
        (studentAnswerImage) =>
          studentAnswerImage.examPageId === cropRegion.examPageId
      )
      .toSorted(
        // 表示順の無い受験者は末尾へ（一覧・個別表示と同じ扱い）
        (answerImageA, answerImageB) =>
          (answerImageA.examStudent.customOrder ?? Number.MAX_SAFE_INTEGER) -
          (answerImageB.examStudent.customOrder ?? Number.MAX_SAFE_INTEGER)
      )
      .map((studentAnswerImage) => ({
        studentAnswerImage,
        questionScore: findOwnQuestionScore(
          questionScores,
          cropRegion.id,
          studentAnswerImage.examStudentId,
          currentUserId
        ),
        attempts:
          attemptsByExamStudentId.get(studentAnswerImage.examStudentId) ?? [],
        whiteness:
          whitenessByAnswerImageId
            .get(studentAnswerImage.id)
            ?.get(cropRegion.id) ?? null,
      }))
  }, [
    cropRegion.examPageId,
    cropRegion.id,
    currentUserId,
    studentAnswerImages,
    questionScores,
    runs,
    whitenessByAnswerImageId,
  ])
}
