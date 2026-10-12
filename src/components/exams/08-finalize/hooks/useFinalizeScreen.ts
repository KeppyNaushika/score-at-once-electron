import { useMutation } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

import { useGradeLock } from "@/components/common/grade-lock/GradeLockProvider"
import { useContextValue } from "@/components/exams/07-score-at-once/hooks/useContextValue"
import {
  POINT_VERDICT_ON_SCALE_NOTICE,
  SCALE_NOT_SELECTED_NOTICE,
} from "@/components/exams/07-score-at-once/ScaleLevel/scaleLevelMessages"
import { scaleLevelOfDigit } from "@/components/exams/07-score-at-once/ScaleLevel/utils/scaleLevelAppearance"
import type { GridAnswerItem } from "@/components/exams/07-score-at-once/ScoringGrid/types"
import { useGridZoom } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useGridZoom"
import { usePartialScore } from "@/components/exams/07-score-at-once/ScoringMain/hooks/usePartialScore"
import { useScoringNavigation } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringNavigation"
import { useScoringPreferences } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringPreferences"
import { effectiveSelection } from "@/components/exams/07-score-at-once/ScoringMain/utils/effectiveSelection"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { finalizeQuestionScoreMutation } from "@/queries/scoring"
import { isStatusCompatibleWithScoringMethod } from "@/types/rubric.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import type { DecisionFilterSettings } from "../types"
import { type DecisionGridItem, useFinalizeData } from "./useFinalizeData"
import { useFinalizeScaleQuestion } from "./useFinalizeScaleQuestion"

/** 確定できる判定（未採点は確定の対象にならない） */
export type DecisionVerdict = Exclude<ScoringStatus, "unscored">

/** 点数を伴う判定（他は判定そのものが点数を決める） */
const NEEDS_SCORE: ReadonlySet<ScoringStatus> = new Set(["partial", "pending"])

/**
 * 既定は確定済みも含めて全部を見せる（07 が採点済みも並べるのと同じ）。
 * 確定した答案が残っているほうが、どこまで進んだかと何に決めたかが一目で分かる
 */
const DEFAULT_FILTER: DecisionFilterSettings = {
  conflict: true,
  stale: true,
  decided: true,
}

/** 確定を書いた直後、サマリが取り直されるまで先に見せておく結果 */
interface OptimisticVerdict {
  verdict: DecisionVerdict
  score: number | null
  /** 類型評価で確定した類型（評価済みのときだけ） */
  scaleLevelId: string | null
}

/** 答案1つへ書く確定（判定はまとめて渡す） */
interface DecisionWrite {
  item: DecisionGridItem
  decidedScore: number | null
  scaleLevelId: string | null
}

/**
 * 点数を入れずに部分点・保留を確定したときの点。入力が無ければ、
 * 同じ判定の既存の確定か、その判定を付けた採点者の点（一通りに決まるときだけ）を使う。
 * 決まらなければ null（＝点を入れてもらう）。
 */
function fallbackScoreOf(
  item: DecisionGridItem,
  verdict: DecisionVerdict
): number | null {
  const { decision, proposals } = item.cell
  if (decision?.verdict === verdict && decision.score !== null) {
    return decision.score
  }
  const proposedScores = new Set(
    proposals
      .filter((proposal) => proposal.status === verdict)
      .map((proposal) => proposal.partialScore)
  )
  if (proposedScores.size !== 1) return null
  const [onlyScore] = proposedScores
  return onlyScore
}

/**
 * 「8. 採点確定」の画面の状態と操作。
 *
 * 07 と同じ部品（一覧・移動・部分点の入力・表示の設定）を、裁定サマリの上で回す。
 * **判定キーを押した時点で確定を書き、次の答案へ進む**（07 の採点と同じ手触り）。
 * 確定は上書きできるので、確定済みの答案もそのまま選んで確定し直せる。
 */
export function useFinalizeScreen(examId: string) {
  const currentUser = useCurrentUser()
  const [selectedCropRegionId, setSelectedCropRegionId] = useState<
    string | null
  >(null)

  const data = useFinalizeData(examId, currentUser.id, selectedCropRegionId)
  const {
    summary,
    currentCropRegionId,
    currentCropRegion,
    gridItems,
    decisionCropRegions,
  } = data

  // 成績算出が使う試験は試験ごとロックされる（layout）。ロック中は確定させない
  const { locked } = useGradeLock()
  const canDecide = summary?.canDecide ?? false
  const editable = canDecide && !locked

  // 類型評価の設問は、正答・誤答・部分点の代わりに類型を選んで確定する（§4-8-5）
  const { scaleQuestion, scaleAppearanceOfVerdict } = useFinalizeScaleQuestion(
    examId,
    currentCropRegion
  )
  const { isScaleQuestion, scaleLevels, isScaleLevelsLoading } = scaleQuestion

  const { scoringSettings } = useScoringPreferences(currentUser.id)
  const zoom = useGridZoom(
    scoringSettings.itemsPerLine,
    scoringSettings.setItemsPerLine
  )

  const [filterSettings, setFilterSettings] =
    useState<DecisionFilterSettings>(DEFAULT_FILTER)

  /**
   * いまの設問で確定したばかりの答案。絞り込みから外れても、R（更新）か絞り込みを
   * 変えるまでは一覧に残す（07 の「採点したばかりの答案」と同じ）。押した答案が
   * 目の前から消えると、何を確定したかを確かめられない。設問とペアで持つので、
   * 設問を移れば自然に空になる
   */
  const [recentlyDecided, setRecentlyDecided] = useState<{
    cropRegionId: string | null
    examStudentIds: ReadonlySet<string>
  }>({ cropRegionId: null, examStudentIds: new Set() })
  const recentlyDecidedIds = useMemo(
    () =>
      recentlyDecided.cropRegionId === currentCropRegionId
        ? recentlyDecided.examStudentIds
        : new Set<string>(),
    [recentlyDecided, currentCropRegionId]
  )

  /**
   * 書いた確定を、サマリが取り直されるまで先に見せる。どのサマリの上に重ねたかと
   * ペアで持ち、サマリが新しくなれば（＝書いた結果が届けば）自然に捨てる
   */
  const [optimistic, setOptimistic] = useState<{
    summary: typeof summary
    verdicts: ReadonlyMap<string, OptimisticVerdict>
  }>({ summary: null, verdicts: new Map() })
  const optimisticVerdicts =
    optimistic.summary === summary ? optimistic.verdicts : null

  const displayedItems = useMemo((): DecisionGridItem[] => {
    if (!optimisticVerdicts) return gridItems
    return gridItems.map((item) => {
      const pending = optimisticVerdicts.get(item.id)
      if (!pending) return item
      const scaleLevelScore = scaleLevels.find(
        (scaleLevel) => scaleLevel.id === pending.scaleLevelId
      )?.score
      return {
        ...item,
        status: pending.verdict,
        currentScore: pending.score ?? scaleLevelScore ?? undefined,
        scaleLevelId: pending.scaleLevelId,
      }
    })
  }, [gridItems, optimisticVerdicts, scaleLevels])

  /** マスの類型の見せ方（枠に出している結果＝確定か、書いたばかりの確定から引く） */
  const displayedItemById = useMemo(
    () => new Map(displayedItems.map((item) => [item.id, item])),
    [displayedItems]
  )
  const scaleAppearanceOf = useCallback(
    (answer: GridAnswerItem) => {
      const item = displayedItemById.get(answer.id)
      if (!item) return null
      return scaleAppearanceOfVerdict(item.status, item.scaleLevelId)
    },
    [displayedItemById, scaleAppearanceOfVerdict]
  )

  const visibleItems = useMemo(
    () =>
      displayedItems.filter(
        (item) =>
          filterSettings[item.cell.reason] || recentlyDecidedIds.has(item.id)
      ),
    [displayedItems, filterSettings, recentlyDecidedIds]
  )
  const visibleIds = useMemo(
    () => visibleItems.map((item) => item.id),
    [visibleItems]
  )

  /**
   * 選択は「利用者が選んだ答案」だけを持ち、表示に残っているものに絞って使う。
   * 何も残らなければ先頭の答案を選んでいるものとする（07 の一覧と同じ）
   */
  const [chosenIds, setChosenIds] = useState<ReadonlySet<string>>(new Set())
  const selectedIds = useMemo(
    () => effectiveSelection(chosenIds, visibleIds),
    [chosenIds, visibleIds]
  )
  const selectedItems = useMemo(
    () => visibleItems.filter((item) => selectedIds.has(item.id)),
    [visibleItems, selectedIds]
  )

  const setSelection = useCallback((ids: Set<string>) => {
    setChosenIds(ids)
  }, [])

  const handleSelectAnswer = useCallback(
    (id: string, isSelected: boolean) => {
      // 見えている選択（何も選んでいなければ先頭の答案）から足し引きする。
      // 選んだ答案だけから足すと、Ctrl/Cmd+クリックで先頭の答案が選択から落ちる
      setChosenIds((prev) => {
        const next = effectiveSelection(prev, visibleIds)
        if (isSelected) {
          next.add(id)
        } else {
          next.delete(id)
        }
        return next
      })
    },
    [visibleIds]
  )

  const changeQuestion = useCallback((cropRegionId: string | null) => {
    setSelectedCropRegionId(cropRegionId)
    setChosenIds(new Set())
  }, [])

  const getGridAnswerData = useCallback(
    () =>
      visibleItems.map((item) => ({
        ...item,
        isSelected: selectedIds.has(item.id),
      })),
    [visibleItems, selectedIds]
  )

  const { handleNextQuestion, handlePrevQuestion, handleGridNavigation } =
    useScoringNavigation({
      answerSheetsLength: visibleItems.length,
      currentCropRegionId,
      setCurrentCropRegionId: changeQuestion,
      selectedStudentAnswerImageIds: selectedIds,
      setSelectedPageImageIds: setSelection,
      layoutDirection: scoringSettings.layoutDirection,
      getGridAnswerData,
      effectiveColumns: scoringSettings.itemsPerLine[0],
      cropRegions: decisionCropRegions,
    })

  /** 確定の覚え書き（答案1つを選んでいるときだけ書ける）。答案とペアで持つ */
  const singleSelectedItem =
    selectedItems.length === 1 ? selectedItems[0] : null
  const [commentDraft, setCommentDraft] = useState<{
    examStudentId: string | null
    text: string
  }>({ examStudentId: null, text: "" })
  const decisionComment =
    singleSelectedItem && commentDraft.examStudentId === singleSelectedItem.id
      ? commentDraft.text
      : (singleSelectedItem?.cell.decision?.comment ?? "")
  const changeDecisionComment = useCallback(
    (text: string) => {
      if (!singleSelectedItem) return
      setCommentDraft({ examStudentId: singleSelectedItem.id, text })
    },
    [singleSelectedItem]
  )

  const { mutateAsync: finalizeQuestionScore } = useMutation(
    finalizeQuestionScoreMutation(examId)
  )

  /** 確定できないときの理由（できるなら null） */
  const readOnlyReason = !canDecide
    ? "採点結果の確定は試験の所有者（OWNER）のみが行えます"
    : locked
      ? "成績算出で使われているため確定できません"
      : null

  /**
   * 確定を書き、書いたばかりの結果を先に見せ、次の答案へ進む
   * （書いた答案のうち最後の答案の次。最後なら選択はそのまま）
   */
  const commitDecisions = useCallback(
    (verdict: DecisionVerdict, writes: readonly DecisionWrite[]) => {
      if (!currentCropRegionId || writes.length === 0) return

      for (const { item, decidedScore, scaleLevelId } of writes) {
        finalizeQuestionScore({
          examStudentId: item.examStudentId,
          cropRegionId: currentCropRegionId,
          decidedByUserId: currentUser.id,
          verdict,
          score: decidedScore,
          scaleLevelId,
          // 覚え書きは1つ選んでいるときだけ書き換える。まとめて確定するときは
          // それぞれの既存の覚え書きを残す
          comment:
            (singleSelectedItem
              ? decisionComment
              : item.cell.decision?.comment) || null,
        }).catch(() => {
          // 失敗の通知は MutationCache の後始末が出す
        })
      }

      const writtenIds = writes.map(({ item }) => item.id)
      setOptimistic((prev) => {
        const verdicts = new Map(
          prev.summary === summary ? prev.verdicts : undefined
        )
        for (const { item, decidedScore, scaleLevelId } of writes) {
          verdicts.set(item.id, { verdict, score: decidedScore, scaleLevelId })
        }
        return { summary, verdicts }
      })
      setRecentlyDecided((prev) => ({
        cropRegionId: currentCropRegionId,
        examStudentIds: new Set([
          ...(prev.cropRegionId === currentCropRegionId
            ? prev.examStudentIds
            : []),
          ...writtenIds,
        ]),
      }))

      const lastIndex = Math.max(
        ...writtenIds.map((id) => visibleIds.indexOf(id))
      )
      const nextId = visibleIds[lastIndex + 1]
      if (nextId) {
        setChosenIds(new Set([nextId]))
      }
    },
    [
      currentCropRegionId,
      finalizeQuestionScore,
      currentUser.id,
      singleSelectedItem,
      decisionComment,
      summary,
      visibleIds,
    ]
  )

  /**
   * 選んでいる答案すべてを、この判定で確定する。書いたら次の答案へ進む。
   *
   * 類型評価の設問では正答・誤答・部分点は確定しない（07 と同じ知らせを出す）。
   * 保留・無答・Wマークは点の採点と同じく確定でき、類型評価の保留は点を持たない。
   * 評価済み（類型）は `decideScaleLevel` で確定する
   *
   * @param score 部分点・保留の点（入力が無ければ null。既存の点から補う）
   */
  const decide = useCallback(
    (verdict: DecisionVerdict, score: number | null = null) => {
      if (readOnlyReason) {
        toast.info(readOnlyReason)
        return
      }
      if (!currentCropRegionId || selectedItems.length === 0) return
      if (verdict === "evaluated") return
      if (
        isScaleQuestion &&
        !isStatusCompatibleWithScoringMethod("scale", verdict)
      ) {
        toast.info(POINT_VERDICT_ON_SCALE_NOTICE, { id: "scale-point-verdict" })
        return
      }

      const needsScore = NEEDS_SCORE.has(verdict) && !isScaleQuestion
      const writes = selectedItems.flatMap((item): DecisionWrite[] => {
        const decidedScore = needsScore
          ? (score ?? fallbackScoreOf(item, verdict))
          : null
        if (needsScore && decidedScore === null) return []
        return [{ item, decidedScore, scaleLevelId: null }]
      })
      if (writes.length < selectedItems.length) {
        toast.warning(
          `点数が決まらない答案が${selectedItems.length - writes.length}件あります。点数を入力して確定してください`
        )
      }
      commitDecisions(verdict, writes)
    },
    [
      readOnlyReason,
      currentCropRegionId,
      selectedItems,
      isScaleQuestion,
      commitDecisions,
    ]
  )

  /** 選んでいる答案すべてを、この類型で確定する（類型評価の設問）。書いたら次の答案へ進む */
  const decideScaleLevel = useCallback(
    (scaleLevelId: string) => {
      if (readOnlyReason) {
        toast.info(readOnlyReason)
        return
      }
      if (!isScaleQuestion) return
      commitDecisions(
        "evaluated",
        selectedItems.map((item) => ({
          item,
          decidedScore: null,
          scaleLevelId,
        }))
      )
    },
    [readOnlyReason, isScaleQuestion, selectedItems, commitDecisions]
  )

  /** 覚え書きだけを書き直す（確定済みの答案1つ。判定と点はそのまま） */
  const saveDecisionComment = useCallback(() => {
    const decision = singleSelectedItem?.cell.decision
    if (!singleSelectedItem || !decision || !currentCropRegionId) return
    if (readOnlyReason) return
    if ((decision.comment ?? "") === decisionComment) return
    finalizeQuestionScore({
      examStudentId: singleSelectedItem.examStudentId,
      cropRegionId: currentCropRegionId,
      decidedByUserId: currentUser.id,
      verdict: decision.verdict,
      score: decision.score,
      scaleLevelId: decision.scaleLevelId,
      comment: decisionComment || null,
    }).catch(() => {
      // 失敗の通知は MutationCache の後始末が出す
    })
  }, [
    singleSelectedItem,
    currentCropRegionId,
    readOnlyReason,
    decisionComment,
    finalizeQuestionScore,
    currentUser.id,
  ])

  // 部分点・保留は 07 と同じ入力欄で点を入れる
  const partialScore = usePartialScore({
    selectedAnswers: selectedIds,
    currentCropRegion,
    onBatchScore: (status, score) => {
      if (status === "unscored") return
      decide(status, score ?? null)
    },
  })

  /** 部分点の欄を開く（部分点のキー・ボタン）。類型評価の設問は部分点を持たないので開かない */
  const openPartialScoreModal = useCallback(() => {
    if (isScaleQuestion) {
      toast.info(POINT_VERDICT_ON_SCALE_NOTICE, { id: "scale-point-verdict" })
      return
    }
    partialScore.openPartialScoreModal()
  }, [isScaleQuestion, partialScore])

  /** 保留（キー・ボタン）。点の採点の設問は点を入れる欄を開き、類型評価の設問はそのまま確定する */
  const openPendingInput = useCallback(() => {
    if (isScaleQuestion) {
      decide("pending")
      return
    }
    partialScore.openPartialScoreModal()
  }, [isScaleQuestion, decide, partialScore])

  /**
   * 数字キー。類型評価の設問では並び順に類型を選んで確定し（1 が先頭）、ほかの設問では
   * 部分点の入力を始める（07 と同じ）。組が無ければ知らせ、類型の数を超える数字は何もしない
   */
  const handleDigitKey = useCallback(
    (key: string) => {
      if (!isScaleQuestion) {
        partialScore.handlePartialScoreInput(key)
        return
      }
      if (scaleLevels.length === 0) {
        if (!isScaleLevelsLoading) {
          toast.warning(SCALE_NOT_SELECTED_NOTICE, { id: "scale-not-selected" })
        }
        return
      }
      const scaleLevel = scaleLevelOfDigit(scaleLevels, key)
      if (scaleLevel) decideScaleLevel(scaleLevel.id)
    },
    [
      isScaleQuestion,
      partialScore,
      scaleLevels,
      isScaleLevelsLoading,
      decideScaleLevel,
    ]
  )

  const handleToggleFilter = useCallback(
    (reason: keyof DecisionFilterSettings) => {
      setFilterSettings((prev) => ({ ...prev, [reason]: !prev[reason] }))
      setRecentlyDecided({ cropRegionId: null, examStudentIds: new Set() })
    },
    []
  )

  const handleRefresh = useCallback(() => {
    setRecentlyDecided({ cropRegionId: null, examStudentIds: new Set() })
    void data.refresh()
  }, [data])

  const handleSelectAll = useCallback(() => {
    setChosenIds(new Set(visibleIds))
  }, [visibleIds])

  // キー操作の文脈（07 と同じ ShortcutProvider の上で動く）
  useContextValue("hasSelectedAnswers", selectedIds.size > 0)
  useContextValue("partialScoreModalOpen", partialScore.showPartialScoreModal)
  useContextValue("modalOpen", partialScore.showPartialScoreModal)

  return {
    ...data,
    scoringSettings,
    zoom,
    editable,
    readOnlyReason,
    filterSettings,
    handleToggleFilter,
    handleRefresh,
    handleSelectAll,
    displayedItems,
    visibleItems,
    visibleIds,
    selectedIds,
    selectedItems,
    singleSelectedItem,
    handleSelectAnswer,
    setSelection,
    changeQuestion,
    handleNextQuestion,
    handlePrevQuestion,
    handleGridNavigation,
    decide,
    decideScaleLevel,
    openPartialScoreModal,
    openPendingInput,
    handleDigitKey,
    scaleQuestion,
    scaleAppearanceOfVerdict,
    scaleAppearanceOf,
    decisionComment,
    changeDecisionComment,
    saveDecisionComment,
    partialScore,
  }
}
