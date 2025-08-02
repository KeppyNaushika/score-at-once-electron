import { DEFAULT_SHORTCUTS } from "@/components/projects/07-score-at-once/hooks/useScoringKeyboard"
import { useCallback, useEffect, useState, useMemo, useRef } from "react"
import type {
  StudentAnswer,
  QuestionRegion,
  ScoringStatus,
} from "@/components/projects/07-score-at-once/ScoringMain/types"
import type { ScoringData } from "@/components/projects/07-score-at-once/types/scoring-data.types"
import type { ClientQuestionScore } from "@/components/projects/07-score-at-once/hooks/scoring-data/types/scoring-data-types"

interface FilterSettings {
  unscored: boolean
  correct: boolean
  incorrect: boolean
  partial: boolean
  pending: boolean
  no_answer: boolean
}

interface UseScoringFilterProps {
  studentAnswers: StudentAnswer[]
  questionRegions: QuestionRegion[]
  currentQuestionIndex: number
  scoringData: Record<string, ClientQuestionScore>
  selectedAnswers: Set<string>
  setSelectedAnswers: (answers: Set<string>) => void
  project: any
}

export function useScoringFilter({
  studentAnswers,
  questionRegions,
  currentQuestionIndex,
  scoringData,
  selectedAnswers,
  setSelectedAnswers,
  project,
}: UseScoringFilterProps) {
  // シンプルなフィルタ設計
  const [filterSettings, setFilterSettings] = useState<FilterSettings>({
    unscored: true,
    correct: false,
    incorrect: false,
    partial: false,
    pending: false,
    no_answer: false,
  })

  const [visibleAnswers, setVisibleAnswers] = useState<Set<string>>(new Set())
  const [recentlyScoredAnswers, setRecentlyScoredAnswers] = useState<
    Set<string>
  >(new Set())

  const currentQuestion = questionRegions[currentQuestionIndex]

  // 採点状況を取得する関数
  const getScoringStatus = useCallback(
    (studentId: string, questionId?: string): ScoringStatus => {
      if (!questionId) return "unscored"

      const key = `${studentId}-${questionId}`
      const scoreData = scoringData[key]

      if (!scoreData) return "unscored"
      return scoreData.status as ScoringStatus
    },
    [scoringData],
  )

  // 表示対象答案の更新（統合版）
  const updateVisibleAnswers = useCallback(
    (customFilterSettings?: FilterSettings) => {
      const activeFilterSettings = customFilterSettings || filterSettings
      const newVisibleAnswers = new Set<string>()

      if (!currentQuestion) {
        setVisibleAnswers(newVisibleAnswers)
        return
      }

      // 事前にprojectPageを取得（ループ内での重複検索を避ける）
      const projectPage = project?.projectPages?.find(
        (page: any) => page.id === currentQuestion.projectPageId,
      )
      const targetPageNumber = projectPage?.pageNumber || 1

      // 最適化: ページフィルタリングを先に実行
      for (const sheet of studentAnswers) {
        if (sheet.pageNumber !== targetPageNumber) continue

        const key = `${sheet.studentId}-${currentQuestion.id}`
        const scoreData = scoringData[key]
        const status = scoreData?.status || "unscored"

        // フィルター条件チェック（最近採点答案は強制表示）
        if (
          activeFilterSettings[status as keyof typeof activeFilterSettings] ||
          recentlyScoredAnswers.has(sheet.id)
        ) {
          newVisibleAnswers.add(sheet.id)
        }
      }

      setVisibleAnswers(newVisibleAnswers)
    },
    [
      studentAnswers,
      currentQuestion,
      filterSettings,
      project?.projectPages,
      scoringData,
      recentlyScoredAnswers,
    ],
  )

  // 初期化時と設問変更時に表示対象を設定（選択は別のuseEffectで管理）
  useEffect(() => {
    if (studentAnswers.length > 0 && questionRegions.length > 0) {
      // 表示対象を更新（選択はクリアしない）
      updateVisibleAnswers()
    }
  }, [
    studentAnswers.length,
    questionRegions.length,
    currentQuestionIndex,
    updateVisibleAnswers,
  ])

  // 選択状態の管理用ref
  const selectedAnswersRef = useRef<Set<string>>(new Set())
  const lastVisibleAnswersRef = useRef<Set<string>>(new Set())

  // selectedAnswersが変更されたらrefも更新
  useEffect(() => {
    selectedAnswersRef.current = selectedAnswers
  }, [selectedAnswers])

  // visibleAnswersが更新されたら適切な答案選択を行う（最適化版）
  useEffect(() => {
    // visibleAnswersに変化がない場合はスキップ（パフォーマンス向上）
    if (visibleAnswers.size === lastVisibleAnswersRef.current.size) {
      let hasChanged = false
      for (const id of visibleAnswers) {
        if (!lastVisibleAnswersRef.current.has(id)) {
          hasChanged = true
          break
        }
      }
      if (!hasChanged) return
    }

    // 最新のvisibleAnswersを記録
    lastVisibleAnswersRef.current = new Set(visibleAnswers)

    // 早期リターンで不要な処理をスキップ
    if (visibleAnswers.size === 0) return

    // 現在の選択状態をrefから取得（最新の状態）
    const currentSelection = selectedAnswersRef.current
    if (currentSelection.size > 0) {
      // 高速な有効性チェック（Set.hasは高速）
      for (const selectedId of currentSelection) {
        if (visibleAnswers.has(selectedId)) {
          return // 有効な選択があるので処理終了
        }
      }
    }

    // 選択が空か無効な場合のみ、最初の学生答案を選択
    for (const answerId of visibleAnswers) {
      if (!answerId.startsWith("master-")) {
        setSelectedAnswers(new Set([answerId]))
        return // 見つかったらすぐ終了
      }
    }
  }, [visibleAnswers, setSelectedAnswers])

  // 模範解答データを取得
  const getMasterAnswerData = useCallback((): ScoringData | null => {
    if (!currentQuestion || !project?.projectPages) return null

    // projectPageIdに基づいてprojectPageを取得
    const projectPage = project.projectPages.find(
      (page: any) => page.id === currentQuestion.projectPageId,
    )

    if (!projectPage) return null

    const masterImage = projectPage.pageImages?.find((img: any) => img.imageType === "MODEL_ANSWER")
    const masterImagePath = masterImage?.imagePath

    return {
      id: `master-${currentQuestion.id}`,
      studentId: "MASTER",
      studentName: "模範解答",
      imageUrl: masterImagePath ? `appimg://${masterImagePath}` : "",
      currentScore: undefined,
      maxScore: currentQuestion.points,
      status: "master" as any, // 特別なステータス
      questionRegion: currentQuestion, // 採点領域情報を追加
      isMaster: true, // 模範解答フラグ
    }
  }, [currentQuestion, project?.projectPages])

  // 全採点データを取得（新しいScoringData型として）
  const allScoringData = useMemo((): ScoringData[] => {
    if (!currentQuestion) return []

    // projectPageIdに基づいてprojectPageのpageNumberを取得
    const projectPage = project?.projectPages?.find(
      (page: any) => page.id === currentQuestion.projectPageId,
    )
    const targetPageNumber = projectPage?.pageNumber || 1

    // pageNumberでフィルタリングしてから受験生徒順でソート
    const pageFilteredSheets = studentAnswers.filter(
      (sheet) => sheet.pageNumber === targetPageNumber,
    )

    const sortedAnswerSheets = [...pageFilteredSheets].sort((a, b) => {
      // ProjectStudentのcustomOrderで並び替え（小さい値が先）
      // customOrderが未定義の場合は、学籍番号の数値として比較
      const aOrder =
        a.student.projectStudents?.[0]?.customOrder !== undefined
          ? a.student.projectStudents[0].customOrder
          : 999999
      const bOrder =
        b.student.projectStudents?.[0]?.customOrder !== undefined
          ? b.student.projectStudents[0].customOrder
          : 999999

      // customOrderが同じ場合は姓名でソート
      if (aOrder === bOrder) {
        const aName = `${a.student.lastName}${a.student.firstName}`
        const bName = `${b.student.lastName}${b.student.firstName}`
        return aName.localeCompare(bName, "ja")
      }

      return aOrder - bOrder
    })

    const studentScoringData: ScoringData[] = sortedAnswerSheets.map((sheet) => {
      const key = `${sheet.studentId}-${currentQuestion.id}`
      const scoreData = scoringData[key]

      return {
        id: sheet.id,
        studentId: sheet.student.studentId,
        studentName: `${sheet.student.lastName} ${sheet.student.firstName}`,
        imageUrl: sheet.imagePath ? `appimg://${sheet.imagePath}` : "",
        currentScore: scoreData?.partialScore ? Number(scoreData.partialScore) : undefined,
        maxScore: currentQuestion.points,
        status: (scoreData?.status || "unscored") as ScoringStatus,
        questionRegion: currentQuestion, // 採点領域情報を追加
      }
    })

    // 模範解答データも追加
    const masterAnswer = getMasterAnswerData()
    if (masterAnswer) {
      return [masterAnswer, ...studentScoringData]
    }

    return studentScoringData
  }, [
    currentQuestion,
    project?.projectPages,
    studentAnswers,
    scoringData,
    getMasterAnswerData,
  ])

  // 基本的なグリッドデータ取得（後方互換性のため残す）
  const getAllGridAnswerData = useMemo(() => {
    return allScoringData.map(data => ({
      ...data,
      isSelected: selectedAnswers.has(data.id),
    }))
  }, [allScoringData, selectedAnswers])

  // 表示用のグリッドデータ（visibleAnswersを使用）
  const getGridAnswerData = useCallback(() => {
    const filteredAnswers = getAllGridAnswerData.filter((answer) =>
      visibleAnswers.has(answer.id),
    )

    // 模範解答を最初に追加
    const masterAnswer = getMasterAnswerData()
    if (masterAnswer) {
      return [masterAnswer, ...filteredAnswers]
    }

    return filteredAnswers
  }, [getAllGridAnswerData, visibleAnswers, getMasterAnswerData])

  // フィルタリング関連ハンドラー（Rキー押下時およびフィルター変更時）
  const handleRefreshFilter = useCallback(() => {
    // 最近採点した答案をクリア
    setRecentlyScoredAnswers(new Set())

    // 最新のscoringDataを使用してフィルタリングを実行
    updateVisibleAnswers()

    // 選択は自動管理useEffectに任せる
  }, [updateVisibleAnswers])

  const handleToggleFilter = useCallback(
    (key: string) => {
      // ボタン操作によるフィルター切り替え
      if (key in filterSettings) {
        const newFilterSettings = {
          ...filterSettings,
          [key]: !filterSettings[key as keyof typeof filterSettings],
        }
        setFilterSettings(newFilterSettings)

        // 新しいフィルター設定を直接渡してフィルタリングを実行
        updateVisibleAnswers(newFilterSettings)

        // 最近採点した答案をクリア（選択は自動管理useEffectに任せる）
        setRecentlyScoredAnswers(new Set())
      }
    },
    [filterSettings, updateVisibleAnswers],
  )

  // Alt+採点キーでフィルタ切り替え
  const handleToggleFilterByScoreKey = useCallback(
    (scoreKey: string) => {
      const scoreToFilterMap: { [key: string]: keyof typeof filterSettings } = {
        [DEFAULT_SHORTCUTS.unscored]: "unscored",
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

        // 新しいフィルター設定を直接渡してフィルタリングを実行
        updateVisibleAnswers(newFilterSettings)

        // 最近採点した答案をクリア（選択は自動管理useEffectに任せる）
        setRecentlyScoredAnswers(new Set())
      }
    },
    [filterSettings, updateVisibleAnswers],
  )

  return {
    // 新しいデータ構造
    allScoringData,
    filteredScoringDataIds: visibleAnswers,
    selectedScoringDataIds: selectedAnswers,
    
    // 従来の互換性維持
    filterSettings,
    setFilterSettings,
    visibleAnswers,
    recentlyScoredAnswers,
    setRecentlyScoredAnswers,
    getAllGridAnswerData,
    getGridAnswerData,
    getMasterAnswerData,
    handleRefreshFilter,
    handleToggleFilter,
    handleToggleFilterByScoreKey,
    getScoringStatus,
  }
}
