"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { Plus, TriangleAlert } from "lucide-react"
import { useMemo } from "react"

import { Combobox, type ComboboxOption } from "@/components/common/Combobox"
import { ScoreScaleEditor } from "@/components/score-scales/ScoreScaleEditor"
import {
  defaultScaleLevels,
  scaleLevelsSummary,
} from "@/components/score-scales/utils/scoreScaleUsage"
import { Button } from "@/components/ui/button"
import type { CropRegionRow } from "@/queries/cropRegion"
import {
  createScoreScaleMutation,
  examScoreScalesQuery,
  type ScoreScaleRow,
  setCropRegionScoreScaleMutation,
} from "@/queries/scoreScale"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_SCORE_SCALES: ScoreScaleRow[] = []

/** 03 で新しく作る類型表の名前（あとから直せる） */
const NEW_SCORE_SCALE_NAME = "類型表"

interface ScoreScalePickerProps {
  examId: string
  cropRegion: Pick<CropRegionRow, "id" | "points" | "scoreScaleId">
  disabled?: boolean
}

/**
 * 類型方式の設問で使う類型表を選ぶ・作る・その場で直す（§4-8-3a）。
 * 選択肢はこの試験のものと共通のものを分けて並べる
 */
export function ScoreScalePicker({
  examId,
  cropRegion,
  disabled = false,
}: ScoreScalePickerProps) {
  const { data: scoreScales = EMPTY_SCORE_SCALES } = useQuery(
    examScoreScalesQuery(examId)
  )
  const { mutate: setCropRegionScoreScale, isPending: selecting } = useMutation(
    setCropRegionScoreScaleMutation(examId)
  )
  const { mutateAsync: createScoreScale, isPending: creating } = useMutation(
    createScoreScaleMutation()
  )

  const options = useMemo<ComboboxOption[]>(
    () =>
      scoreScales.map((scoreScale) => ({
        value: scoreScale.id,
        label: scoreScale.name || "名前なし",
        keywords: [scaleLevelsSummary(scoreScale.levels)],
        group: scoreScale.examId === null ? "共通" : "この試験",
      })),
    [scoreScales]
  )
  const selectedScoreScale =
    scoreScales.find(
      (scoreScale) => scoreScale.id === cropRegion.scoreScaleId
    ) ?? null

  const selectScoreScale = (scoreScaleId: string) => {
    setCropRegionScoreScale({ cropRegionId: cropRegion.id, scoreScaleId })
  }

  const createAndSelect = async () => {
    try {
      const created = await createScoreScale({
        examId,
        name: NEW_SCORE_SCALE_NAME,
        levels: defaultScaleLevels(cropRegion.points),
      })
      selectScoreScale(created.id)
    } catch {
      // 失敗の通知は MutationCache の後始末が担う
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium">類型表</span>
        <Combobox
          options={options}
          value={cropRegion.scoreScaleId ?? ""}
          onValueChange={selectScoreScale}
          placeholder="類型表を選ぶ"
          searchPlaceholder="名前・類型で探す"
          emptyText="類型表がありません"
          disabled={disabled || selecting}
          className="h-8 w-64 text-sm"
          aria-label="類型表"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          disabled={disabled || creating}
          onClick={() => void createAndSelect()}
        >
          <Plus className="mr-1 h-3 w-3" />
          新しく作る
        </Button>
      </div>
      {selectedScoreScale && (
        <ScoreScaleEditor
          scoreScale={selectedScoreScale}
          contextExamId={examId}
          points={cropRegion.points}
          disabled={disabled}
        />
      )}
      {cropRegion.scoreScaleId === null && (
        <p className="flex items-center gap-1 text-xs text-amber-700">
          <TriangleAlert className="h-3.5 w-3.5" />
          類型表を選んでいないので、この設問は類型を選べません。
        </p>
      )}
    </div>
  )
}
