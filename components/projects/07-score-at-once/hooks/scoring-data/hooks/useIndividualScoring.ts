import { useCallback } from "react"
import { toast } from "sonner"
import type { ScoringStatus } from "@/components/projects/07-score-at-once/ScoringMain/types"
import type {
  AnswerSheet,
  QuestionRegion,
  ScoringDataRecord,
} from "@/components/projects/07-score-at-once/hooks/scoring-data/types/scoring-data-types"
import { checkForAutoFinalization } from "@/components/projects/07-score-at-once/hooks/scoring-data/utils/auto-finalization"

interface UseIndividualScoringProps {
  answerSheets: AnswerSheet[]
  questionRegions: QuestionRegion[]
  currentStudentIndex: number
  currentQuestionIndex: number
  currentUserId: string | null
  scoringData: ScoringDataRecord
  gradingMode: "grid" | "individual"
  setCurrentStudentIndex: (index: number) => void
  setCurrentQuestionIndex: (index: number) => void
  setScoringData: React.Dispatch<React.SetStateAction<ScoringDataRecord>>
}

export function useIndividualScoring({
  answerSheets,
  questionRegions,
  currentStudentIndex,
  currentQuestionIndex,
  currentUserId,
  scoringData,
  gradingMode,
  setCurrentStudentIndex,
  setCurrentQuestionIndex,
  setScoringData,
}: UseIndividualScoringProps) {
  const handleSetScore = useCallback(
    async (type: ScoringStatus) => {
      const currentAnswerSheet = answerSheets[currentStudentIndex]
      const currentQuestion = questionRegions[currentQuestionIndex]

      if (!currentAnswerSheet || !currentQuestion || !currentUserId) {
        if (!currentUserId) {
          toast.warning("ユーザー情報の取得中です。しばらくお待ちください。")
        }
        return
      }

      const key = `${currentAnswerSheet.id}-${currentQuestion.id}`
      const currentScore = scoringData[key]

      let newScore = 0
      // Use the actual status type from the scoring action
      let status: ScoringStatus = type

      switch (type) {
        case "unscored":
          newScore = 0
          status = "unscored"
          break
        case "correct":
          newScore = currentQuestion.points
          break
        case "incorrect":
          newScore = 0
          break
        case "no_answer":
          newScore = 0
          break
        case "partial":
          // 部分点の場合は入力ダイアログを表示（簡易実装）
          const inputScore = prompt(
            `部分点を入力してください (0-${currentQuestion.points}):`,
            currentScore?.score?.toString() || "0",
          )
          if (inputScore === null) return
          const parsedScore = parseInt(inputScore)
          if (
            isNaN(parsedScore) ||
            parsedScore < 0 ||
            parsedScore > currentQuestion.points
          ) {
            toast.error("無効な点数です")
            return
          }
          newScore = parsedScore
          break
        case "pending":
          newScore = currentScore?.score || 0
          break
      }

      // Save to database immediately
      try {
        if (currentScore?.id) {
          // Update existing score
          const updateData = {
            partialScore: newScore !== null ? newScore : undefined,
            status: status,
            comment: currentScore.comment || "",
          }
          const result = await window.electronAPI.updateQuestionScore(
            currentScore.id,
            updateData,
            currentScore.version,
          )

          if ((result as any).success || result) {
            setScoringData((prev) => ({
              ...prev,
              [key]: {
                ...currentScore,
                score: newScore,
                status,
                version:
                  (result as any).score?.version || 0,
                updatedAt: new Date(
                  (result as any).score?.updatedAt || result.updatedAt,
                ),
              },
            }))

            // 個別採点モードの場合、採点後に自動的に次の答案に移動
            if (gradingMode === "individual" && type !== "unscored") {
              setTimeout(() => {
                if (currentStudentIndex < answerSheets.length - 1) {
                  setCurrentStudentIndex(currentStudentIndex + 1)
                } else {
                  // 最後の生徒の場合、次の設問の最初の生徒に移動
                  if (currentQuestionIndex < questionRegions.length - 1) {
                    setCurrentQuestionIndex(currentQuestionIndex + 1)
                    setCurrentStudentIndex(0)
                  }
                }
              }, 300) // 300ms後に移動（採点状態を確認する時間を与える）
            }
          } else {
            console.error("Failed to update score:", (result as any).error)
            toast.error("採点の保存に失敗しました: " + (result as any).error)
          }
        } else {
          // Create new score
          const scoreData = {
            studentId: currentAnswerSheet.studentId,
            cropRegionId: currentQuestion.id,
            partialScore: newScore !== null ? newScore : undefined,
            status: status,
            scoredByUserId: currentUserId,
          }
          const result = await window.electronAPI.createQuestionScore(scoreData)

          if ((result as any).success || result.id) {
            setScoringData((prev) => ({
              ...prev,
              [key]: {
                id: (result as any).score?.id || result.id,
                questionId: currentQuestion.id,
                score: newScore,
                maxScore: currentQuestion.points,
                status,
                comment: "",
                scoredByUserId: currentUserId,
                version:
                  (result as any).score?.version || 0,
                updatedAt: new Date(
                  (result as any).score?.updatedAt || result.updatedAt,
                ),
              },
            }))

            // 個別採点モードの場合、採点後に自動的に次の答案に移動
            if (gradingMode === "individual" && type !== "unscored") {
              setTimeout(() => {
                if (currentStudentIndex < answerSheets.length - 1) {
                  setCurrentStudentIndex(currentStudentIndex + 1)
                } else {
                  // 最後の生徒の場合、次の設問の最初の生徒に移動
                  if (currentQuestionIndex < questionRegions.length - 1) {
                    setCurrentQuestionIndex(currentQuestionIndex + 1)
                    setCurrentStudentIndex(0)
                  }
                }
              }, 300) // 300ms後に移動（採点状態を確認する時間を与える）
            }
          } else {
            console.error("Failed to create score:", (result as any).error)
            toast.error(
              "採点の保存に失敗しました: " +
                ((result as any).error || "不明なエラー"),
            )
          }
        }

        // Check for auto-finalization in collaborative mode
        if (status === "proposed") {
          await checkForAutoFinalization(
            currentAnswerSheet.studentId,
            currentQuestion.id,
            currentUserId,
            setScoringData,
          )
        }
      } catch (error) {
        console.error("Error in scoring:", error)
        toast.error("採点中にエラーが発生しました")
      }
    },
    [
      answerSheets,
      questionRegions,
      currentStudentIndex,
      currentQuestionIndex,
      currentUserId,
      scoringData,
      gradingMode,
      setCurrentStudentIndex,
      setCurrentQuestionIndex,
      setScoringData,
    ],
  )

  return {
    handleSetScore,
  }
}