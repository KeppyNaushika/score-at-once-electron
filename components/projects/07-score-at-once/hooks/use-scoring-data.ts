import { useCallback, useState } from "react"
import { toast } from "sonner"
import type {
  AnswerSheet,
  QuestionRegion,
  ScoringData,
  ScoringStatus,
} from "../types"

interface UseScoringDataProps {
  projectId: string
  currentUserId: string | null
  setCurrentUserId: (userId: string) => void
  gradingMode: "grid" | "individual"
  currentStudentIndex: number
  setCurrentStudentIndex: (index: number) => void
  currentQuestionIndex: number
  setCurrentQuestionIndex: (index: number) => void
  answerSheets: AnswerSheet[]
  questionRegions: QuestionRegion[]
}

export function useScoringData({
  projectId,
  currentUserId,
  setCurrentUserId,
  gradingMode,
  currentStudentIndex,
  setCurrentStudentIndex,
  currentQuestionIndex,
  setCurrentQuestionIndex,
  answerSheets,
  questionRegions,
}: UseScoringDataProps) {
  const [scoringData, setScoringData] = useState<Record<string, ScoringData>>(
    {},
  )

  // 既存の採点データを読み込む関数
  const loadExistingScoringData = useCallback(
    async (projectId: string): Promise<Record<string, ScoringData>> => {
      try {
        const result =
          await window.electronAPI.getQuestionScoresForProject(projectId)

        // Handle both direct array and { success, scores } format
        let scores
        if (Array.isArray(result)) {
          scores = result
        } else if (result?.success && Array.isArray(result.scores)) {
          scores = result.scores
        } else {
          return {}
        }

        const scoringData: Record<string, ScoringData> = {}
        scores.forEach((score: any) => {
          const key = `${score.answerSheetId}-${score.layoutRegionId}`
          scoringData[key] = {
            id: score.id,
            questionId: score.layoutRegionId,
            score: score.partialScore ? Number(score.partialScore) : null, // partialScoreを直接格納
            maxScore: 0, // We'll need to get this from the layout region
            status: score.status as ScoringStatus,
            comment: score.comment || "",
            scoredByUserId: score.scoredByUserId,
            version: score.scoreVersion || 0,
            updatedAt: new Date(score.updatedAt),
          }
        })

        return scoringData
      } catch (error) {
        console.error("Failed to load existing scoring data:", error)
        return {}
      }
    },
    [],
  )

  // 採点状況を取得する関数
  const getScoringStatus = useCallback(
    (answerSheetId: string, questionId?: string): ScoringStatus => {
      if (!questionId) return "ungraded"

      const key = `${answerSheetId}-${questionId}`
      const scoreData = scoringData[key]

      if (!scoreData) return "ungraded"
      return scoreData.status
    },
    [scoringData],
  )

  // 実際の得点を計算する関数
  const getActualScore = useCallback(
    (
      answerSheetId: string,
      questionId?: string,
      maxScore: number = 0,
    ): number | null => {
      if (!questionId) return null

      const key = `${answerSheetId}-${questionId}`
      const scoreData = scoringData[key]

      if (!scoreData) return null

      // calculateActualScoreと同じロジック
      switch (scoreData.status) {
        case "correct":
        case "final":
          return maxScore
        case "incorrect":
        case "no_answer":
          return 0
        case "ungraded":
          return null
        case "partial":
        case "pending":
        case "proposed":
          return scoreData.score
        default:
          return 0
      }
    },
    [scoringData],
  )

  // Auto-finalization logic for collaborative grading
  const checkForAutoFinalization = useCallback(
    async (answerSheetId: string, layoutRegionId: string) => {
      if (!currentUserId) return

      try {
        const comparison = await window.electronAPI.getQuestionScoreComparison(
          answerSheetId,
          layoutRegionId,
        )

        if (
          (comparison as any).success &&
          (comparison as any).proposedScores &&
          (comparison as any).proposedScores.length > 1
        ) {
          // Check if all proposed scores are identical
          const firstScore = (comparison as any).proposedScores[0]
          const allMatch = (comparison as any).proposedScores.every(
            (score: any) =>
              score.score === firstScore.score &&
              score.status === firstScore.status,
          )

          if (allMatch) {
            // Auto-finalize if all scores match
            const finalizeData = {
              partialScore: firstScore.score,
              status: "final",
              comments: firstScore.comment || "",
            }
            const result = await window.electronAPI.finalizeQuestionScore(
              answerSheetId,
              layoutRegionId,
              currentUserId,
              finalizeData,
            )

            if ((result as any).success) {
              // Update local scoring data to reflect finalization
              const key = `${answerSheetId}-${layoutRegionId}`
              setScoringData((prev) => ({
                ...prev,
                [key]: {
                  ...prev[key],
                  status: "final",
                  version:
                    (result as any).score?.scoreVersion ||
                    (result as any).scoreVersion,
                  updatedAt: new Date(
                    (result as any).score?.updatedAt ||
                      (result as any).updatedAt,
                  ),
                },
              }))
            }
          }
        }
      } catch (error) {
        console.error("Error in auto-finalization:", error)
      }
    },
    [currentUserId],
  )

  // 個別採点処理関数
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
        case "ungraded":
          newScore = 0
          status = "ungraded"
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

          if ((result as any).success || result.scoreVersion) {
            setScoringData((prev) => ({
              ...prev,
              [key]: {
                ...currentScore,
                score: newScore,
                status,
                version:
                  (result as any).score?.scoreVersion || result.scoreVersion,
                updatedAt: new Date(
                  (result as any).score?.updatedAt || result.updatedAt,
                ),
              },
            }))

            // 個別採点モードの場合、採点後に自動的に次の答案に移動
            if (gradingMode === "individual" && type !== "ungraded") {
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
            answerSheetId: currentAnswerSheet.id,
            layoutRegionId: currentQuestion.id,
            partialScore: newScore !== null ? newScore : undefined,
            status: status,
            comment: "",
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
                  (result as any).score?.scoreVersion || result.scoreVersion,
                updatedAt: new Date(
                  (result as any).score?.updatedAt || result.updatedAt,
                ),
              },
            }))

            // 個別採点モードの場合、採点後に自動的に次の答案に移動
            if (gradingMode === "individual" && type !== "ungraded") {
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
            currentAnswerSheet.id,
            currentQuestion.id,
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
      checkForAutoFinalization,
    ],
  )

  // 一括採点処理関数
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
          "ungraded",
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
      const currentQuestion = questionRegions[currentQuestionIndex]

      if (!currentQuestion) return

      for (const answerId of ids) {
        const answerSheet = answerSheets.find((sheet) => sheet.id === answerId)
        if (!answerSheet) continue

        const key = `${answerId}-${currentQuestion.id}`
        const currentScore = scoringData[key]

        let newScore: number | null = 0
        // Use the actual status type from the scoring action
        let scoringStatus: ScoringStatus = status

        switch (status) {
          case "ungraded":
            newScore = null // partialScoreはnullに設定
            scoringStatus = "ungraded"
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
              newScore = currentScore?.score || null
            }
            break
          case "pending":
            // モーダルで入力された場合は具体的な値、モーダル無しの場合は現在の値を維持（ステータスのみ変更）
            if (inputPartialScore !== null && inputPartialScore !== undefined) {
              newScore = inputPartialScore
            } else {
              // nullの場合は現在のpartialScoreを維持（ステータスのみ変更）
              newScore = currentScore?.score || null
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
              comment: currentScore.comment || "",
            }
            const result = await window.electronAPI.updateQuestionScore(
              currentScore.id,
              updateData,
              currentScore.version,
            )

            if ((result as any).success || result.scoreVersion) {
              setScoringData((prev) => ({
                ...prev,
                [key]: {
                  ...currentScore,
                  score: newScore,
                  status: scoringStatus,
                  version:
                    (result as any).score?.scoreVersion || result.scoreVersion,
                  updatedAt: new Date(
                    (result as any).score?.updatedAt || result.updatedAt,
                  ),
                },
              }))
            }
          } else {
            // Create new score
            const scoreData = {
              answerSheetId: answerId,
              layoutRegionId: currentQuestion.id,
              partialScore: newScore !== null ? newScore : undefined,
              status: scoringStatus,
              comment: "",
              scoredByUserId: effectiveUserId,
            }
            const result =
              await window.electronAPI.createQuestionScore(scoreData)

            if ((result as any).success || result.id) {
              setScoringData((prev) => ({
                ...prev,
                [key]: {
                  id: (result as any).score?.id || result.id,
                  questionId: currentQuestion.id,
                  score: newScore,
                  maxScore: currentQuestion.points,
                  status: scoringStatus,
                  comment: "",
                  scoredByUserId: effectiveUserId,
                  version:
                    (result as any).score?.scoreVersion || result.scoreVersion,
                  updatedAt: new Date(
                    (result as any).score?.updatedAt || result.updatedAt,
                  ),
                },
              }))
            }
          }

          // Check for auto-finalization in collaborative mode
          if (scoringStatus === "proposed") {
            await checkForAutoFinalization(answerId, currentQuestion.id)
          }
        } catch (error) {
          console.error("Error in batch scoring:", error)
          toast.error(
            `採点中にエラーが発生しました: ${answerSheet.student.lastName}`,
          )
        }
      }
    },
    [
      answerSheets,
      questionRegions,
      currentQuestionIndex,
      currentUserId,
      setCurrentUserId,
      scoringData,
      checkForAutoFinalization,
    ],
  )

  // 設問別進捗を計算する関数
  const calculateQuestionProgress = useCallback(() => {
    const progress: {
      [questionId: string]: {
        totalAnswers: number
        gradedAnswers: number
        percentage: number
      }
    } = {}

    questionRegions.forEach((question) => {
      // このLayoutRegionが属するMasterImageのページ番号を取得
      const questionPageNumber = question.masterImageId ? (question as any).masterImage?.pageNumber : undefined
      
      // 同じページ番号のAnswerSheetのみを対象とする
      const relevantAnswerSheets = answerSheets.filter(sheet => 
        sheet.pageNumber === questionPageNumber
      )
      
      const totalAnswers = relevantAnswerSheets.length
      let gradedAnswers = 0

      relevantAnswerSheets.forEach((sheet) => {
        const key = `${sheet.id}-${question.id}`
        const scoreData = scoringData[key]
        
        // 採点済みの状態をチェック（ungradedでない場合は採点済み）
        if (scoreData && scoreData.status !== "ungraded") {
          gradedAnswers++
        }
      })

      const percentage = totalAnswers > 0 ? Math.round((gradedAnswers / totalAnswers) * 100) : 0

      progress[question.id] = {
        totalAnswers,
        gradedAnswers,
        percentage,
      }
    })

    return progress
  }, [answerSheets, questionRegions, scoringData])

  return {
    scoringData,
    setScoringData,
    loadExistingScoringData,
    getScoringStatus,
    getActualScore,
    handleSetScore,
    handleBatchScore,
    calculateQuestionProgress,
  }
}
