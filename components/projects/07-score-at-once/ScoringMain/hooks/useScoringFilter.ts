import { DEFAULT_SHORTCUTS } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringKeyboard"
import type {
  CropRegionWithProjectPage,
  PageImageWithProjectStudents,
  QuestionScore,
  ScoringData,
  ScoringStatus,
} from "@/components/projects/07-score-at-once/types"
import { findQuestionScore } from "@/components/projects/07-score-at-once/types"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

interface FilterSettings {
  unscored: boolean
  correct: boolean
  incorrect: boolean
  partial: boolean
  pending: boolean
  no_answer: boolean
}

interface UseScoringFilterProps {
  pageImages: PageImageWithProjectStudents[]
  cropRegions: CropRegionWithProjectPage[]
  currentCropRegionId: string | null
  questionScores: QuestionScore[]
  selectedPageImageIds: Set<string>
  setSelectedPageImageIds: (answers: Set<string>) => void
  project: any
}

export function useScoringFilter({
  pageImages,
  cropRegions,
  currentCropRegionId,
  questionScores,
  selectedPageImageIds,
  setSelectedPageImageIds,
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

  const [visibleAnswers, setVisibleAnswers] = useState<string[]>([])
  const [recentlyScoredAnswers, setRecentlyScoredAnswers] = useState<
    Set<string>
  >(new Set())

  const currentCropRegion = cropRegions.find(
    (r) => r.id === currentCropRegionId,
  )

  // 採点状況を取得する関数
  const getScoringStatus = useCallback(
    (studentId: string, questionId?: string): ScoringStatus => {
      if (!questionId) return "unscored"

      const score = findQuestionScore(questionScores, studentId, questionId)
      return (score?.status as ScoringStatus) ?? "unscored"
    },
    [questionScores],
  )

  // 表示対象答案の更新（統合版）
  const updateVisibleAnswers = useCallback(
    (customFilterSettings?: FilterSettings) => {
      const activeFilterSettings = customFilterSettings || filterSettings

      if (!currentCropRegion) {
        setVisibleAnswers([])
        return
      }

      console.log('🔍 Filter debug - Active filter settings:', activeFilterSettings)
      console.log('🔍 Filter debug - Current crop region:', currentCropRegion.id)
      console.log('🔍 Filter debug - Total page images:', pageImages.length)

      // allScoringData（既にソート済み）からフィルタリングして順序を保持
      const newVisibleAnswers = allScoringData
        .filter((scoringData) => {
          const status = scoringData.status
          const matchesFilter = activeFilterSettings[status as keyof typeof activeFilterSettings]
          const isRecentlyScored = recentlyScoredAnswers.has(scoringData.id)
          
          // フィルター条件チェック（最近採点答案は強制表示）
          return matchesFilter || isRecentlyScored
        })
        .map(scoringData => scoringData.id) // IDの配列として順序を保持

      console.log('🔍 Filter debug - Filtered results:', newVisibleAnswers)
      console.log('🔍 Filter debug - Visible answer count:', newVisibleAnswers.length)

      setVisibleAnswers(newVisibleAnswers)
    },
    [
      pageImages,
      currentCropRegion,
      filterSettings,
      questionScores,
      recentlyScoredAnswers,
    ],
  )

  // 初期化時と設問変更時に表示対象を設定（選択は別のuseEffectで管理）
  useEffect(() => {
    if (pageImages.length > 0 && cropRegions.length > 0) {
      // 表示対象を更新（選択はクリアしない）
      updateVisibleAnswers()
    }
  }, [
    pageImages.length,
    cropRegions.length,
    currentCropRegionId,
    updateVisibleAnswers,
  ])

  // 選択状態の管理用ref
  const selectedPageImageIdsRef = useRef<Set<string>>(new Set())
  const lastVisibleAnswersRef = useRef<Set<string>>(new Set())

  // selectedPageImageIdsが変更されたらrefも更新
  useEffect(() => {
    selectedPageImageIdsRef.current = selectedPageImageIds
  }, [selectedPageImageIds])

  // visibleAnswersが更新されたら適切な答案選択を行う（最適化版）
  useEffect(() => {
    console.log('🔍 Selection debug - visibleAnswers changed:', {
      newSize: visibleAnswers.length,
      oldSize: lastVisibleAnswersRef.current.size,
      newIds: visibleAnswers,
      currentSelection: Array.from(selectedPageImageIdsRef.current)
    })

    // visibleAnswersに変化がない場合はスキップ（パフォーマンス向上）
    if (visibleAnswers.length === lastVisibleAnswersRef.current.size) {
      let hasChanged = false
      for (const id of visibleAnswers) {
        if (!lastVisibleAnswersRef.current.has(id)) {
          hasChanged = true
          break
        }
      }
      if (!hasChanged) {
        console.log('🔍 Selection debug - No changes in visibleAnswers, skipping')
        return
      }
    }

    // 最新のvisibleAnswersを記録
    lastVisibleAnswersRef.current = new Set(visibleAnswers)

    // 早期リターンで不要な処理をスキップ
    if (visibleAnswers.length === 0) {
      console.log('🔍 Selection debug - No visible answers, returning')
      return
    }

    // 現在の選択状態をrefから取得（最新の状態）
    const currentSelection = selectedPageImageIdsRef.current
    if (currentSelection.size > 0) {
      // 高速な有効性チェック（Set.hasは高速）
      for (const selectedId of currentSelection) {
        if (visibleAnswers.includes(selectedId)) {
          console.log('🔍 Selection debug - Current selection is still valid:', selectedId)
          return // 有効な選択があるので処理終了
        }
      }
    }

    // 選択が空か無効な場合のみ、最初の学生答案を選択
    console.log('🔍 Selection debug - Need to select first student answer')
    const visibleAnswersArray = Array.from(visibleAnswers)
    console.log('🔍 Selection debug - Visible answers array:', visibleAnswersArray)
    
    for (const answerId of visibleAnswers) {
      if (!answerId.startsWith("master-")) {
        console.log('🔍 Selection debug - Selecting first student answer:', answerId)
        setSelectedPageImageIds(new Set([answerId]))
        return // 見つかったらすぐ終了
      }
    }
  }, [visibleAnswers, setSelectedPageImageIds])

  // 模範解答データを取得（Grid表示用）
  const getMasterAnswerData = useCallback((): any | null => {
    if (!currentCropRegion || !project?.projectPages) return null

    // projectPageIdに基づいてprojectPageを取得
    const projectPage = project.projectPages.find(
      (page: any) => page.id === currentCropRegion.projectPageId,
    )

    if (!projectPage) return null

    const masterImage = projectPage.pageImages?.find(
      (img: any) => img.imageType === "MODEL_ANSWER",
    )
    const masterImagePath = masterImage?.imagePath

    return {
      id: `master-${currentCropRegion.id}`,
      studentId: "MASTER",
      studentName: "模範解答",
      imageUrl: masterImagePath ? `appimg://${masterImagePath}` : "",
      currentScore: undefined,
      maxScore: currentCropRegion.points || 0,
      status: "master" as any, // 特別なステータス
      questionRegion: currentCropRegion, // 採点領域情報を追加
      isMaster: true, // 模範解答フラグ
    }
  }, [currentCropRegion, project?.projectPages])

  // 全採点データを取得（新しいScoringData型として）
  const allScoringData = useMemo((): ScoringData[] => {
    if (!currentCropRegion) return []

    // projectPageIdでフィルタリングしてから受験生徒順でソート
    const pageFilteredSheets = pageImages.filter(
      (pageImage) =>
        pageImage.projectPageId === currentCropRegion.projectPageId,
    )

    console.log('🔍 Student ordering debug - Before sorting:', pageFilteredSheets.map((sheet, index) => ({
      index,
      id: sheet.id,
      studentName: `${sheet.student?.lastName ?? ""} ${sheet.student?.firstName ?? ""}`,
      studentId: sheet.student?.studentId,
      customOrder: sheet.student?.projectStudents?.[0]?.customOrder,
      hasProjectStudents: (sheet.student?.projectStudents?.length ?? 0) > 0,
      projectStudentsLength: sheet.student?.projectStudents?.length ?? 0,
      allProjectStudents: sheet.student?.projectStudents ?? [],
      studentData: sheet.student
    })))

    const sortedAnswerSheets = [...pageFilteredSheets].sort((a, b) => {
      // ProjectStudentのcustomOrderで並び替え（小さい値が先）
      // customOrderが未定義の場合は、学籍番号の数値として比較
      const aOrder =
        a.student?.projectStudents?.[0]?.customOrder !== undefined
          ? a.student.projectStudents[0].customOrder
          : 999999
      const bOrder =
        b.student?.projectStudents?.[0]?.customOrder !== undefined
          ? b.student.projectStudents[0].customOrder
          : 999999

      // customOrderが同じ場合は姓名でソート
      if (aOrder === bOrder) {
        const aName = `${a.student?.lastName ?? ""}${a.student?.firstName ?? ""}`
        const bName = `${b.student?.lastName ?? ""}${b.student?.firstName ?? ""}`
        return aName.localeCompare(bName, "ja")
      }

      const sortResult = (aOrder || 0) - (bOrder || 0)
      
      console.log('🔍 Sorting comparison:', {
        a: `${a.student?.lastName} ${a.student?.firstName}`,
        aOrder,
        b: `${b.student?.lastName} ${b.student?.firstName}`,
        bOrder,
        result: sortResult
      })
      
      return sortResult
    })

    console.log('🔍 Student ordering debug - After sorting:', sortedAnswerSheets.map((sheet, index) => ({
      index,
      id: sheet.id,
      studentName: `${sheet.student?.lastName ?? ""} ${sheet.student?.firstName ?? ""}`,
      studentId: sheet.student?.studentId,
      customOrder: sheet.student?.projectStudents?.[0]?.customOrder
    })))

    const studentScoringData: ScoringData[] = sortedAnswerSheets.map(
      (pageImage) => {
        if (!pageImage.studentId) {
          // studentIdがnullの場合のデフォルトデータ
          return {
            id: pageImage.id,
            studentId: "",
            studentName: "不明",
            imageUrl: pageImage.imagePath
              ? `appimg://${pageImage.imagePath}`
              : "",
            currentScore: undefined,
            maxScore: currentCropRegion.points ?? 0,
            status: "unscored" as ScoringStatus,
            questionRegion: currentCropRegion,
            customOrder: 999999, // 不明な生徒は最後に配置
          }
        }

        const score = findQuestionScore(
          questionScores,
          pageImage.studentId,
          currentCropRegion.id,
        )

        return {
          id: pageImage.id,
          studentId: pageImage.studentId, // Student.id (UUID) を使用
          studentName: `${pageImage.student?.lastName ?? ""} ${pageImage.student?.firstName ?? ""}`,
          imageUrl: pageImage.imagePath
            ? `appimg://${pageImage.imagePath}`
            : "",
          currentScore: score?.partialScore
            ? Number(score.partialScore)
            : undefined,
          maxScore: currentCropRegion.points ?? 0,
          status: (score?.status as ScoringStatus) ?? "unscored",
          questionRegion: currentCropRegion, // 採点領域情報を追加
          customOrder: pageImage.student?.projectStudents?.[0]?.customOrder || 999999, // 必須フィールド
        }
      },
    )

    // 学生の採点データのみを返す（模範解答は別途管理）
    return studentScoringData
  }, [currentCropRegion, pageImages, questionScores])

  // 基本的なグリッドデータ取得（後方互換性のため残す）
  const getAllGridAnswerData = useMemo(() => {
    return allScoringData.map((data) => ({
      ...data,
      isSelected: selectedPageImageIds.has(data.id),
    }))
  }, [allScoringData, selectedPageImageIds])

  // 表示用のグリッドデータ（学生データのみをフィルタリング）
  const getGridAnswerData = useCallback(() => {
    // allScoringDataの順序を保持したまま、visibleAnswersの順序でフィルタリング
    const filteredAnswers = visibleAnswers
      .map(answerId => getAllGridAnswerData.find(answer => answer.id === answerId))
      .filter(Boolean) // undefinedを除外

    // デバッグ: フィルタリング後の順序をログ出力
    console.log('🔍 getGridAnswerData - Filtered order (preserving allScoringData order):', filteredAnswers.map((answer, index) => ({
      index,
      id: answer?.id,
      studentName: answer?.studentName,
      fromVisibleAnswersIndex: answer?.id ? visibleAnswers.indexOf(answer.id) : -1
    })))

    return filteredAnswers
  }, [getAllGridAnswerData, visibleAnswers])

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
    masterAnswerData: getMasterAnswerData(), // Grid表示用の模範解答データ
    filteredScoringDataIds: visibleAnswers,
    selectedScoringDataIds: selectedPageImageIds,

    // 従来の互換性維持
    filterSettings,
    setFilterSettings,
    visibleAnswers,
    recentlyScoredAnswers,
    setRecentlyScoredAnswers,
    getAllGridAnswerData,
    getGridAnswerData,
    handleRefreshFilter,
    handleToggleFilter,
    handleToggleFilterByScoreKey,
    getScoringStatus,
  }
}
