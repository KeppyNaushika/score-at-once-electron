import { useMutation } from "@tanstack/react-query"
import { useCallback } from "react"
import { toast } from "sonner"

import type {
  CropRegionWithExamPage,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"
import { findQuestionScore } from "@/components/exams/07-score-at-once/types"
import {
  createQuestionScoreMutation,
  updateQuestionScoreMutation,
} from "@/queries/scoring"
import type { SerializedQuestionScore } from "@/types/prismaExtensions"
import type { ScoringStatus } from "@/types/scoringStatus.types"

/** 採点状態の綴り。旧い呼び出し形式（第1引数が状態）かどうかの判定に使う */
const SCORING_STATUSES: readonly string[] = [
  "unscored",
  "correct",
  "incorrect",
  "partial",
  "pending",
  "no_answer",
]

interface UseBatchScoringProps {
  examId: string
  studentAnswerImages: StudentAnswerImageWithExamStudents[]
  cropRegions: CropRegionWithExamPage[]
  currentCropRegionId: string | null
  currentUserId: string | null
  questionScores: SerializedQuestionScore[]
}

/**
 * 選択された答案をまとめて採点する。
 *
 * 楽観更新は持たない。書き込みは `scope` で直列になっていて、`create` は
 * main 側が「生徒×設問×採点者」で引き当ててから作る（＝冪等）ので、
 * 取り直しが届く前に同じマスをもう一度打っても行は増えない。
 */
export function useBatchScoring({
  examId,
  studentAnswerImages,
  cropRegions,
  currentCropRegionId,
  currentUserId,
  questionScores,
}: UseBatchScoringProps) {
  const { mutateAsync: createQuestionScore } = useMutation(
    createQuestionScoreMutation(examId)
  )
  const { mutateAsync: updateQuestionScore } = useMutation(
    updateQuestionScoreMutation(examId)
  )

  const handleBatchScore = useCallback(
    (
      statusOrAnswerIds: ScoringStatus | string | string[],
      statusOrPartialScore?: ScoringStatus | number | null,
      partialScore?: number | null,
      selectedAnswers: Set<string> = new Set()
    ) => {
      // 引数の解析
      let answerIds: string | string[]
      let status: ScoringStatus
      let inputPartialScore: number | null

      if (
        typeof statusOrAnswerIds === "string" &&
        SCORING_STATUSES.includes(statusOrAnswerIds)
      ) {
        // 新形式: handleBatchScore(status, partialScore?)
        status = statusOrAnswerIds as ScoringStatus
        answerIds = Array.from(selectedAnswers)
        inputPartialScore =
          typeof statusOrPartialScore === "number" ? statusOrPartialScore : null
      } else {
        // 旧形式: handleBatchScore(answerIds, status)
        answerIds = statusOrAnswerIds as string | string[]
        status = statusOrPartialScore as ScoringStatus
        inputPartialScore = partialScore ?? null
      }

      // 採点は利用者ごとに別々に保存する。操作者が分からないまま書くと、
      // 存在しない利用者の採点として残り、本人の画面には戻ってこない
      if (!currentUserId) {
        toast.error("採点できません", {
          description: "ログインしている利用者が確認できませんでした。",
        })
        return
      }

      const ids = Array.isArray(answerIds) ? answerIds : [answerIds]
      const currentCropRegion = cropRegions.find(
        (cropRegion) => cropRegion.id === currentCropRegionId
      )
      if (!currentCropRegion) return

      for (const answerId of ids) {
        const studentAnswerImage = studentAnswerImages.find(
          (image) => image.id === answerId
        )
        if (!studentAnswerImage?.examStudentId) continue

        const currentScore = findQuestionScore(
          questionScores,
          studentAnswerImage.examStudentId,
          currentCropRegion.id
        )

        // 部分点は入力があればそれ、無ければ今の値を引き継ぐ。それ以外の
        // 状態（正解・不正解・無解答・未採点）は部分点を持たない
        const nextPartialScore =
          status === "partial" || status === "pending"
            ? (inputPartialScore ?? currentScore?.partialScore ?? null)
            : null

        if (currentScore?.id) {
          updateQuestionScore({
            questionScoreId: currentScore.id,
            data: {
              partialScore: nextPartialScore ?? undefined,
              status,
            },
          })
            .then((result) => {
              if (result.status === "target-deleted") {
                // 他の教員が答案ごと削除した。失敗ではないので共通の
                // 失敗トーストは出ない。ここで理由を伝える
                toast.error(
                  "この答案は削除されたため採点を保存できません（Shift+R で再読み込みしてください）"
                )
              }
            })
            .catch(() => {
              // 失敗の通知と取り直しは MutationCache の後始末が担う
            })
        } else {
          createQuestionScore({
            examStudentId: studentAnswerImage.examStudentId,
            cropRegionId: currentCropRegion.id,
            partialScore: nextPartialScore ?? undefined,
            status,
            userId: currentUserId,
          }).catch(() => {
            // 同上
          })
        }
      }
    },
    [
      createQuestionScore,
      cropRegions,
      currentCropRegionId,
      currentUserId,
      questionScores,
      studentAnswerImages,
      updateQuestionScore,
    ]
  )

  return { handleBatchScore }
}
