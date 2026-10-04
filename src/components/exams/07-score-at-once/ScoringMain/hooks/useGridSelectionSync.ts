import { useEffect, useLayoutEffect, useRef } from "react"

import type { GradingMode } from "@/components/exams/07-score-at-once/types"

/** 引き継ぐ選択が無いときの空値（毎回新しい配列を作らない） */
const EMPTY_SELECTION: string[] = []

const areArraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i])

/** 絞り込みの結果（useScoringFilter が組み立てる） */
export interface VisibleAnswersDerivation {
  /** 表示する答案の id（表示順） */
  visibleAnswers: string[]
  /** 表示する答案のうち、最初の生徒の答案（模範解答を除く） */
  firstStudentAnswerId: string | null
  /** 選択中の答案のうち、表示に残るもの */
  filteredSelection: string[]
}

interface UseGridSelectionSyncProps {
  derivedVisible: VisibleAnswersDerivation
  currentCropRegionId: string | null
  gradingMode: GradingMode
  questionChangeVersion: number
  manualSelectionVersion: number
  selectedStudentAnswerImageIds: Set<string>
  setSelectedPageImageIds: (answers: Set<string>) => void
}

/**
 * 一覧（グリッド）の選択を、表示する答案の入れ替わりに追従させる
 * - 絞り込み・設問・モードが変わったら、残った選択か先頭の答案を選び直す
 * - 絞り込みが変わったら、選択中の答案までスクロールさせる
 * - 設問を移ったら、先頭の答案を選ぶ
 *
 * 利用者が自分で選び直したとき（manualSelectionVersion が進んだとき）は手を出さない。
 */
export function useGridSelectionSync({
  derivedVisible,
  currentCropRegionId,
  gradingMode,
  questionChangeVersion,
  manualSelectionVersion,
  selectedStudentAnswerImageIds,
  setSelectedPageImageIds,
}: UseGridSelectionSyncProps): void {
  const { visibleAnswers } = derivedVisible

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
      ? EMPTY_SELECTION
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
}
