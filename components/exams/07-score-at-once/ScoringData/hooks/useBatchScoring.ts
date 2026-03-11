// import { checkForAutoFinalization } from "@/components/exams/07-score-at-once/hooks/scoring-data/utils/auto-finalization"
import { useCallback, useRef } from "react"
import { toast } from "sonner"

import type {
  CropRegionWithExamPage,
  QuestionScore,
  ScoringStatus,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"
import { findQuestionScore } from "@/components/exams/07-score-at-once/types"

interface UseBatchScoringProps {
  studentAnswerImages: StudentAnswerImageWithExamStudents[]
  cropRegions: CropRegionWithExamPage[]
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
  // questionScoresの最新値をrefで保持（useCallbackの依存配列から除去するため）
  const questionScoresRef = useRef(questionScores)
  questionScoresRef.current = questionScores

  const rollbackUpdate = useCallback(
    async (scoreId: string) => {
      try {
        const result = await window.electronAPI.getQuestionScore(scoreId)
        if (result.success && result.score) {
          const dbScore = result.score
          setQuestionScores((prev) =>
            prev.map((s) =>
              s.id === scoreId
                ? {
                    ...s,
                    partialScore: dbScore.partialScore,
                    status: dbScore.status,
                    updatedAt: new Date(dbScore.updatedAt),
                  }
                : s
            )
          )
        }
      } catch {
        // ロールバック自体が失敗 → Shift+Rでの再読み込みに委ねる
      }
      toast.error("採点の保存に失敗しました")
    },
    [setQuestionScores]
  )

  const rollbackCreate = useCallback(
    (tempId: string) => {
      setQuestionScores((prev) => prev.filter((s) => s.id !== tempId))
      toast.error("採点の保存に失敗しました")
    },
    [setQuestionScores]
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
        const defaultUserId = "default-user-id"
        setCurrentUserId(defaultUserId)
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

        if (!studentAnswerImage.studentId) continue

        // refから最新のquestionScoresを取得
        const currentScore = findQuestionScore(
          questionScoresRef.current,
          studentAnswerImage.studentId,
          currentCropRegion.id
        )

        let newScore: number | null = 0
        let scoringStatus: ScoringStatus = status

        switch (status) {
          case "unscored":
            newScore = null
            scoringStatus = "unscored"
            break
          case "correct":
            newScore = null
            break
          case "incorrect":
          case "no_answer":
            newScore = null
            break
          case "partial":
            if (inputPartialScore !== null && inputPartialScore !== undefined) {
              newScore = inputPartialScore
            } else {
              newScore =
                currentScore?.partialScore !== undefined &&
                currentScore?.partialScore !== null
                  ? Number(currentScore.partialScore)
                  : null
            }
            break
          case "pending":
            if (inputPartialScore !== null && inputPartialScore !== undefined) {
              newScore = inputPartialScore
            } else {
              newScore =
                currentScore?.partialScore !== undefined &&
                currentScore?.partialScore !== null
                  ? Number(currentScore.partialScore)
                  : null
            }
            break
        }

        if (currentScore?.id) {
          // Update: 楽観的にUI更新
          const scoreId = currentScore.id
          const optimisticPartialScore =
            newScore !== null
              ? (newScore as unknown as QuestionScore["partialScore"])
              : null
          setQuestionScores((prev) =>
            prev.map((s) =>
              s.id === scoreId
                ? {
                    ...s,
                    partialScore: optimisticPartialScore,
                    status: scoringStatus,
                  }
                : s
            )
          )
          // refも同期してループ内の次の反復で最新値が見えるようにする
          questionScoresRef.current = questionScoresRef.current.map((s) =>
            s.id === scoreId
              ? {
                  ...s,
                  partialScore: optimisticPartialScore,
                  status: scoringStatus,
                }
              : s
          )

          // DB保存をfire-and-forget
          const updateData = {
            partialScore: newScore !== null ? newScore : undefined,
            status: scoringStatus,
          }
          window.electronAPI
            .updateQuestionScore(scoreId, updateData)
            .then((result) => {
              if (result.success && result.score) {
                // 成功時: updatedAtを反映
                const updatedScore = result.score
                setQuestionScores((prev) =>
                  prev.map((s) =>
                    s.id === scoreId
                      ? {
                          ...s,
                          updatedAt: new Date(updatedScore.updatedAt),
                        }
                      : s
                  )
                )
              } else {
                // DB保存失敗 → ロールバック
                rollbackUpdate(scoreId)
              }
            })
            .catch(() => {
              rollbackUpdate(scoreId)
            })
        } else {
          // Create: 仮IDで楽観的にUI追加
          const tempId = crypto.randomUUID()
          const now = new Date()
          const optimisticScore: QuestionScore = {
            id: tempId,
            cropRegionId: currentCropRegion.id,
            studentId: studentAnswerImage.studentId,
            partialScore:
              newScore !== null
                ? (newScore as unknown as QuestionScore["partialScore"])
                : null,
            status: scoringStatus,
            userId: effectiveUserId,
            createdAt: now,
            updatedAt: now,
          }
          setQuestionScores((prev) => [...prev, optimisticScore])
          // refも同期してループ内の次の反復で最新値が見えるようにする
          questionScoresRef.current = [
            ...questionScoresRef.current,
            optimisticScore,
          ]

          // DB保存をfire-and-forget
          const scoreData = {
            studentId: studentAnswerImage.studentId,
            cropRegionId: currentCropRegion.id,
            partialScore: newScore !== null ? newScore : undefined,
            status: scoringStatus,
            userId: effectiveUserId,
          }
          window.electronAPI
            .createQuestionScore(scoreData)
            .then((result) => {
              if (result.success && result.score) {
                // 成功時: 仮IDを本物のIDに差し替え
                const createdScore = result.score
                setQuestionScores((prev) =>
                  prev.map((s) =>
                    s.id === tempId
                      ? {
                          ...s,
                          id: createdScore.id,
                          createdAt: new Date(createdScore.createdAt),
                          updatedAt: new Date(createdScore.updatedAt),
                        }
                      : s
                  )
                )
              } else {
                rollbackCreate(tempId)
              }
            })
            .catch(() => {
              rollbackCreate(tempId)
            })
        }
      }
    },
    [
      currentUserId,
      cropRegions,
      setCurrentUserId,
      currentCropRegionId,
      studentAnswerImages,
      setQuestionScores,
      rollbackUpdate,
      rollbackCreate,
    ]
  )

  return {
    handleBatchScore,
  }
}
