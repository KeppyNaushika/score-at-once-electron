import { useState, useEffect, useCallback } from "react"
import { ScoringStatus, DEFAULT_SHORTCUTS } from "./use-scoring-keyboard"
import { QuestionRegion, AnswerSheet, ScoringData } from "./use-scoring-data"

interface FilterSettings {
  ungraded: boolean
  correct: boolean
  incorrect: boolean
  partial: boolean
  pending: boolean
  no_answer: boolean
}

interface UseScoringFilterProps {
  answerSheets: AnswerSheet[]
  questionRegions: QuestionRegion[]
  currentQuestionIndex: number
  scoringData: Record<string, ScoringData>
  selectedAnswers: Set<string>
  setSelectedAnswers: (answers: Set<string>) => void
  project: any
}

export function useScoringFilter({
  answerSheets,
  questionRegions,
  currentQuestionIndex,
  scoringData,
  selectedAnswers,
  setSelectedAnswers,
  project,
}: UseScoringFilterProps) {
  // シンプルなフィルタ設計
  const [filterSettings, setFilterSettings] = useState<FilterSettings>({
    ungraded: true,
    correct: false,
    incorrect: false,
    partial: false,
    pending: false,
    no_answer: false,
  })
  
  const [visibleAnswers, setVisibleAnswers] = useState<Set<string>>(new Set())

  const currentQuestion = questionRegions[currentQuestionIndex]

  // 採点状況を取得する関数
  const getScoringStatus = useCallback((answerSheetId: string, questionId?: string): ScoringStatus => {
    if (!questionId) return "ungraded"
    
    const key = `${answerSheetId}-${questionId}`
    const scoreData = scoringData[key]
    
    if (!scoreData) return "ungraded"
    return scoreData.status
  }, [scoringData])

  // 表示対象答案の更新（初期化時とRキー押下時のみ）
  const updateVisibleAnswers = useCallback(() => {
    const newVisibleAnswers = new Set<string>()
    
    answerSheets.forEach(sheet => {
      const status = getScoringStatus(sheet.id, currentQuestion?.id)
      if (filterSettings[status as keyof typeof filterSettings]) {
        newVisibleAnswers.add(sheet.id)
      }
    })
    
    setVisibleAnswers(newVisibleAnswers)
  }, [answerSheets, currentQuestion, filterSettings, getScoringStatus, scoringData])

  // 初期化時に表示対象を設定
  useEffect(() => {
    if (answerSheets.length > 0 && questionRegions.length > 0) {
      updateVisibleAnswers()
    }
  }, [answerSheets.length, questionRegions.length, currentQuestionIndex])

  // 最初の答案を初期選択状態にする
  useEffect(() => {
    if (visibleAnswers.size > 0 && selectedAnswers.size === 0) {
      const firstVisible = Array.from(visibleAnswers)[0]
      setSelectedAnswers(new Set([firstVisible]))
    }
  }, [visibleAnswers, selectedAnswers.size, setSelectedAnswers])

  // 設問変更時に選択状態をリセット
  useEffect(() => {
    setSelectedAnswers(new Set())
  }, [currentQuestionIndex, setSelectedAnswers])

  // 基本的なグリッドデータ取得（フィルタリングなし）
  const getAllGridAnswerData = useCallback(() => {
    if (!currentQuestion) return []

    // masterImageIdに基づいてmasterImageのpageNumberを取得
    const masterImage = project?.masterImages?.find(
      (img: any) => img.id === currentQuestion.masterImageId,
    )
    const targetPageNumber = masterImage?.pageNumber || 1

    // pageNumberでフィルタリングしてから受験生徒順でソート
    const pageFilteredSheets = answerSheets.filter(
      (sheet) => sheet.pageNumber === targetPageNumber,
    )

    const sortedAnswerSheets = [...pageFilteredSheets].sort((a, b) => {
      // ProjectStudentのcustomOrderで並び替え（小さい値が先）
      // customOrderが未定義の場合は、学籍番号の数値として比較
      const aOrder =
        a.student.projectStudents?.[0]?.customOrder !== undefined ? a.student.projectStudents[0].customOrder : 999999
      const bOrder =
        b.student.projectStudents?.[0]?.customOrder !== undefined ? b.student.projectStudents[0].customOrder : 999999

      // customOrderが同じ場合は姓名でソート
      if (aOrder === bOrder) {
        const aName = `${a.student.lastName}${a.student.firstName}`
        const bName = `${b.student.lastName}${b.student.firstName}`
        return aName.localeCompare(bName, "ja")
      }

      return aOrder - bOrder
    })

    return sortedAnswerSheets.map((sheet) => {
      const key = `${sheet.id}-${currentQuestion.id}`
      const scoreData = scoringData[key]

      return {
        id: sheet.id,
        studentId: sheet.student.studentId,
        studentName: `${sheet.student.lastName} ${sheet.student.firstName}`,
        imageUrl: `appimg://${sheet.imagePath}`,
        currentScore: scoreData?.score,
        maxScore: currentQuestion.points,
        status: (scoreData?.status || "ungraded") as ScoringStatus,
        isSelected: selectedAnswers.has(sheet.id),
        questionRegion: currentQuestion, // 採点領域情報を追加
      }
    })
  }, [currentQuestion, project, answerSheets, scoringData, selectedAnswers])

  // 模範解答データを取得
  const getMasterAnswerData = useCallback(() => {
    if (!currentQuestion || !project?.masterImages) return null

    // masterImageIdに基づいてmasterImageを取得
    const masterImage = project.masterImages.find(
      (img: any) => img.id === currentQuestion.masterImageId,
    )
    
    if (!masterImage) return null

    return {
      id: `master-${currentQuestion.id}`,
      studentId: "MASTER",
      studentName: "模範解答",
      imageUrl: `appimg://${masterImage.path}`,
      currentScore: undefined,
      maxScore: currentQuestion.points,
      status: "master" as any, // 特別なステータス
      isSelected: false,
      questionRegion: currentQuestion, // 採点領域情報を追加
      isMaster: true, // 模範解答フラグ
    }
  }, [currentQuestion, project])

  // 表示用のグリッドデータ（visibleAnswersを使用）
  const getGridAnswerData = useCallback(() => {
    const allAnswers = getAllGridAnswerData()
    const filteredAnswers = allAnswers.filter(answer => visibleAnswers.has(answer.id))
    
    // 模範解答を最初に追加
    const masterAnswer = getMasterAnswerData()
    if (masterAnswer) {
      return [masterAnswer, ...filteredAnswers]
    }
    
    return filteredAnswers
  }, [getAllGridAnswerData, visibleAnswers, getMasterAnswerData])

  // フィルタリング関連ハンドラー（Rキー押下時のみ）
  const handleRefreshFilter = useCallback(() => {
    updateVisibleAnswers()
  }, [updateVisibleAnswers])

  const handleToggleFilter = useCallback((key: string) => {
    // ボタン操作によるフィルター切り替え
    if (key in filterSettings) {
      const newFilterSettings = {
        ...filterSettings,
        [key]: !filterSettings[key as keyof typeof filterSettings],
      }
      setFilterSettings(newFilterSettings)
      // 注意: 表示更新は手動（Rキー）でのみ実行
    }
  }, [filterSettings])

  // Alt+採点キーでフィルタ切り替え
  const handleToggleFilterByScoreKey = useCallback((scoreKey: string) => {
    const scoreToFilterMap: { [key: string]: keyof typeof filterSettings } = {
      [DEFAULT_SHORTCUTS.ungraded]: "ungraded",
      [DEFAULT_SHORTCUTS.correct]: "correct",
      [DEFAULT_SHORTCUTS.incorrect]: "incorrect",
      [DEFAULT_SHORTCUTS.partial]: "partial",
      [DEFAULT_SHORTCUTS.pending]: "pending",
      [DEFAULT_SHORTCUTS.no_answer]: "no_answer",
    }

    const filterKey = scoreToFilterMap[scoreKey]
    if (filterKey) {
      const newFilterSettings = {
        ...filterSettings,
        [filterKey]: !filterSettings[filterKey],
      }
      setFilterSettings(newFilterSettings)
      // 注意: 表示更新は手動（Rキー）でのみ実行
    }
  }, [filterSettings])

  // メニューショートカットを設定し、IPCイベントリスナーを追加
  useEffect(() => {
    // スコアページ用のメニューを有効化
    window.electronAPI.setShortcut("score")

    // score-panel IPCイベントリスナーを追加
    const handleScorePanelEvent = (_event: any, value: Record<string, unknown>) => {
      const action = value?.action as string
      
      if (!action) return
      
      switch (action) {
        case "toggle-show-unscored":
          handleToggleFilterByScoreKey("q")
          break
        case "toggle-show-correct":
          handleToggleFilterByScoreKey("e")
          break
        case "toggle-show-partial":
          handleToggleFilterByScoreKey("f")
          break
        case "toggle-show-pending":
          handleToggleFilterByScoreKey("j")
          break
        case "toggle-show-incorrect":
          handleToggleFilterByScoreKey("o")
          break
        case "toggle-show-noanswer":
          handleToggleFilterByScoreKey("p")
          break
      }
    }

    // IPCレンダラーにリスナーを追加
    window.electronAPI.scorePanel(handleScorePanelEvent)

    return () => {
      // クリーンアップ
      window.electronAPI.removeScorePanelListener(handleScorePanelEvent)
    }
  }, [handleToggleFilterByScoreKey])

  return {
    filterSettings,
    setFilterSettings,
    visibleAnswers,
    getAllGridAnswerData,
    getGridAnswerData,
    getMasterAnswerData,
    handleRefreshFilter,
    handleToggleFilter,
    handleToggleFilterByScoreKey,
    getScoringStatus,
  }
}