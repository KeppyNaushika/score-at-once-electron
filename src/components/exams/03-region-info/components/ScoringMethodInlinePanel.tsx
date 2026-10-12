"use client"

import { RubricRecalculationDialog } from "@/components/exams/07-score-at-once/Rubric/RubricRecalculationDialog"
import {
  SCORING_METHOD_DESCRIPTIONS,
  SCORING_METHOD_LABELS,
} from "@/components/exams/07-score-at-once/Rubric/utils/rubricEffectLabel"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import type { CropRegionRow } from "@/queries/cropRegion"
import { SCORING_METHODS } from "@/types/rubric.types"

import { useScoringMethodChange } from "../hooks/useScoringMethodChange"
import { ScaleSwitchConfirmDialog } from "./ScaleSwitchConfirmDialog"
import { ScoreScalePicker } from "./ScoreScalePicker"

interface ScoringMethodInlinePanelProps {
  examId: string
  cropRegion: Pick<
    CropRegionRow,
    "id" | "label" | "points" | "scoringMethod" | "scoreScaleId"
  >
  disabled?: boolean
}

/**
 * 03 の設問の行を開いた中の、採点方式と類型評価（docs/vlm-grading-design.md §4-8-3a）。
 *
 * 方式は4つ（直接採点・減点・加点・類型評価）から選ぶ。07 の採点方式の欄と同じ書き込みを使い、
 * 点の採点どうしの切り替えは点の計算し直しを確かめ、類型評価をまたぐ切り替えは
 * 方式と合わない採点の件数を確かめる。類型評価なら使う類型の組を選び・作り・その場で直す
 */
export function ScoringMethodInlinePanel({
  examId,
  cropRegion,
  disabled = false,
}: ScoringMethodInlinePanelProps) {
  const currentUser = useCurrentUser()
  const {
    currentMethod,
    changeMethod,
    pendingRecalculation,
    cancelRecalculation,
    pendingScaleSwitch,
    cancelScaleSwitch,
  } = useScoringMethodChange({
    examId,
    cropRegion,
    currentUserId: currentUser.id,
  })

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-sm font-semibold">採点方式</Label>
        <div className="flex gap-1" role="group" aria-label="採点方式">
          {SCORING_METHODS.map((method) => (
            <Button
              key={method}
              type="button"
              size="sm"
              className="h-7 px-3 text-xs"
              variant={method === currentMethod ? "default" : "outline"}
              aria-pressed={method === currentMethod}
              disabled={disabled}
              onClick={() => void changeMethod(method)}
            >
              {SCORING_METHOD_LABELS[method]}
            </Button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {SCORING_METHOD_DESCRIPTIONS[currentMethod]}
      </p>

      {currentMethod === "scale" && (
        <ScoreScalePicker
          examId={examId}
          cropRegion={cropRegion}
          disabled={disabled}
        />
      )}

      <RubricRecalculationDialog
        pending={pendingRecalculation}
        onCancel={cancelRecalculation}
      />
      <ScaleSwitchConfirmDialog
        cropRegionLabel={cropRegion.label}
        pending={pendingScaleSwitch}
        onCancel={cancelScaleSwitch}
      />
    </div>
  )
}
