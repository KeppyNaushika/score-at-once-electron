import { DEFAULT_KEYBINDINGS } from "@/components/projects/07-score-at-once/constants/scoring-keybindings"
import type {
  CropRegionWithProjectPage,
  GradingMode,
  MasterAnswerData,
  PageImageWithProjectStudents,
  QuestionScore,
  ScoringData,
  ScoringStatus,
} from "@/components/projects/07-score-at-once/types"
import { findQuestionScore } from "@/components/projects/07-score-at-once/types"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

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
}

interface UseScoringFilterProps {
  pageImages: PageImageWithProjectStudents[]
  cropRegions: CropRegionWithProjectPage[]
  currentCropRegionId: string | null
  questionScores: QuestionScore[]
  selectedPageImageIds: Set<string>
  setSelectedPageImageIds: (answers: Set<string>) => void
  project: any
  gradingMode: GradingMode
  questionChangeVersion: number
  manualSelectionVersion: number
}

export function useScoringFilter({
  pageImages,
  cropRegions,
  currentCropRegionId,
  questionScores,
  selectedPageImageIds,
  setSelectedPageImageIds,
  project,
  gradingMode,
  questionChangeVersion,
  manualSelectionVersion,
}: UseScoringFilterProps) {
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

  const allScoringData = useMemo((): ScoringData[] => {
    if (!currentCropRegion) return []

    const pageFilteredSheets = pageImages.filter(
      (pageImage) =>
        pageImage.projectPageId === currentCropRegion.projectPageId,
    )

    const sortedAnswerSheets = [...pageFilteredSheets].sort((a, b) => {
      const aOrder =
        a.student?.projectStudents?.[0]?.customOrder !== undefined
          ? a.student.projectStudents[0].customOrder
          : 999999
      const bOrder =
        b.student?.projectStudents?.[0]?.customOrder !== undefined
          ? b.student.projectStudents[0].customOrder
          : 999999

      if (aOrder === bOrder) {
        const aName = `${a.student?.lastName ?? ""}${a.student?.firstName ?? ""}`
        const bName = `${b.student?.lastName ?? ""}${b.student?.firstName ?? ""}`
        return aName.localeCompare(bName, "ja")
      }

      const sortResult = (aOrder || 0) - (bOrder || 0)

      return sortResult
    })

    const studentScoringData: ScoringData[] = sortedAnswerSheets.map(
      (pageImage) => {
        if (!pageImage.studentId) {
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
            customOrder: 999999,
          }
        }

        const score = findQuestionScore(
          questionScores,
          pageImage.studentId,
          currentCropRegion.id,
        )

        return {
          id: pageImage.id,
          studentId: pageImage.studentId,
          studentName: `${pageImage.student?.lastName ?? ""} ${pageImage.student?.firstName ?? ""}`,
          imageUrl: pageImage.imagePath
            ? `appimg://${pageImage.imagePath}`
            : "",
          currentScore:
            score?.partialScore !== undefined && score?.partialScore !== null
              ? Number(score.partialScore)
              : undefined,
          maxScore: currentCropRegion.points ?? 0,
          status: (score?.status as ScoringStatus) ?? "unscored",
          questionRegion: currentCropRegion,
          customOrder:
            pageImage.student?.projectStudents?.[0]?.customOrder || 999999,
        }
      },
    )

    return studentScoringData
  }, [currentCropRegion, pageImages, questionScores])

  const getScoringStatus = useCallback(
    (studentId: string, questionId?: string): ScoringStatus => {
      if (!questionId) return "unscored"

      const score = findQuestionScore(questionScores, studentId, questionId)
      return (score?.status as ScoringStatus) ?? "unscored"
    },
    [questionScores],
  )

  const updateVisibleAnswers = useCallback(
    (customFilterSettings?: FilterSettings) => {
      const activeFilterSettings = customFilterSettings || filterSettings

      if (!currentCropRegion) {
        setVisibleAnswers([])
        return
      }

      if (questionChangeVersionRef.current === null) {
        questionChangeVersionRef.current = questionChangeVersion
      }

      const nextVisibleAnswers: string[] = []
      let firstStudentAnswerId: string | null = null
      const nextFilteredSelection: string[] = []

      const questionVersionChanged =
        questionChangeVersionRef.current !== null &&
        questionChangeVersionRef.current !== questionChangeVersion

      const selectedIdsSet = questionVersionChanged
        ? new Set<string>()
        : new Set(selectedPageImageIds)

      for (const scoringData of allScoringData) {
        const status = scoringData.status
        const matchesFilter =
          activeFilterSettings[status as keyof typeof activeFilterSettings]
        const isRecentlyScored = recentlyScoredAnswers.has(scoringData.id)

        if (matchesFilter || isRecentlyScored) {
          nextVisibleAnswers.push(scoringData.id)

          if (!scoringData.id.startsWith("master-") && !firstStudentAnswerId) {
            firstStudentAnswerId = scoringData.id
          }

          if (selectedIdsSet.has(scoringData.id)) {
            nextFilteredSelection.push(scoringData.id)
          }
        }
      }

      selectionSnapshotVersionRef.current += 1
      pendingSelectionSnapshotRef.current = {
        firstStudentAnswerId,
        hasVisibleSelection: nextFilteredSelection.length > 0,
        filteredSelection: nextFilteredSelection,
        version: selectionSnapshotVersionRef.current,
      }

      if (questionVersionChanged) {
        questionChangeVersionRef.current = questionChangeVersion
      }

      setVisibleAnswers((prev) => {
        if (areArraysEqual(prev, nextVisibleAnswers)) {
          return prev
        }
        return nextVisibleAnswers
      })
    },
    [
      filterSettings,
      currentCropRegion,
      allScoringData,
      recentlyScoredAnswers,
      selectedPageImageIds,
      questionChangeVersion,
    ],
  )

  useLayoutEffect(() => {
    if (pageImages.length === 0 || cropRegions.length === 0) {
      return
    }

    const runUpdate = () => {
      updateVisibleAnswers()
    }

    if (typeof queueMicrotask === "function") {
      queueMicrotask(runUpdate)
    } else {
      Promise.resolve().then(runUpdate)
    }
  }, [
    pageImages.length,
    cropRegions.length,
    currentCropRegionId,
    updateVisibleAnswers,
  ])

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

  useEffect(() => {
    const manualSelectionChanged =
      manualSelectionVersionRef.current !== manualSelectionVersion

    manualSelectionVersionRef.current = manualSelectionVersion

    if (manualSelectionChanged) {
      pendingGridSelectionRef.current = false
      return
    }

    if (selectedPageImageIds.size > 1) {
      pendingGridSelectionRef.current = false
      return
    }

    const previousMode = prevGradingModeRef.current
    const previousCropRegionId = prevCropRegionIdRef.current

    const modeChangedToGrid = previousMode !== "grid" && gradingMode === "grid"
    const cropRegionChanged = previousCropRegionId !== currentCropRegionId

    const visibleChanged = !areArraysEqual(
      visibleAnswers,
      lastVisibleAnswersRef.current,
    )

    const questionChangedExternally =
      questionChangeVersionRef.current !== questionChangeVersion

    if (visibleChanged) {
      lastVisibleAnswersRef.current = visibleAnswers
    }

    if (questionChangedExternally) {
      pendingGridSelectionRef.current = true
    }

    if ((cropRegionChanged || questionChangedExternally) && !visibleChanged) {
      prevGradingModeRef.current = gradingMode
      prevCropRegionIdRef.current = currentCropRegionId
      return
    }

    if (
      modeChangedToGrid ||
      cropRegionChanged ||
      visibleChanged ||
      questionChangedExternally
    ) {
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
    const filteredSelection = questionChangedExternally
      ? []
      : hasFreshSnapshot && snapshot?.filteredSelection
        ? snapshot.filteredSelection
        : Array.from(selectedPageImageIds).filter(
            (id) => visibleIds.has(id) && !id.startsWith("master-"),
          )
    const firstStudentAnswerId =
      questionChangedExternally && visibleAnswers.length > 0
        ? (visibleAnswers.find((id) => !id.startsWith("master-")) ?? null)
        : hasFreshSnapshot && snapshot?.firstStudentAnswerId
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
            if (selectedPageImageIds.size > 0) {
              setSelectedPageImageIds(new Set())
            }
            pendingGridSelectionRef.current = false
            return
          }

          if (
            selectedPageImageIds.size !== 1 ||
            !selectedPageImageIds.has(firstStudentAnswerId)
          ) {
            setSelectedPageImageIds(new Set([firstStudentAnswerId]))
          }
          pendingGridSelectionRef.current = false
          return
        }

        const hasVisibleSelection = questionChangedExternally
          ? false
          : hasFreshSnapshot && snapshot?.hasVisibleSelection
            ? snapshot.hasVisibleSelection
            : filteredSelection.length > 0

        if (hasVisibleSelection) {
          if (filteredSelection.length !== selectedPageImageIds.size) {
            setSelectedPageImageIds(new Set(filteredSelection))
          }
          pendingGridSelectionRef.current = false
          if (hasFreshSnapshot && snapshot) {
            consumedSnapshotVersionRef.current = snapshot.version
          }
          return
        }

        if (visibleAnswers.length === 0 || !firstStudentAnswerId) {
          if (selectedPageImageIds.size > 0) {
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
          selectedPageImageIds.size !== 1 ||
          !selectedPageImageIds.has(firstStudentAnswerId)
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
    questionChangeVersion,
    selectedPageImageIds,
    setSelectedPageImageIds,
    visibleAnswers,
    manualSelectionVersion,
  ])

  useEffect(() => {
    if (gradingMode !== "grid") {
      return
    }

    if (selectedPageImageIds.size === 0) {
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
      : Array.from(selectedPageImageIds).find((id) => visibleIds.has(id))

    if (!firstVisibleSelected) {
      return
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("score-view:scroll-to-answer", {
          detail: { answerId: firstVisibleSelected },
        }),
      )
    }
  }, [gradingMode, selectedPageImageIds, visibleAnswers])

  const masterAnswerData = useMemo((): MasterAnswerData | null => {
    if (!currentCropRegion || !project?.projectPages) return null

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
      maxScore: currentCropRegion.points || 0,
      status: "master",
      questionRegion: currentCropRegion,
      customOrder: -1,
      isMaster: true,
    }
  }, [currentCropRegion, project])

  const getAllGridAnswerData = useMemo(() => {
    return allScoringData.map((data) => ({
      ...data,
      isSelected: selectedPageImageIds.has(data.id),
    }))
  }, [allScoringData, selectedPageImageIds])

  const getGridAnswerData = useCallback(() => {
    const filteredAnswers = visibleAnswers
      .map((answerId) =>
        getAllGridAnswerData.find((answer) => answer.id === answerId),
      )
      .filter(Boolean)

    return filteredAnswers
  }, [getAllGridAnswerData, visibleAnswers])

  const handleRefreshFilter = useCallback(() => {
    setRecentlyScoredAnswers(new Set())

    updateVisibleAnswers()
  }, [updateVisibleAnswers])

  const handleToggleFilter = useCallback(
    (key: string) => {
      if (key in filterSettings) {
        const newFilterSettings = {
          ...filterSettings,
          [key]: !filterSettings[key as keyof typeof filterSettings],
        }
        setFilterSettings(newFilterSettings)

        updateVisibleAnswers(newFilterSettings)

        setRecentlyScoredAnswers(new Set())
      }
    },
    [filterSettings, updateVisibleAnswers],
  )

  const handleToggleFilterByScoreKey = useCallback(
    (scoreKey: string) => {
      const scoreToFilterMap: { [key: string]: keyof typeof filterSettings } = {
        [DEFAULT_KEYBINDINGS["scoring.unscored"]]: "unscored",
        [DEFAULT_KEYBINDINGS["scoring.correct"]]: "correct",
        [DEFAULT_KEYBINDINGS["scoring.incorrect"]]: "incorrect",
        [DEFAULT_KEYBINDINGS["scoring.partial"]]: "partial",
        [DEFAULT_KEYBINDINGS["scoring.pending"]]: "pending",
        [DEFAULT_KEYBINDINGS["scoring.noAnswer"]]: "no_answer",
      }

      const filterKey = scoreToFilterMap[scoreKey]
      if (filterKey) {
        const newFilterSettings = {
          ...filterSettings,
          [filterKey]: !filterSettings[filterKey],
        }
        setFilterSettings(newFilterSettings)

        updateVisibleAnswers(newFilterSettings)

        setRecentlyScoredAnswers(new Set())
      }
    },
    [filterSettings, updateVisibleAnswers],
  )

  return {
    allScoringData,
    masterAnswerData,
    filteredScoringDataIds: visibleAnswers,
    selectedScoringDataIds: selectedPageImageIds,

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
