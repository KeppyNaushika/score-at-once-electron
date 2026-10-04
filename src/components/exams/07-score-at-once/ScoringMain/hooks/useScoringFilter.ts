import { useCallback, useMemo, useState } from "react"

import type { WhitenessByAnswerId } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useAnswerWhiteness"
import type {
  AnswerSortOrder,
  GradingMode,
  ScoringData,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { QuestionScoreRow } from "@/queries/scoring"
import type { ExamWithPages } from "@/types/prismaExtensions"

import {
  useGridSelectionSync,
  type VisibleAnswersDerivation,
} from "./useGridSelectionSync"
import { useQuestionScoringData } from "./useQuestionScoringData"

/** 該当なしのときに毎回新しい配列を作らないための空値 */
const EMPTY_VISIBLE_ANSWERS: string[] = []

interface FilterSettings {
  unscored: boolean
  correct: boolean
  incorrect: boolean
  partial: boolean
  pending: boolean
  no_answer: boolean
  double_mark: boolean
}

interface UseScoringFilterProps {
  studentAnswerImages: StudentAnswerImageWithExamStudents[]
  cropRegions: QuestionAnswerRegionRow[]
  questionScoresByCropRegionId: Map<string, QuestionScoreRow[]>
  currentCropRegionId: string | null
  currentUserId: string
  selectedStudentAnswerImageIds: Set<string>
  setSelectedPageImageIds: (answers: Set<string>) => void
  exam: ExamWithPages | null
  gradingMode: GradingMode
  questionChangeVersion: number
  manualSelectionVersion: number
  answerSortOrder: AnswerSortOrder
  whitenessByAnswerId: WhitenessByAnswerId
  /** 白さ順・濃さ順で、並べる材料の算出をまだ待っているか */
  isWhitenessPending: boolean
}

/** 採点ステータスによるフィルタリングと表示対象の答案リスト管理を行うフック */
export function useScoringFilter({
  studentAnswerImages,
  cropRegions,
  questionScoresByCropRegionId,
  currentCropRegionId,
  currentUserId,
  selectedStudentAnswerImageIds,
  setSelectedPageImageIds,
  exam,
  gradingMode,
  questionChangeVersion,
  manualSelectionVersion,
  answerSortOrder,
  whitenessByAnswerId,
  isWhitenessPending,
}: UseScoringFilterProps) {
  const [filterSettings, setFilterSettings] = useState<FilterSettings>({
    unscored: true,
    correct: false,
    incorrect: false,
    partial: false,
    pending: false,
    no_answer: false,
    double_mark: false,
  })

  // 設問ごとに採点履歴を管理（設問IDをキーとするMap）
  // これにより設問変更時に明示的なクリア処理が不要になる
  const [recentlyScoredAnswersByQuestion, setRecentlyScoredAnswersByQuestion] =
    useState<Map<string, Set<string>>>(new Map())

  const currentCropRegion = cropRegions.find(
    (cropRegion) => cropRegion.id === currentCropRegionId
  )

  // 現在の設問の採点履歴を取得（外部インターフェース互換）
  const recentlyScoredAnswers = useMemo(() => {
    if (!currentCropRegionId) return new Set<string>()
    return recentlyScoredAnswersByQuestion.get(currentCropRegionId) ?? new Set()
  }, [recentlyScoredAnswersByQuestion, currentCropRegionId])

  // 現在の設問の採点履歴を更新する関数（外部インターフェース互換）
  const setRecentlyScoredAnswers = useCallback(
    (update: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      if (!currentCropRegionId) return
      setRecentlyScoredAnswersByQuestion((prevMap) => {
        const currentSet = prevMap.get(currentCropRegionId) ?? new Set()
        const newSet =
          typeof update === "function" ? update(currentSet) : update
        const newMap = new Map(prevMap)
        newMap.set(currentCropRegionId, newSet)
        return newMap
      })
    },
    [currentCropRegionId]
  )

  const { allScoringData, masterAnswerData } = useQuestionScoringData({
    currentCropRegion,
    studentAnswerImages,
    questionScoresByCropRegionId,
    currentUserId,
    exam,
    gradingMode,
    answerSortOrder,
    whitenessByAnswerId,
  })

  /**
   * 表示する答案と、選択の引き継ぎ材料を1つの派生値として組み立てる。
   *
   * ここは取得ではなく**絞り込みの結果**なので state に置かない（置くと絞りの
   * 変更・採点履歴の変更のたびに「更新しに行く」呼び出しを書く必要があり、
   * 呼び忘れた経路だけ古い一覧が残る）。
   */
  const derivedVisible = useMemo((): VisibleAnswersDerivation => {
    // 白さ順・濃さ順は、材料が揃うまで表示対象を持たない。表示順で並べて見せて
    // おくと、算出が終わった瞬間に並びが総入れ替えになり、見ていた答案と操作の
    // 対象がずれる（ドラッグ選択は範囲の顔ぶれごと変わる）。ここを空にすると
    // 下流の 0 件の経路が選択も畳むので、算出待ちの間は誰も選ばれない。
    if (!currentCropRegion || isWhitenessPending) {
      return {
        visibleAnswers: EMPTY_VISIBLE_ANSWERS,
        firstStudentAnswerId: null,
        filteredSelection: EMPTY_VISIBLE_ANSWERS,
      }
    }

    const visibleAnswers: string[] = []
    let firstStudentAnswerId: string | null = null
    const filteredSelection: string[] = []

    for (const scoringData of allScoringData) {
      const status = scoringData.status
      const matchesFilter =
        filterSettings[status as keyof typeof filterSettings]
      // 設問ごとに採点履歴が管理されているため、現在の設問の履歴のみが参照される
      const isRecentlyScored = recentlyScoredAnswers.has(scoringData.id)

      if (matchesFilter || isRecentlyScored) {
        visibleAnswers.push(scoringData.id)

        if (!scoringData.id.startsWith("master-") && !firstStudentAnswerId) {
          firstStudentAnswerId = scoringData.id
        }

        if (selectedStudentAnswerImageIds.has(scoringData.id)) {
          filteredSelection.push(scoringData.id)
        }
      }
    }

    return { visibleAnswers, firstStudentAnswerId, filteredSelection }
  }, [
    filterSettings,
    currentCropRegion,
    allScoringData,
    recentlyScoredAnswers,
    selectedStudentAnswerImageIds,
    isWhitenessPending,
  ])

  // 中身が同じでも配列の同一性は変わり得るが、下流は areArraysEqual で
  // 中身を比べているので取りこぼさない
  const visibleAnswers = derivedVisible.visibleAnswers

  // 一覧の選択を、表示する答案の入れ替わりに追従させる
  useGridSelectionSync({
    derivedVisible,
    currentCropRegionId,
    gradingMode,
    questionChangeVersion,
    manualSelectionVersion,
    selectedStudentAnswerImageIds,
    setSelectedPageImageIds,
  })

  const getAllGridAnswerData = useMemo(() => {
    return allScoringData.map((data) => ({
      ...data,
      isSelected: selectedStudentAnswerImageIds.has(data.id),
    }))
  }, [allScoringData, selectedStudentAnswerImageIds])

  const getGridAnswerData = useCallback((): (ScoringData & {
    isSelected: boolean
  })[] => {
    const answerById = new Map(
      getAllGridAnswerData.map((answer) => [answer.id, answer])
    )
    return visibleAnswers
      .map((answerId) => answerById.get(answerId))
      .filter(
        (answer): answer is ScoringData & { isSelected: boolean } =>
          answer !== undefined
      )
  }, [getAllGridAnswerData, visibleAnswers])

  // 採点履歴を捨てると一覧は自動で組み直る（派生値なので更新の呼び出しは要らない）
  const handleRefreshFilter = useCallback(() => {
    setRecentlyScoredAnswers(new Set())
  }, [setRecentlyScoredAnswers])

  const handleToggleFilter = useCallback(
    (key: string) => {
      if (key in filterSettings) {
        const newFilterSettings = {
          ...filterSettings,
          [key]: !filterSettings[key as keyof typeof filterSettings],
        }
        setFilterSettings(newFilterSettings)
        setRecentlyScoredAnswers(new Set())
      }
    },
    [filterSettings, setRecentlyScoredAnswers]
  )

  return {
    allScoringData,
    masterAnswerData,
    filteredScoringDataIds: visibleAnswers,
    selectedScoringDataIds: selectedStudentAnswerImageIds,

    filterSettings,
    visibleAnswers,
    setRecentlyScoredAnswers,
    getGridAnswerData,
    handleRefreshFilter,
    handleToggleFilter,
  }
}
