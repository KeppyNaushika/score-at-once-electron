import { DEFAULT_SHORTCUTS } from "@/components/projects/07-score-at-once/hooks/use-scoring-keyboard"
import { useCallback, useEffect, useState } from "react"
import type {
  AnswerSheet,
  QuestionRegion,
  ScoringData,
  ScoringStatus,
} from "../types"

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

  // 表示対象答案の更新（統合版）
  const updateVisibleAnswers = useCallback(
    (customFilterSettings?: FilterSettings) => {
      const activeFilterSettings = customFilterSettings || filterSettings
      const newVisibleAnswers = new Set<string>()

      if (!currentQuestion) {
        setVisibleAnswers(newVisibleAnswers)
        return
      }

      // masterImageIdに基づいてpageNumberを取得
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

      sortedAnswerSheets.forEach((sheet) => {
        const key = `${sheet.id}-${currentQuestion?.id}`
        const scoreData = scoringData[key]
        const status = scoreData?.status || "ungraded"

        if (activeFilterSettings[status as keyof typeof activeFilterSettings]) {
          newVisibleAnswers.add(sheet.id)
        }
      })

      setVisibleAnswers(newVisibleAnswers)
    },
    [answerSheets, currentQuestion, filterSettings, project, scoringData],
  )

  // 初期化時と設問変更時に表示対象を設定し、最初の答案を選択
  useEffect(() => {
    if (answerSheets.length > 0 && questionRegions.length > 0) {
      // まず選択をクリア
      setSelectedAnswers(new Set())

      // 表示対象を更新
      updateVisibleAnswers()
    }
  }, [answerSheets.length, questionRegions.length, currentQuestionIndex])

  // visibleAnswersが更新されたら最初の生徒答案を選択（模範解答をスキップ）
  useEffect(() => {
    if (visibleAnswers.size > 0 && selectedAnswers.size === 0) {
      // 模範解答をスキップして最初の生徒答案を選択
      const visibleIds = Array.from(visibleAnswers)
      const firstStudentAnswerId = visibleIds.find(
        (id) => !id.startsWith("master-"),
      )

      // 実際に存在する答案IDかチェック
      if (firstStudentAnswerId) {
        const answerExists = answerSheets.some(
          (sheet) => sheet.id === firstStudentAnswerId,
        )
        if (answerExists) {
          setSelectedAnswers(new Set([firstStudentAnswerId]))
        }
      }
    }
  }, [visibleAnswers, selectedAnswers.size, setSelectedAnswers, answerSheets])

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

    return sortedAnswerSheets.map((sheet) => {
      const key = `${sheet.id}-${currentQuestion.id}`
      const scoreData = scoringData[key]

      return {
        id: sheet.id,
        studentId: sheet.student.studentId,
        studentName: `${sheet.student.lastName} ${sheet.student.firstName}`,
        imageUrl: `appimg://${sheet.imagePath}`,
        currentScore: scoreData?.score ?? undefined,
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
    const filteredAnswers = allAnswers.filter((answer) =>
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
    // 選択をクリア
    setSelectedAnswers(new Set())

    // 最新のscoringDataを使用してフィルタリングを実行
    updateVisibleAnswers()
  }, [setSelectedAnswers, updateVisibleAnswers])

  const handleToggleFilter = useCallback(
    (key: string) => {
      // ボタン操作によるフィルター切り替え
      if (key in filterSettings) {
        const newFilterSettings = {
          ...filterSettings,
          [key]: !filterSettings[key as keyof typeof filterSettings],
        }
        setFilterSettings(newFilterSettings)

        // 選択をクリア
        setSelectedAnswers(new Set())

        // 新しいフィルター設定を直接渡してフィルタリングを実行
        updateVisibleAnswers(newFilterSettings)
      }
    },
    [filterSettings, setSelectedAnswers, updateVisibleAnswers],
  )

  // Alt+採点キーでフィルタ切り替え
  const handleToggleFilterByScoreKey = useCallback(
    (scoreKey: string) => {
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

        // 選択をクリア
        setSelectedAnswers(new Set())

        // 新しいフィルター設定を直接渡してフィルタリングを実行
        updateVisibleAnswers(newFilterSettings)
      }
    },
    [filterSettings, setSelectedAnswers, updateVisibleAnswers],
  )

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
