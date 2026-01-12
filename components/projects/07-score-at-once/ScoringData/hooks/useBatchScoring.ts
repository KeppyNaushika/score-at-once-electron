// import { checkForAutoFinalization } from "@/components/projects/07-score-at-once/hooks/scoring-data/utils/auto-finalization"
import { useCallback } from "react"
import { toast } from "sonner"

import type {
  CropRegionWithProjectPage,
  QuestionScore,
  ScoringStatus,
  StudentAnswerImageWithProjectStudents,
} from "@/components/projects/07-score-at-once/types"
import { findQuestionScore } from "@/components/projects/07-score-at-once/types"

interface UseBatchScoringProps {
  studentAnswerImages: StudentAnswerImageWithProjectStudents[]
  cropRegions: CropRegionWithProjectPage[]
  currentCropRegionId: string | null
  currentUserId: string | null
  setCurrentUserId: (userId: string) => void
  questionScores: QuestionScore[]
  setQuestionScores: React.Dispatch<React.SetStateAction<QuestionScore[]>>
}

export function useBatchScoring({
  studentAnswerImages,
  cropRegions,
  currentCropRegionId,
  currentUserId,
  setCurrentUserId,
  questionScores,
  setQuestionScores,
}: UseBatchScoringProps) {
  const handleBatchScore = useCallback(
    async (
      statusOrAnswerIds: ScoringStatus | string | string[],
      statusOrPartialScore?: ScoringStatus | number | null,
      partialScore?: number | null,
      selectedAnswers: Set<string> = new Set()
    ) => {
      // 引数の解析
      let answerIds: string | string[]
      let status: ScoringStatus
      let inputPartialScore: number | null = null

      if (
        typeof statusOrAnswerIds === "string" &&
        !Array.isArray(statusOrAnswerIds) &&
        [
          "unscored",
          "correct",
          "incorrect",
          "partial",
          "pending",
          "no_answer",
        ].includes(statusOrAnswerIds)
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
        inputPartialScore =
          partialScore !== undefined && partialScore !== null
            ? partialScore
            : null
      }

      let effectiveUserId: string
      if (!currentUserId) {
        console.warn("No current user ID available, using default")
        // デフォルトユーザーIDを設定（実際の実装では適切なユーザー管理が必要）
        const defaultUserId = "default-user-id"
        setCurrentUserId(defaultUserId)

        // 一時的にdefaultUserIdを使用
        effectiveUserId = defaultUserId
      } else {
        effectiveUserId = currentUserId
      }

      const ids = Array.isArray(answerIds) ? answerIds : [answerIds]
      const currentCropRegion = cropRegions.find(
        (r) => r.id === currentCropRegionId
      )

      if (!currentCropRegion) return

      for (const answerId of ids) {
        const studentAnswerImage = studentAnswerImages.find(
          (image) => image.id === answerId
        )
        if (!studentAnswerImage) continue

        if (!studentAnswerImage.studentId) continue // studentIdがnullの場合はスキップ

        const currentScore = findQuestionScore(
          questionScores,
          studentAnswerImage.studentId,
          currentCropRegion.id
        )

        let newScore: number | null = 0
        // Use the actual status type from the scoring action
        let scoringStatus: ScoringStatus = status

        switch (status) {
          case "unscored":
            newScore = null // partialScoreはnullに設定
            scoringStatus = "unscored"
            break
          case "correct":
            newScore = null // partialScoreはnullに設定
            break
          case "incorrect":
          case "no_answer":
            newScore = null // partialScoreはnullに設定
            break
          case "partial":
            // モーダルで入力された場合は具体的な値、モーダル無しの場合は現在の値を維持（ステータスのみ変更）
            if (inputPartialScore !== null && inputPartialScore !== undefined) {
              newScore = inputPartialScore
            } else {
              // nullの場合は現在のpartialScoreを維持（ステータスのみ変更）
              newScore =
                currentScore?.partialScore !== undefined &&
                currentScore?.partialScore !== null
                  ? Number(currentScore.partialScore)
                  : null
            }
            break
          case "pending":
            // モーダルで入力された場合は具体的な値、モーダル無しの場合は現在の値を維持（ステータスのみ変更）
            if (inputPartialScore !== null && inputPartialScore !== undefined) {
              newScore = inputPartialScore
            } else {
              // nullの場合は現在のpartialScoreを維持（ステータスのみ変更）
              newScore =
                currentScore?.partialScore !== undefined &&
                currentScore?.partialScore !== null
                  ? Number(currentScore.partialScore)
                  : null
            }
            break
        }

        // Save to database
        try {
          if (currentScore?.id) {
            // Update existing score
            const updateData = {
              partialScore: newScore !== null ? newScore : undefined,
              status: scoringStatus,
            }
            const result = await window.electronAPI.updateQuestionScore(
              currentScore.id,
              updateData
            )

            if (result.success && result.score) {
              const updatedScore = result.score
              setQuestionScores((prev) =>
                prev.map((score) =>
                  score.id === currentScore.id
                    ? {
                        ...score,
                        partialScore: updatedScore.partialScore,
                        status: scoringStatus,
                        updatedAt: new Date(updatedScore.updatedAt),
                      }
                    : score
                )
              )
            }
          } else {
            // Create new score
            const scoreData = {
              studentId: studentAnswerImage.studentId,
              cropRegionId: currentCropRegion.id,
              partialScore: newScore !== null ? newScore : undefined,
              status: scoringStatus,
              userId: effectiveUserId,
            }
            const result =
              await window.electronAPI.createQuestionScore(scoreData)

            if (result.success && result.score) {
              const createdScore = result.score
              const newQuestionScore: QuestionScore = {
                id: createdScore.id,
                cropRegionId: createdScore.cropRegionId,
                studentId: createdScore.studentId,
                partialScore: createdScore.partialScore,
                status: createdScore.status,
                userId: createdScore.userId,
                createdAt: createdScore.createdAt,
                updatedAt: createdScore.updatedAt,
              }

              setQuestionScores((prev) => [...prev, newQuestionScore])
            }
          }

          // TODO: Check for auto-finalization in collaborative mode
          // Temporarily disabled during QuestionScore array migration
          // if (scoringStatus === "pending" && studentAnswerImage.studentId) {
          //   await checkForAutoFinalization(
          //     studentAnswerImage.studentId,
          //     currentCropRegion.id,
          //     currentUserId,
          //     setQuestionScores,
          //   )
          // }

          // TODO: Add subtotal score recalculation here
          // After individual question scoring, we should:
          // 1. Identify all subtotal regions that depend on this question
          // 2. Recalculate those subtotal scores
          // 3. Save the updated subtotal scores to database
          // 4. Update the local scoring data state
        } catch (error) {
          console.error("Error in batch scoring:", error)
          toast.error(
            `採点中にエラーが発生しました: ${studentAnswerImage.student?.lastName || "不明な生徒"}`
          )
        }
      }
    },
    [
      currentUserId,
      cropRegions,
      setCurrentUserId,
      currentCropRegionId,
      studentAnswerImages,
      questionScores,
      setQuestionScores,
    ]
  )

  return {
    handleBatchScore,
  }
}
