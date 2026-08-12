import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import type { WhitenessByAnswerId } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useAnswerWhiteness"
import type {
  AnswerSortOrder,
  CropRegionWithExamPage,
  GradingMode,
  MasterGridItem,
  ScoringData,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"
import { findQuestionScore } from "@/components/exams/07-score-at-once/types"
import type { ExamWithPages } from "@/types/prismaExtensions"
import type { SerializedQuestionScore } from "@/types/prismaExtensions"
import { toScoringStatus } from "@/types/scoringStatus.types"

/** 該当なしのときに毎回新しい配列を作らないための空値 */
const EMPTY_VISIBLE_ANSWERS: string[] = []

const areArraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

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
  cropRegions: CropRegionWithExamPage[]
  currentCropRegionId: string | null
  questionScores: SerializedQuestionScore[]
  selectedStudentAnswerImageIds: Set<string>
  setSelectedPageImageIds: (answers: Set<string>) => void
  exam: ExamWithPages | null
  gradingMode: GradingMode
  questionChangeVersion: number
  manualSelectionVersion: number
  answerSortOrder: AnswerSortOrder
  whitenessByAnswerId: WhitenessByAnswerId
}

/** 採点ステータスによるフィルタリングと表示対象の答案リスト管理を行うフック */
export function useScoringFilter({
  studentAnswerImages,
  cropRegions,
  currentCropRegionId,
  questionScores,
  selectedStudentAnswerImageIds,
  setSelectedPageImageIds,
  exam,
  gradingMode,
  questionChangeVersion,
  manualSelectionVersion,
  answerSortOrder,
  whitenessByAnswerId,
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

  const allScoringData = useMemo((): ScoringData[] => {
    if (!currentCropRegion) return []

    const pageFilteredSheets = studentAnswerImages.filter(
      (pageImage) => pageImage.examPageId === currentCropRegion.examPageId
    )

    const sortedAnswerSheets = [...pageFilteredSheets].sort(
      (sheetA, sheetB) => {
        const aOrder = sheetA.examStudent.customOrder ?? 999999
        const bOrder = sheetB.examStudent.customOrder ?? 999999

        if (aOrder === bOrder) {
          const studentA = sheetA.examStudent.student
          const studentB = sheetB.examStudent.student
          const aName = `${studentA.lastName}${studentA.firstName}`
          const bName = `${studentB.lastName}${studentB.firstName}`
          return aName.localeCompare(bName, "ja")
        }

        return aOrder - bOrder
      }
    )

    const studentScoringData: ScoringData[] = sortedAnswerSheets.map(
      (pageImage) => {
        const score = findQuestionScore(
          questionScores,
          pageImage.examStudentId,
          currentCropRegion.id
        )
        const { student } = pageImage.examStudent

        return {
          id: pageImage.id,
          examStudentId: pageImage.examStudentId,
          studentName: `${student.lastName} ${student.firstName}`,
          imageUrl: pageImage.imagePath
            ? `appimg:///${pageImage.imagePath}`
            : "",
          currentScore:
            score?.partialScore !== undefined && score?.partialScore !== null
              ? Number(score.partialScore)
              : undefined,
          maxScore: currentCropRegion.points ?? 0,
          status: toScoringStatus(score?.status),
          questionRegion: currentCropRegion,
          customOrder: pageImage.examStudent.customOrder ?? 999999,
        }
      }
    )

    // 白さ順・濃さ順（一覧表示のみ）。並べる基準は平均輝度のみで、閾値は持たない
    // （実採点データの「無答」を正解として比較した結果に基づく。
    //   詳細は electron-src/lib/scoring/regionWhiteness.ts の冒頭コメント）。
    // sortは安定なので、輝度が同値の答案は直前の表示順（customOrder）のまま残る。
    // 白さが未算出の答案は、どちらの向きでも末尾へ送る。
    if (
      gradingMode === "grid" &&
      (answerSortOrder === "whiteness" || answerSortOrder === "darkness")
    ) {
      const cropRegionId = currentCropRegion.id
      // 濃さ順は白さ順の逆向き
      const direction = answerSortOrder === "darkness" ? -1 : 1

      studentScoringData.sort((scoringDataA, scoringDataB) => {
        const whitenessA = whitenessByAnswerId
          .get(scoringDataA.id)
          ?.get(cropRegionId)
        const whitenessB = whitenessByAnswerId
          .get(scoringDataB.id)
          ?.get(cropRegionId)

        if (!whitenessA && !whitenessB) return 0
        if (!whitenessA) return 1
        if (!whitenessB) return -1

        return direction * (whitenessB.meanLuminance - whitenessA.meanLuminance)
      })
    }

    return studentScoringData
  }, [
    currentCropRegion,
    studentAnswerImages,
    questionScores,
    gradingMode,
    answerSortOrder,
    whitenessByAnswerId,
  ])

  /**
   * 表示する答案と、選択の引き継ぎ材料を1つの派生値として組み立てる。
   *
   * ここは取得ではなく**絞り込みの結果**なので state に置かない（置くと絞りの
   * 変更・採点履歴の変更のたびに「更新しに行く」呼び出しを書く必要があり、
   * 呼び忘れた経路だけ古い一覧が残る）。
   */
  const derivedVisible = useMemo(() => {
    if (!currentCropRegion) {
      return {
        visibleAnswers: EMPTY_VISIBLE_ANSWERS,
        firstStudentAnswerId: null as string | null,
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
  ])

  // 中身が同じでも配列の同一性は変わり得るが、下流は areArraysEqual で
  // 中身を比べているので取りこぼさない
  const visibleAnswers = derivedVisible.visibleAnswers

  /**
   * 選択の引き継ぎ材料を下流の effect へ渡す。
   * 設問が変わったフレームでは前の設問の選択を持ち越さない（選択は設問ごとに
   * 意味が違うので、引き継ぐと別の生徒が選ばれたまま見える）。
   *
   * 下流の effect より先に書く必要があるので、この位置の layout effect で行う。
   */
  useLayoutEffect(() => {
    const questionVersionChanged =
      questionChangeVersionRef.current !== null &&
      questionChangeVersionRef.current !== questionChangeVersion
    if (questionChangeVersionRef.current === null) {
      questionChangeVersionRef.current = questionChangeVersion
    }

    const filteredSelection = questionVersionChanged
      ? EMPTY_VISIBLE_ANSWERS
      : derivedVisible.filteredSelection

    selectionSnapshotVersionRef.current += 1
    pendingSelectionSnapshotRef.current = {
      firstStudentAnswerId: derivedVisible.firstStudentAnswerId,
      hasVisibleSelection: filteredSelection.length > 0,
      filteredSelection,
      version: selectionSnapshotVersionRef.current,
    }

    if (questionVersionChanged) {
      questionChangeVersionRef.current = questionChangeVersion
    }
  }, [derivedVisible, questionChangeVersion])

  const prevGradingModeRef = useRef<GradingMode>(gradingMode)
  const prevCropRegionIdRef = useRef<string | null>(currentCropRegionId)
  const pendingGridSelectionRef = useRef(false)
  const lastVisibleAnswersRef = useRef<string[]>(visibleAnswers)
  const pendingSelectionSnapshotRef = useRef<{
    firstStudentAnswerId: string | null
    hasVisibleSelection: boolean
    filteredSelection: string[]
    version: number
  } | null>(null)
  const selectionSnapshotVersionRef = useRef(0)
  const consumedSnapshotVersionRef = useRef(0)
  const manualSelectionVersionRef = useRef(manualSelectionVersion)
  const questionChangeVersionRef = useRef<number | null>(null)
  const visibleAnswersRef = useRef(visibleAnswers)

  // visibleAnswersの最新値を追跡
  useLayoutEffect(() => {
    visibleAnswersRef.current = visibleAnswers
  }, [visibleAnswers])

  useEffect(() => {
    const manualSelectionChanged =
      manualSelectionVersionRef.current !== manualSelectionVersion

    manualSelectionVersionRef.current = manualSelectionVersion

    if (manualSelectionChanged) {
      pendingGridSelectionRef.current = false
      return
    }

    if (selectedStudentAnswerImageIds.size > 1) {
      pendingGridSelectionRef.current = false
      return
    }

    const previousMode = prevGradingModeRef.current
    const previousCropRegionId = prevCropRegionIdRef.current

    const modeChangedToGrid = previousMode !== "grid" && gradingMode === "grid"
    const cropRegionChanged = previousCropRegionId !== currentCropRegionId

    const visibleChanged = !areArraysEqual(
      visibleAnswers,
      lastVisibleAnswersRef.current
    )

    if (visibleChanged) {
      lastVisibleAnswersRef.current = visibleAnswers
    }

    if (cropRegionChanged && !visibleChanged) {
      prevGradingModeRef.current = gradingMode
      prevCropRegionIdRef.current = currentCropRegionId
      return
    }

    if (modeChangedToGrid || cropRegionChanged || visibleChanged) {
      pendingGridSelectionRef.current = true
    }

    prevGradingModeRef.current = gradingMode
    prevCropRegionIdRef.current = currentCropRegionId

    if (gradingMode !== "grid") {
      return
    }

    const snapshot = pendingSelectionSnapshotRef.current
    const hasFreshSnapshot = snapshot
      ? snapshot.version > consumedSnapshotVersionRef.current
      : false
    const visibleIds = new Set(visibleAnswers)
    const filteredSelection =
      hasFreshSnapshot && snapshot?.filteredSelection
        ? snapshot.filteredSelection
        : Array.from(selectedStudentAnswerImageIds).filter(
            (id) => visibleIds.has(id) && !id.startsWith("master-")
          )
    const firstStudentAnswerId =
      hasFreshSnapshot && snapshot?.firstStudentAnswerId
        ? snapshot.firstStudentAnswerId
        : (visibleAnswers.find((id) => !id.startsWith("master-")) ?? null)

    if (pendingGridSelectionRef.current) {
      const shouldApplySelection =
        modeChangedToGrid ||
        cropRegionChanged ||
        visibleChanged ||
        visibleAnswers.length === 0

      if (shouldApplySelection) {
        if (cropRegionChanged) {
          if (visibleAnswers.length === 0 || !firstStudentAnswerId) {
            if (selectedStudentAnswerImageIds.size > 0) {
              setSelectedPageImageIds(new Set())
            }
            pendingGridSelectionRef.current = false
            return
          }

          if (
            selectedStudentAnswerImageIds.size !== 1 ||
            !selectedStudentAnswerImageIds.has(firstStudentAnswerId)
          ) {
            setSelectedPageImageIds(new Set([firstStudentAnswerId]))
          }
          pendingGridSelectionRef.current = false
          return
        }

        const hasVisibleSelection =
          hasFreshSnapshot && snapshot?.hasVisibleSelection
            ? snapshot.hasVisibleSelection
            : filteredSelection.length > 0

        if (hasVisibleSelection) {
          if (filteredSelection.length !== selectedStudentAnswerImageIds.size) {
            setSelectedPageImageIds(new Set(filteredSelection))
          }
          pendingGridSelectionRef.current = false
          if (hasFreshSnapshot && snapshot) {
            consumedSnapshotVersionRef.current = snapshot.version
          }
          return
        }

        if (visibleAnswers.length === 0 || !firstStudentAnswerId) {
          if (selectedStudentAnswerImageIds.size > 0) {
            setSelectedPageImageIds(new Set())
          }
          if (visibleAnswers.length > 0) {
            pendingGridSelectionRef.current = false
          }
          if (hasFreshSnapshot && snapshot) {
            consumedSnapshotVersionRef.current = snapshot.version
          }
          return
        }

        if (
          selectedStudentAnswerImageIds.size !== 1 ||
          !selectedStudentAnswerImageIds.has(firstStudentAnswerId)
        ) {
          setSelectedPageImageIds(new Set([firstStudentAnswerId]))
        }
        pendingGridSelectionRef.current = false
        if (hasFreshSnapshot && snapshot) {
          consumedSnapshotVersionRef.current = snapshot.version
        }
        return
      }
    }
  }, [
    currentCropRegionId,
    gradingMode,
    selectedStudentAnswerImageIds,
    setSelectedPageImageIds,
    visibleAnswers,
    manualSelectionVersion,
  ])

  // フィルター変更時のスクロール処理用ref（選択変更では発火しない）
  const prevVisibleAnswersRef = useRef<string[]>(visibleAnswers)

  useEffect(() => {
    // visibleAnswersが変わっていない場合はスキップ（選択変更のみの場合）
    const prevVisible = prevVisibleAnswersRef.current
    const visibleChanged =
      prevVisible.length !== visibleAnswers.length ||
      prevVisible.some((id, i) => id !== visibleAnswers[i])
    prevVisibleAnswersRef.current = visibleAnswers

    if (!visibleChanged) {
      return
    }

    if (gradingMode !== "grid") {
      return
    }

    if (selectedStudentAnswerImageIds.size === 0) {
      return
    }

    const snapshot = pendingSelectionSnapshotRef.current
    const hasFreshSnapshot = snapshot
      ? snapshot.version > consumedSnapshotVersionRef.current
      : false
    const visibleIds = new Set(visibleAnswers)
    const firstCandidateId =
      hasFreshSnapshot && snapshot?.filteredSelection?.length
        ? snapshot.filteredSelection[0]
        : undefined
    const firstVisibleSelected = firstCandidateId
      ? firstCandidateId
      : Array.from(selectedStudentAnswerImageIds).find((id) =>
          visibleIds.has(id)
        )

    if (!firstVisibleSelected) {
      return
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("score-view:scroll-to-answer", {
          detail: { answerId: firstVisibleSelected },
        })
      )
    }
  }, [gradingMode, selectedStudentAnswerImageIds, visibleAnswers])

  // 設問変更時の選択処理用のref
  const questionChangeVersionForSelectionRef = useRef(questionChangeVersion)

  // 設問変更時の選択処理（グリッドモード専用）
  useEffect(() => {
    // バージョンが変わっていなければスキップ（初回も含む）
    if (
      questionChangeVersionForSelectionRef.current === questionChangeVersion
    ) {
      return
    }
    questionChangeVersionForSelectionRef.current = questionChangeVersion

    // 個別モードでは選択処理は行わない（生徒は移動しない）
    if (gradingMode !== "grid") return

    // setTimeout(0)で全ての状態更新がコミットされた後に実行
    // visibleAnswersの更新を待つ必要があるため
    const timeoutId = setTimeout(() => {
      const currentVisible = visibleAnswersRef.current
      const firstStudentAnswerId = currentVisible.find(
        (id) => !id.startsWith("master-")
      )

      if (firstStudentAnswerId) {
        setSelectedPageImageIds(new Set([firstStudentAnswerId]))
      } else {
        setSelectedPageImageIds(new Set())
      }
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [questionChangeVersion, gradingMode, setSelectedPageImageIds])

  const masterAnswerData = useMemo((): MasterGridItem | null => {
    if (!currentCropRegion || !exam?.examPages) return null

    const examPage = exam.examPages.find(
      (page) => page.id === currentCropRegion.examPageId
    )

    if (!examPage) return null

    const masterImagePath = examPage.imagePath

    return {
      id: `master-${currentCropRegion.id}`,
      examStudentId: "MASTER",
      studentName: "模範解答",
      imageUrl: masterImagePath ? `appimg:///${masterImagePath}` : "",
      maxScore: currentCropRegion.points || 0,
      status: "master",
      questionRegion: currentCropRegion,
      customOrder: -1,
      isMaster: true,
    }
  }, [currentCropRegion, exam])

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
