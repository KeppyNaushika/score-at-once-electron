import { useCallback, useState } from "react"

interface UseScoringNavigationProps {
  answerSheetsLength: number
  questionRegionsLength: number
  currentStudentIndex: number
  setCurrentStudentIndex: (index: number) => void
  currentQuestionIndex: number
  setCurrentQuestionIndex: (index: number) => void
  selectedAnswers: Set<string>
  setSelectedAnswers: (answers: Set<string>) => void
  layoutDirection: "right-down" | "left-down" | "down-right" | "down-left"
  getGridAnswerData: () => any[]
  effectiveColumns?: number // 実際の表示数（行あたり/列あたり）
}

export function useScoringNavigation({
  answerSheetsLength,
  questionRegionsLength,
  currentStudentIndex,
  setCurrentStudentIndex,
  currentQuestionIndex,
  setCurrentQuestionIndex,
  selectedAnswers,
  setSelectedAnswers,
  layoutDirection,
  getGridAnswerData,
  effectiveColumns,
}: UseScoringNavigationProps) {
  const [viewMode, setViewMode] = useState<"question" | "full">("question") // 設問拡大 or 全体表示

  // ナビゲーション関数
  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex < questionRegionsLength - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }, [currentQuestionIndex, questionRegionsLength, setCurrentQuestionIndex])

  const handlePrevQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }, [currentQuestionIndex, setCurrentQuestionIndex])

  const handleNextStudent = useCallback(() => {
    if (currentStudentIndex < answerSheetsLength - 1) {
      setCurrentStudentIndex(currentStudentIndex + 1)
    }
  }, [currentStudentIndex, answerSheetsLength, setCurrentStudentIndex])

  const handlePrevStudent = useCallback(() => {
    if (currentStudentIndex > 0) {
      setCurrentStudentIndex(currentStudentIndex - 1)
    }
  }, [currentStudentIndex, setCurrentStudentIndex])

  // プレースホルダー関数（Individual View内で実装される）
  const handleZoomIn = useCallback(() => {
    // Individual View内で実装される
  }, [])

  const handleZoomOut = useCallback(() => {
    // Individual View内で実装される
  }, [])

  const handleResetZoom = useCallback(() => {
    // Individual View内で実装される
  }, [])

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === "question" ? "full" : "question"))
  }, [])

  // 模範解答をスキップして次の有効な答案を見つける関数
  const findNextValidAnswer = useCallback(
    (startIndex: number, direction: number, gridAnswers: any[]): number => {
      const totalAnswers = gridAnswers.length
      for (let i = startIndex; i >= 0 && i < totalAnswers; i += direction) {
        if (!gridAnswers[i].id.startsWith("master-")) {
          return i
        }
      }
      return -1
    },
    [],
  )

  // WASD移動ハンドラー（レイアウト方向とフィルタリングに対応）
  const handleGridNavigation = useCallback(
    (key: string) => {
      if (answerSheetsLength === 0) return

      const gridAnswers = getGridAnswerData()
      const totalAnswers = gridAnswers.length

      if (totalAnswers === 0) return

      // effectiveColumnsから実際の1行/列あたりの表示件数を取得
      let actualItemsPerLine = effectiveColumns || 4

      // effectiveColumnsが正しく設定されていない場合のフォールバック
      if (!effectiveColumns || effectiveColumns <= 0) {
        try {
          const stored = localStorage.getItem("scoring-itemsPerLine")
          if (stored) {
            const parsed = JSON.parse(stored)
            if (
              Array.isArray(parsed) &&
              parsed.length === 1 &&
              typeof parsed[0] === "number" &&
              parsed[0] >= 1 &&
              parsed[0] <= 10
            ) {
              actualItemsPerLine = parsed[0]
            }
          }
        } catch (error) {
          // localStorageエラーの場合はfallback値を使用
          actualItemsPerLine = 4
        }
      }

      const cols = Math.max(1, actualItemsPerLine) // 実際の表示数を使用、最低1は確保

      // 現在選択されている答案のインデックスを取得
      let currentIndex = -1
      if (selectedAnswers.size >= 1) {
        const selectedId = Array.from(selectedAnswers)[0]
        currentIndex = gridAnswers.findIndex(
          (answer) => answer.id === selectedId,
        )
      }

      // 何も選択されていない場合は最初の生徒答案を選択（模範解答をスキップ）
      if (currentIndex === -1) {
        const firstValidIndex = findNextValidAnswer(0, 1, gridAnswers)
        if (firstValidIndex !== -1) {
          setSelectedAnswers(new Set([gridAnswers[firstValidIndex].id]))
        }
        return
      }

      let newIndex = currentIndex

      // レイアウト方向に応じた移動処理
      switch (layoutDirection) {
        case "right-down": // 右→下方向
          switch (key) {
            case "w": // 上に移動（前の行、行境界を超えて移動可能）
              newIndex = currentIndex - cols
              if (newIndex < 0) {
                // 最上行の場合、前の答案を選択
                newIndex = Math.max(0, currentIndex - 1)
              }
              break
            case "s": // 下に移動（次の行、行境界を超えて移動可能）
              newIndex = currentIndex + cols
              if (newIndex >= totalAnswers) {
                // 最下行の場合、次の答案を選択
                newIndex = Math.min(totalAnswers - 1, currentIndex + 1)
              }
              break
            case "a": // 左に移動（列境界を超えて移動可能）
              newIndex = currentIndex - 1
              break
            case "d": // 右に移動（列境界を超えて移動可能）
              newIndex = currentIndex + 1
              break
          }
          break

        case "left-down": // 左→下方向
          switch (key) {
            case "w": // 上に移動（前の行、行境界を超えて移動可能）
              newIndex = currentIndex - cols
              if (newIndex < 0) {
                newIndex = Math.max(0, currentIndex - 1)
              }
              break
            case "s": // 下に移動（次の行、行境界を超えて移動可能）
              newIndex = currentIndex + cols
              if (newIndex >= totalAnswers) {
                newIndex = Math.min(totalAnswers - 1, currentIndex + 1)
              }
              break
            case "d": // 右に移動（左→下では前の列、境界を超えて移動可能）
              newIndex = currentIndex - 1
              break
            case "a": // 左に移動（左→下では次の列、境界を超えて移動可能）
              newIndex = currentIndex + 1
              break
          }
          break

        case "down-right": // 下→右方向
          // 列表示では1列あたりの表示件数が実際の列の高さ（行数）となる
          const columnsForDownRight = actualItemsPerLine // 1列あたりの表示件数
          switch (key) {
            case "a": // 左に移動（前の列、列境界を超えて移動可能）
              newIndex = currentIndex - columnsForDownRight
              if (newIndex < 0) {
                newIndex = Math.max(0, currentIndex - 1)
              }
              break
            case "d": // 右に移動（次の列、列境界を超えて移動可能）
              newIndex = currentIndex + columnsForDownRight
              if (newIndex >= totalAnswers) {
                newIndex = Math.min(totalAnswers - 1, currentIndex + 1)
              }
              break
            case "w": // 上に移動（行境界を超えて移動可能）
              newIndex = currentIndex - 1
              break
            case "s": // 下に移動（行境界を超えて移動可能）
              newIndex = currentIndex + 1
              break
          }
          break

        case "down-left": // 下→左方向
          // 列表示では1列あたりの表示件数が実際の列の高さ（行数）となる
          const columnsForDownLeft = actualItemsPerLine // 1列あたりの表示件数
          switch (key) {
            case "d": // 右に移動（下→左では前の列、境界を超えて移動可能）
              newIndex = currentIndex - columnsForDownLeft
              if (newIndex < 0) {
                newIndex = Math.max(0, currentIndex - 1)
              }
              break
            case "a": // 左に移動（下→左では次の列、境界を超えて移動可能）
              newIndex = currentIndex + columnsForDownLeft
              if (newIndex >= totalAnswers) {
                newIndex = Math.min(totalAnswers - 1, currentIndex + 1)
              }
              break
            case "w": // 上に移動（行境界を超えて移動可能）
              newIndex = currentIndex - 1
              break
            case "s": // 下に移動（行境界を超えて移動可能）
              newIndex = currentIndex + 1
              break
          }
          break
      }

      // 範囲チェックして模範解答をスキップ
      if (
        newIndex >= 0 &&
        newIndex < totalAnswers &&
        newIndex !== currentIndex
      ) {
        const targetAnswer = gridAnswers[newIndex]
        if (targetAnswer && !targetAnswer.id.startsWith("master-")) {
          setSelectedAnswers(new Set([targetAnswer.id]))
        } else {
          // 模範解答の場合、方向に応じて次の有効な答案を探す
          const direction = newIndex > currentIndex ? 1 : -1
          const validIndex = findNextValidAnswer(
            newIndex + direction,
            direction,
            gridAnswers,
          )
          if (validIndex !== -1) {
            setSelectedAnswers(new Set([gridAnswers[validIndex].id]))
          }
        }
      }
    },
    [
      answerSheetsLength,
      getGridAnswerData,
      selectedAnswers,
      setSelectedAnswers,
      layoutDirection,
      findNextValidAnswer,
      effectiveColumns,
    ],
  )

  return {
    viewMode,
    setViewMode,
    handleNextQuestion,
    handlePrevQuestion,
    handleNextStudent,
    handlePrevStudent,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    toggleViewMode,
    handleGridNavigation,
  }
}
