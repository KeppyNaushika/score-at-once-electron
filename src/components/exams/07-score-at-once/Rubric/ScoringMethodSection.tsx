"use client"

import { useMutation } from "@tanstack/react-query"
import { ListChecks } from "lucide-react"

import { SidePanelSection } from "@/components/exams/07-score-at-once/ScoringSidePanel/SidePanelSection"
import { Button } from "@/components/ui/button"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { setScoringMethodMutation } from "@/queries/rubric"
import {
  SCORING_METHODS,
  type ScoringMethod,
  toScoringMethod,
} from "@/types/rubric.types"

import { useRubricRecalculation } from "./hooks/useRubricRecalculation"
import { useScoringKeysPausedWhile } from "./hooks/useScoringKeysPausedWhile"
import { RubricRecalculationDialog } from "./RubricRecalculationDialog"
import {
  SCORING_METHOD_DESCRIPTIONS,
  SCORING_METHOD_LABELS,
} from "./utils/rubricEffectLabel"

/**
 * ここで選べる方式。類型評価は類型の組も選ぶので、03 の領域設定で選ぶ
 * （docs/vlm-grading-design.md §4-8-3a）
 */
const POINT_SCORING_METHODS = SCORING_METHODS.filter(
  (method) => method !== "scale"
)

interface ScoringMethodSectionProps {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  currentUserId: string
  isOpen: boolean
  onToggle: () => void
}

/**
 * 設問の採点方式（docs/vlm-grading-design.md §4-1）。直接採点（既定）のままなら、
 * 採点の画面はこれまでと何も変わらない。減点・加点方式にすると、左にルーブリック項目の
 * パネルが出る。方式を変えると当たっている答案の点が変わるので、他の採点者の点が
 * 変わるときは確認する
 */
export function ScoringMethodSection({
  examId,
  cropRegion,
  currentUserId,
  isOpen,
  onToggle,
}: ScoringMethodSectionProps) {
  const scoringMethod = toScoringMethod(cropRegion.scoringMethod)
  const { mutateAsync: setScoringMethod } = useMutation(
    setScoringMethodMutation(examId)
  )
  const { runWithRecalculation, pending, cancel } = useRubricRecalculation({
    examId,
    cropRegionId: cropRegion.id,
    currentUserId,
  })
  useScoringKeysPausedWhile(pending !== null)

  const changeMethod = (nextMethod: ScoringMethod) => {
    if (nextMethod === scoringMethod) return
    void runWithRecalculation({
      transform: (source) => ({ ...source, scoringMethod: nextMethod }),
      title: "採点方式を変えますか",
      description: `${cropRegion.label} を「${SCORING_METHOD_LABELS[nextMethod]}」にします。`,
      confirmLabel: "変える",
      change: () =>
        setScoringMethod({
          cropRegionId: cropRegion.id,
          scoringMethod: nextMethod,
        }),
    })
  }

  return (
    <SidePanelSection
      icon={ListChecks}
      title="採点方式"
      badge={SCORING_METHOD_LABELS[scoringMethod]}
      collapsible
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="flex gap-1">
        {POINT_SCORING_METHODS.map((method) => (
          <Button
            key={method}
            type="button"
            size="sm"
            className="h-7 flex-1 px-2 text-xs"
            variant={method === scoringMethod ? "default" : "outline"}
            aria-pressed={method === scoringMethod}
            onClick={() => changeMethod(method)}
          >
            {SCORING_METHOD_LABELS[method]}
          </Button>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-gray-500">
        {SCORING_METHOD_DESCRIPTIONS[scoringMethod]}
      </p>
      {scoringMethod === "scale" && (
        <p className="mt-1 text-[11px] text-gray-500">
          類型表は 03 の領域設定で選びます。
        </p>
      )}
      <RubricRecalculationDialog pending={pending} onCancel={cancel} />
    </SidePanelSection>
  )
}
