import { useCallback, useMemo, useState } from "react"

import type { ScaleLevelChoice } from "@/components/exams/07-score-at-once/ScaleLevel/utils/scaleLevelAppearance"
import type { GridAnswerItem } from "@/components/exams/07-score-at-once/ScoringGrid/types"
import type { ExamDecisionSummary } from "@/types/scoreDecision.types"

import type {
  DecisionFilterSettings,
  DecisionVerdict,
  DecisionWrite,
  ScaleAppearanceOfVerdict,
} from "../types"
import type { DecisionGridItem } from "./useFinalizeData"

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

interface UseDecisionGridItemsOptions {
  summary: ExamDecisionSummary | null
  currentCropRegionId: string | null
  gridItems: DecisionGridItem[]
  scaleLevels: readonly ScaleLevelChoice[]
  scaleAppearanceOfVerdict: ScaleAppearanceOfVerdict
}

/**
 * 08 の一覧に並べる答案。書いたばかりの確定を先に見せ、裁定理由で絞り込む。
 *
 * 絞り込みから外れても、確定したばかりの答案は R（更新）か絞り込みを変えるまで残す
 */
export function useDecisionGridItems({
  summary,
  currentCropRegionId,
  gridItems,
  scaleLevels,
  scaleAppearanceOfVerdict,
}: UseDecisionGridItemsOptions) {
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
    summary: ExamDecisionSummary | null
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

  /** 書いた確定を、サマリが取り直されるまで先に見せ、絞り込みから外れても一覧に残す */
  const showWrittenDecisions = useCallback(
    (verdict: DecisionVerdict, writes: readonly DecisionWrite[]) => {
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
          ...writes.map(({ item }) => item.id),
        ]),
      }))
    },
    [summary, currentCropRegionId]
  )

  /** 確定したばかりの答案を一覧に残すのをやめる（R・絞り込みの変更） */
  const forgetRecentlyDecided = useCallback(() => {
    setRecentlyDecided({ cropRegionId: null, examStudentIds: new Set() })
  }, [])

  const handleToggleFilter = useCallback(
    (reason: keyof DecisionFilterSettings) => {
      setFilterSettings((prev) => ({ ...prev, [reason]: !prev[reason] }))
      forgetRecentlyDecided()
    },
    [forgetRecentlyDecided]
  )

  return {
    filterSettings,
    handleToggleFilter,
    displayedItems,
    visibleItems,
    visibleIds,
    scaleAppearanceOf,
    showWrittenDecisions,
    forgetRecentlyDecided,
  }
}
