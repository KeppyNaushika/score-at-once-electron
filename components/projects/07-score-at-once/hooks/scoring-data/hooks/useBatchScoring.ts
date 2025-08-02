import { checkForAutoFinalization } from "@/components/projects/07-score-at-once/hooks/scoring-data/utils/auto-finalization"
import type {
  CropRegionWithProjectPage,
  PageImageWithProjectStudents,
  ScoringDataRecord,
  ScoringStatus,
} from "@/components/projects/07-score-at-once/types"
import { useCallback } from "react"
import { toast } from "sonner"

interface UseBatchScoringProps {
  pageImages: PageImageWithProjectStudents[]
  cropRegions: CropRegionWithProjectPage[]
  currentCropRegionId: string | null
  currentUserId: string | null
  setCurrentUserId: (userId: string) => void
  scoringData: ScoringDataRecord
  setScoringData: React.Dispatch<React.SetStateAction<ScoringDataRecord>>
}

export function useBatchScoring({
  pageImages,
  cropRegions,
  currentCropRegionId,
  currentUserId,
  setCurrentUserId,
  scoringData,
  setScoringData,
}: UseBatchScoringProps) {
  const handleBatchScore = useCallback(
    async (
      statusOrAnswerIds: ScoringStatus | string | string[],
      statusOrPartialScore?: ScoringStatus | number | null,
      partialScore?: number | null,
      selectedAnswers: Set<string> = new Set(),
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
        inputPartialScore = partialScore || null
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
        (r) => r.id === currentCropRegionId,
      )

      if (!currentCropRegion) return

      for (const answerId of ids) {
        const pageImage = pageImages.find((image) => image.id === answerId)
        if (!pageImage) continue

        const key = `${pageImage.student?.studentId || ""}-${currentCropRegion.id}`
        const currentScore = scoringData[key]

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
              newScore = currentScore?.partialScore
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
              newScore = currentScore?.partialScore
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
              updateData,
            )

            if ((result as any).success || result) {
              setScoringData((prev) => ({
                ...prev,
                [key]: {
                  ...currentScore,
                  partialScore: newScore !== null ? newScore : null,
                  status: scoringStatus,
                  updatedAt: new Date(
                    (result as any).score?.updatedAt ||
                      result.updatedAt ||
                      Date.now(),
                  ),
                },
              }))
            }
          } else {
            // Create new score
            const scoreData = {
              studentId: pageImage.studentId,
              cropRegionId: currentCropRegion.id,
              partialScore: newScore !== null ? newScore : undefined,
              status: scoringStatus,
              scoredByUserId: effectiveUserId,
            }
            const result =
              await window.electronAPI.createQuestionScore(scoreData)

            if ((result as any).success || result.id) {
              const createdScore = (result as any).score || result
              setScoringData((prev) => ({
                ...prev,
                [key]: {
                  id: createdScore.id,
                  cropRegionId: currentCropRegion.id,
                  studentId: pageImage.studentId,
                  partialScore: newScore !== null ? newScore : null,
                  status: scoringStatus,
                  scoredByUserId: effectiveUserId,
                  createdAt: new Date(createdScore.createdAt || Date.now()),
                  updatedAt: new Date(createdScore.updatedAt || Date.now()),
                },
              }))
            }
          }

          // Check for auto-finalization in collaborative mode
          if (scoringStatus === "pending" && pageImage.studentId) {
            await checkForAutoFinalization(
              pageImage.studentId,
              currentCropRegion.id,
              currentUserId,
              setScoringData,
            )
          }

          // TODO: Add subtotal score recalculation here
          // After individual question scoring, we should:
          // 1. Identify all subtotal regions that depend on this question
          // 2. Recalculate those subtotal scores
          // 3. Save the updated subtotal scores to database
          // 4. Update the local scoring data state
        } catch (error) {
          console.error("Error in batch scoring:", error)
          toast.error(
            `採点中にエラーが発生しました: ${pageImage.student?.lastName || "不明な生徒"}`,
          )
        }
      }
    },
    [
      pageImages,
      cropRegions,
      currentCropRegionId,
      currentUserId,
      setCurrentUserId,
      scoringData,
      setScoringData,
    ],
  )

  return {
    handleBatchScore,
  }
}
