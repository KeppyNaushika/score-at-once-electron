// import { checkForAutoFinalization } from "@/components/projects/07-score-at-once/hooks/scoring-data/utils/auto-finalization"
import type {
  CropRegionWithProjectPage,
  PageImageWithProjectStudents,
  ScoringStatus,
  QuestionScore,
} from "@/components/projects/07-score-at-once/types"
import { findQuestionScore } from "@/components/projects/07-score-at-once/types"
import { useCallback } from "react"
import { toast } from "sonner"

interface UseIndividualScoringProps {
  pageImages: PageImageWithProjectStudents[]
  cropRegions: CropRegionWithProjectPage[]
  currentStudentIndex: number
  currentCropRegionId: string | null
  currentUserId: string | null
  questionScores: QuestionScore[]
  gradingMode: "grid" | "individual"
  setCurrentStudentIndex: (index: number) => void
  setCurrentCropRegionId: (id: string | null) => void
  setQuestionScores: React.Dispatch<React.SetStateAction<QuestionScore[]>>
}

export function useIndividualScoring({
  pageImages,
  cropRegions,
  currentStudentIndex,
  currentCropRegionId,
  currentUserId,
  questionScores,
  gradingMode,
  setCurrentStudentIndex,
  setCurrentCropRegionId,
  setQuestionScores,
}: UseIndividualScoringProps) {
  const handleSetScore = useCallback(
    async (type: ScoringStatus) => {
      const currentPageImage = pageImages[currentStudentIndex]
      const currentCropRegion = cropRegions.find(
        (r) => r.id === currentCropRegionId,
      )

      if (!currentPageImage || !currentCropRegion || !currentUserId) {
        if (!currentUserId) {
          toast.warning("ユーザー情報の取得中です。しばらくお待ちください。")
        }
        return
      }

      if (!currentPageImage.studentId) {
        toast.error("学生IDが見つかりません")
        return
      }
      
      const currentScore = findQuestionScore(questionScores, currentPageImage.studentId, currentCropRegion.id)

      let newScore = 0
      // Use the actual status type from the scoring action
      let status: ScoringStatus = type

      switch (type) {
        case "unscored":
          newScore = 0
          status = "unscored"
          break
        case "correct":
          newScore = currentCropRegion.points || 0
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
            `部分点を入力してください (0-${currentCropRegion.points}):`,
            currentScore?.partialScore?.toString() || "0",
          )
          if (inputScore === null) return
          const parsedScore = parseInt(inputScore)
          if (
            isNaN(parsedScore) ||
            parsedScore < 0 ||
            parsedScore > (currentCropRegion.points || 0)
          ) {
            toast.error("無効な点数です")
            return
          }
          newScore = parsedScore
          break
        case "pending":
          newScore = currentScore?.partialScore
            ? Number(currentScore.partialScore)
            : 0
          break
      }

      // Save to database immediately
      try {
        if (currentScore?.id) {
          // Update existing score
          const updateData = {
            partialScore: newScore !== null ? newScore : undefined,
            status: status,
          }
          const result = await window.electronAPI.updateQuestionScore(
            currentScore.id,
            updateData,
          )

          if ((result as any).success || result) {
            setQuestionScores((prev) =>
              prev.map((score) =>
                score.id === currentScore.id
                  ? ({
                      ...score,
                      partialScore: newScore !== null ? newScore : null,
                      status,
                      updatedAt: new Date(
                        (result as any).score?.updatedAt ||
                          result.updatedAt ||
                          Date.now(),
                      ),
                    } as QuestionScore)
                  : score,
              ),
            )

            // 個別採点モードの場合、採点後に自動的に次の答案に移動
            if (gradingMode === "individual" && type !== "unscored") {
              setTimeout(() => {
                if (currentStudentIndex < pageImages.length - 1) {
                  setCurrentStudentIndex(currentStudentIndex + 1)
                } else {
                  // TODO: IDベースのナビゲーションを実装予定
                  // 最後の生徒の場合、次の設問の最初の生徒に移動
                  // const nextCropRegionId = findNextCropRegionId(currentCropRegionId, cropRegions)
                  // if (nextCropRegionId) {
                  //   setCurrentCropRegionId(nextCropRegionId)
                  //   setCurrentStudentIndex(0)
                  // }
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
            studentId: currentPageImage.studentId,
            cropRegionId: currentCropRegion.id,
            partialScore: newScore !== null ? newScore : undefined,
            status: status,
            scoredByUserId: currentUserId,
          }
          const result = await window.electronAPI.createQuestionScore(scoreData)

          if ((result as any).success || result.id) {
            const createdScore = (result as any).score || result
            const newQuestionScore = {
              id: createdScore.id,
              cropRegionId: currentCropRegion.id,
              studentId: currentPageImage.studentId,
              partialScore: newScore !== null ? newScore : null,
              status,
              scoredByUserId: currentUserId,
              createdAt: new Date(createdScore.createdAt || Date.now()),
              updatedAt: new Date(createdScore.updatedAt || Date.now()),
            } as QuestionScore
            
            setQuestionScores((prev) => [...prev, newQuestionScore])

            // 個別採点モードの場合、採点後に自動的に次の答案に移動
            if (gradingMode === "individual" && type !== "unscored") {
              setTimeout(() => {
                if (currentStudentIndex < pageImages.length - 1) {
                  setCurrentStudentIndex(currentStudentIndex + 1)
                } else {
                  // TODO: IDベースのナビゲーションを実装予定
                  // 最後の生徒の場合、次の設問の最初の生徒に移動
                  // const nextCropRegionId = findNextCropRegionId(currentCropRegionId, cropRegions)
                  // if (nextCropRegionId) {
                  //   setCurrentCropRegionId(nextCropRegionId)
                  //   setCurrentStudentIndex(0)
                  // }
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

        // TODO: Check for auto-finalization in collaborative mode
        // Temporarily disabled during QuestionScore array migration
        // if (status === "pending" && currentPageImage.studentId) {
        //   await checkForAutoFinalization(
        //     currentPageImage.studentId,
        //     currentCropRegion.id,
        //     currentUserId,
        //     setQuestionScores,
        //   )
        // }
      } catch (error) {
        console.error("Error in scoring:", error)
        toast.error("採点中にエラーが発生しました")
      }
    },
    [
      pageImages,
      cropRegions,
      currentStudentIndex,
      currentCropRegionId,
      currentUserId,
      questionScores,
      gradingMode,
      setCurrentStudentIndex,
      setQuestionScores,
    ],
  )

  return {
    handleSetScore,
  }
}
