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
  gridSize: { columns: number; rows: number }
  layoutDirection: "right-down" | "left-down" | "down-right" | "down-left"
  getGridAnswerData: () => any[]
  effectiveColumns?: number // 実際の表示列数
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
  gridSize,
  layoutDirection,
  getGridAnswerData,
  effectiveColumns,
}: UseScoringNavigationProps) {
  // 画像表示関連の状態
  const [imageZoom, setImageZoom] = useState(1.0)
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 })
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

  // 画像表示関連の関数
  const handleZoomIn = useCallback(() => {
    setImageZoom((prev) => Math.min(prev * 1.2, 5.0))
  }, [])

  const handleZoomOut = useCallback(() => {
    setImageZoom((prev) => Math.max(prev / 1.2, 0.1))
  }, [])

  const handleResetZoom = useCallback(() => {
    setImageZoom(1.0)
    setImagePosition({ x: 0, y: 0 })
  }, [])

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === "question" ? "full" : "question"))
    handleResetZoom()
  }, [handleResetZoom])

  // 模範解答をスキップして次の有効な答案を見つける関数
  const findNextValidAnswer = useCallback((startIndex: number, direction: number, gridAnswers: any[]): number => {
    const totalAnswers = gridAnswers.length
    for (let i = startIndex; i >= 0 && i < totalAnswers; i += direction) {
      if (!gridAnswers[i].id.startsWith('master-')) {
        return i
      }
    }
    return -1
  }, [])

  // WASD移動ハンドラー（レイアウト方向とフィルタリングに対応）
  const handleGridNavigation = useCallback((key: string) => {
    if (answerSheetsLength === 0) return

    const gridAnswers = getGridAnswerData()
    const totalAnswers = gridAnswers.length

    if (totalAnswers === 0) return

    // effectiveColumnsから実際の1行あたりの表示件数を取得
    let actualColumns = effectiveColumns || gridSize.columns
    
    // effectiveColumnsが正しく設定されていない場合のフォールバック
    if (!effectiveColumns || effectiveColumns <= 0) {
      try {
        const stored = localStorage.getItem('scoring-itemsPerRow')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed) && parsed.length === 1 && typeof parsed[0] === 'number' && parsed[0] >= 1 && parsed[0] <= 10) {
            actualColumns = parsed[0]
          }
        }
      } catch (error) {
        // localStorageエラーの場合はfallback値を使用
        actualColumns = gridSize.columns
      }
    }

    const cols = Math.max(1, actualColumns) // 実際の表示列数を使用、最低1列は確保
    const rows = Math.ceil(totalAnswers / cols)
    
    // デバッグ情報（開発時のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log('Grid Navigation Debug:', {
        effectiveColumns,
        actualColumns,
        cols,
        totalAnswers,
        rows,
        layoutDirection,
        key
      })
    }

    // 現在選択されている答案のインデックスを取得
    let currentIndex = -1
    if (selectedAnswers.size >= 1) {
      const selectedId = Array.from(selectedAnswers)[0]
      currentIndex = gridAnswers.findIndex((answer) => answer.id === selectedId)
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
        // 列表示では1列あたりの表示件数（effectiveColumns）が実際の列の高さ（行数）となる
        const columnsForDownRight = actualColumns // 1列あたりの表示件数
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
        // 列表示では1列あたりの表示件数（effectiveColumns）が実際の列の高さ（行数）となる
        const columnsForDownLeft = actualColumns // 1列あたりの表示件数
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
    if (newIndex >= 0 && newIndex < totalAnswers && newIndex !== currentIndex) {
      const targetAnswer = gridAnswers[newIndex]
      if (targetAnswer && !targetAnswer.id.startsWith('master-')) {
        setSelectedAnswers(new Set([targetAnswer.id]))
      } else {
        // 模範解答の場合、方向に応じて次の有効な答案を探す
        const direction = newIndex > currentIndex ? 1 : -1
        const validIndex = findNextValidAnswer(newIndex + direction, direction, gridAnswers)
        if (validIndex !== -1) {
          setSelectedAnswers(new Set([gridAnswers[validIndex].id]))
        }
      }
    }
  }, [
    answerSheetsLength,
    getGridAnswerData,
    gridSize,
    selectedAnswers,
    setSelectedAnswers,
    layoutDirection,
    findNextValidAnswer,
  ])

  return {
    imageZoom,
    setImageZoom,
    imagePosition,
    setImagePosition,
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