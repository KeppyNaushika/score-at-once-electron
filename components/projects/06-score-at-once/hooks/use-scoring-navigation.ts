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

  // WASD移動ハンドラー（レイアウト方向とフィルタリングに対応）
  const handleGridNavigation = useCallback((key: string) => {
    if (answerSheetsLength === 0) return

    const gridAnswers = getGridAnswerData()
    const totalAnswers = gridAnswers.length

    if (totalAnswers === 0) return

    const cols = Math.max(1, gridSize.columns) // 最低1列は確保
    const rows = Math.ceil(totalAnswers / cols)

    // 現在選択されている答案のインデックスを取得
    let currentIndex = -1
    if (selectedAnswers.size >= 1) {
      const selectedId = Array.from(selectedAnswers)[0]
      currentIndex = gridAnswers.findIndex((answer) => answer.id === selectedId)
    }

    // 何も選択されていない場合は最初の生徒答案を選択（模範解答をスキップ）
    if (currentIndex === -1) {
      if (totalAnswers > 0) {
        // 模範解答以外の最初の答案を探す
        const firstStudentAnswerIndex = gridAnswers.findIndex(answer => !answer.id.startsWith('master-'))
        if (firstStudentAnswerIndex !== -1) {
          setSelectedAnswers(new Set([gridAnswers[firstStudentAnswerIndex].id]))
        }
      }
      return
    }

    let newIndex = currentIndex

    // デバッグ情報（開発時のみ）
    if (process.env.NODE_ENV === "development") {
      console.log("WASD Navigation:", {
        key,
        currentIndex,
        totalAnswers,
        cols,
        rows,
        layoutDirection,
        selectedAnswerIds: Array.from(selectedAnswers),
      })
    }

    // レイアウト方向に応じた移動処理
    switch (layoutDirection) {
      case "right-down": // 右→下方向
        switch (key) {
          case "w": // 上に移動（前の行）
            newIndex = Math.max(0, currentIndex - cols)
            break
          case "s": // 下に移動（次の行）
            newIndex = Math.min(totalAnswers - 1, currentIndex + cols)
            break
          case "a": // 左に移動（前の列）
            if (currentIndex % cols > 0) {
              newIndex = currentIndex - 1
            }
            break
          case "d": // 右に移動（次の列）
            if (currentIndex % cols < cols - 1 && currentIndex + 1 < totalAnswers) {
              newIndex = currentIndex + 1
            }
            break
        }
        break

      case "left-down": // 左→下方向
        switch (key) {
          case "w": // 上に移動（前の行）
            newIndex = Math.max(0, currentIndex - cols)
            break
          case "s": // 下に移動（次の行）
            newIndex = Math.min(totalAnswers - 1, currentIndex + cols)
            break
          case "d": // 右に移動（前の列、左→下では逆）
            if (currentIndex % cols > 0) {
              newIndex = currentIndex - 1
            }
            break
          case "a": // 左に移動（次の列、左→下では逆）
            if (currentIndex % cols < cols - 1 && currentIndex + 1 < totalAnswers) {
              newIndex = currentIndex + 1
            }
            break
        }
        break

      case "down-right": // 下→右方向
        switch (key) {
          case "a": // 左に移動（前の列）
            newIndex = Math.max(0, currentIndex - rows)
            break
          case "d": // 右に移動（次の列）
            newIndex = Math.min(totalAnswers - 1, currentIndex + rows)
            break
          case "w": // 上に移動（前の行）
            if (currentIndex % rows > 0) {
              newIndex = currentIndex - 1
            }
            break
          case "s": // 下に移動（次の行）
            if (currentIndex % rows < rows - 1 && currentIndex + 1 < totalAnswers) {
              newIndex = currentIndex + 1
            }
            break
        }
        break

      case "down-left": // 下→左方向
        switch (key) {
          case "d": // 右に移動（前の列、下→左では逆）
            newIndex = Math.max(0, currentIndex - rows)
            break
          case "a": // 左に移動（次の列、下→左では逆）
            newIndex = Math.min(totalAnswers - 1, currentIndex + rows)
            break
          case "w": // 上に移動（前の行）
            if (currentIndex % rows > 0) {
              newIndex = currentIndex - 1
            }
            break
          case "s": // 下に移動（次の行）
            if (currentIndex % rows < rows - 1 && currentIndex + 1 < totalAnswers) {
              newIndex = currentIndex + 1
            }
            break
        }
        break
    }

    // 模範解答を選択しないようにスキップ
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < totalAnswers) {
      const targetAnswer = gridAnswers[newIndex]
      if (targetAnswer && !targetAnswer.id.startsWith('master-')) {
        setSelectedAnswers(new Set([targetAnswer.id]))
      }
    }
  }, [
    answerSheetsLength,
    getGridAnswerData,
    gridSize,
    selectedAnswers,
    setSelectedAnswers,
    layoutDirection,
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