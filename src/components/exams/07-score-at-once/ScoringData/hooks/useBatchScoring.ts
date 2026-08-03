// import { checkForAutoFinalization } from "@/components/exams/07-score-at-once/hooks/scoring-data/utils/auto-finalization"
import { useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"

import type {
  CropRegionWithExamPage,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"
import { findQuestionScore } from "@/components/exams/07-score-at-once/types"
import type { SerializedQuestionScore } from "@/types/prismaExtensions"
import type { ScoringStatus } from "@/types/scoringStatus.types"

interface UseBatchScoringProps {
  studentAnswerImages: StudentAnswerImageWithExamStudents[]
  cropRegions: CropRegionWithExamPage[]
  currentCropRegionId: string | null
  currentUserId: string | null
  setCurrentUserId: (userId: string) => void
  questionScores: SerializedQuestionScore[]
  setQuestionScores: React.Dispatch<
    React.SetStateAction<SerializedQuestionScore[]>
  >
}

/** 選択された答案に対する一括採点（楽観的UI更新+DB保存）を実行するフック */
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
  useEffect(() => {
    questionScoresRef.current = questionScores
  })

  /** 採点行を画面状態から取り除く（ref も同期してループ中の次反復に反映させる） */
  const removeScoreFromState = useCallback(
    (scoreId: string) => {
      setQuestionScores((prev) =>
        prev.filter((questionScore) => questionScore.id !== scoreId)
      )
      questionScoresRef.current = questionScoresRef.current.filter(
        (questionScore) => questionScore.id !== scoreId
      )
    },
    [setQuestionScores]
  )

  /** 楽観更新を DB の実値へ戻す。行ごと消えていた場合は画面からも取り除く。 */
  const rollbackUpdate = useCallback(
    async (scoreId: string) => {
      try {
        const result = await window.electronAPI.getQuestionScore(scoreId)
        if (result.success && result.score) {
          const dbScore = result.score
          setQuestionScores((prev) =>
            prev.map((questionScore) =>
              questionScore.id === scoreId
                ? {
                    ...questionScore,
                    partialScore: dbScore.partialScore,
                    status: dbScore.status,
                    updatedAt: dbScore.updatedAt,
                  }
                : questionScore
            )
          )
          toast.error("採点の保存に失敗しました")
          return
        }

        // DB に無い＝他の教員が答案ごと削除した。楽観更新を残すと「保存済み」に
        // 見えてしまうので画面からも消し、原因が分かる文言を出す。
        removeScoreFromState(scoreId)
        toast.error(
          "この答案は削除されたため採点を保存できません（Shift+R で再読み込みしてください）"
        )
      } catch {
        // ロールバック自体が失敗 → Shift+Rでの再読み込みに委ねる
        toast.error("採点の保存に失敗しました")
      }
    },
    [removeScoreFromState, setQuestionScores]
  )

  const rollbackCreate = useCallback(
    (tempId: string) => {
      setQuestionScores((prev) =>
        prev.filter((questionScore) => questionScore.id !== tempId)
      )
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
      let inputPartialScore: number | null

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
        (cropRegion) => cropRegion.id === currentCropRegionId
      )

      if (!currentCropRegion) return

      for (const answerId of ids) {
        const studentAnswerImage = studentAnswerImages.find(
          (image) => image.id === answerId
        )
        if (!studentAnswerImage) continue

        if (!studentAnswerImage.examStudentId) continue

        // refから最新のquestionScoresを取得
        const currentScore = findQuestionScore(
          questionScoresRef.current,
          studentAnswerImage.examStudentId,
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
              newScore = currentScore?.partialScore ?? null
            }
            break
          case "pending":
            if (inputPartialScore !== null && inputPartialScore !== undefined) {
              newScore = inputPartialScore
            } else {
              newScore = currentScore?.partialScore ?? null
            }
            break
        }

        if (currentScore?.id) {
          // Update: 楽観的にUI更新
          const scoreId = currentScore.id
          const optimisticPartialScore = newScore
          setQuestionScores((prev) =>
            prev.map((questionScore) =>
              questionScore.id === scoreId
                ? {
                    ...questionScore,
                    partialScore: optimisticPartialScore,
                    status: scoringStatus,
                  }
                : questionScore
            )
          )
          // refも同期してループ内の次の反復で最新値が見えるようにする
          questionScoresRef.current = questionScoresRef.current.map(
            (questionScore) =>
              questionScore.id === scoreId
                ? {
                    ...questionScore,
                    partialScore: optimisticPartialScore,
                    status: scoringStatus,
                  }
                : questionScore
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
                  prev.map((questionScore) =>
                    questionScore.id === scoreId
                      ? {
                          ...questionScore,
                          updatedAt: updatedScore.updatedAt,
                        }
                      : questionScore
                  )
                )
              } else if (result.reason === "target-deleted") {
                // 他の教員が答案ごと削除した。再照会しても無いので即座に取り除く。
                removeScoreFromState(scoreId)
                toast.error(
                  "この答案は削除されたため採点を保存できません（Shift+R で再読み込みしてください）"
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
          const optimisticScore: SerializedQuestionScore = {
            id: tempId,
            cropRegionId: currentCropRegion.id,
            examStudentId: studentAnswerImage.examStudentId,
            partialScore: newScore,
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
            examStudentId: studentAnswerImage.examStudentId,
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
                  prev.map((questionScore) =>
                    questionScore.id === tempId
                      ? {
                          ...questionScore,
                          id: createdScore.id,
                          createdAt: createdScore.createdAt,
                          updatedAt: createdScore.updatedAt,
                        }
                      : questionScore
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
      removeScoreFromState,
      rollbackUpdate,
      rollbackCreate,
    ]
  )

  return {
    handleBatchScore,
  }
}
