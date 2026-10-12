"use client"

import { useId } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ScoreScaleRow } from "@/queries/scoreScale"

import { GlobalScaleEditConfirmDialog } from "./GlobalScaleEditConfirmDialog"
import { useScoreScaleEditing } from "./hooks/useScoreScaleEditing"
import { ScoreScaleDeleteButton } from "./ScoreScaleDeleteButton"
import { ScoreScaleLevelTable } from "./ScoreScaleLevelTable"
import { ScoreScaleScopeSwitch } from "./ScoreScaleScopeSwitch"
import { scoreScaleUsageSummary } from "./utils/scoreScaleUsage"

interface ScoreScaleEditorProps {
  scoreScale: ScoreScaleRow
  /**
   * 03 の領域情報から開いたときの試験。試験に戻す先と、「この試験用に複製して直す」の持ち主になる。
   * 類型評価管理の画面では null
   */
  contextExamId: string | null
  /** 設問の配点（03 から開いたとき）。分かれば、配点を超える類型に注記を添える */
  points?: number | null
  /** 削除できたとき（管理の画面で選択を外す） */
  onDeleted?: () => void
  disabled?: boolean
}

/**
 * 類型評価（類型の組）の編集（docs/vlm-grading-design.md §4-8-3a）。
 * 03 の領域情報の行の中と、類型評価管理の画面の両方がこれを使う。
 *
 * 名前・記号・説明・点数は1打鍵ごとに書く。共通の組の点数・類型を直すときだけ、
 * 使っている試験・設問の数を示して確かめる（説明や名前は点に関わらないので確かめない）
 */
export function ScoreScaleEditor({
  scoreScale,
  contextExamId,
  points = null,
  onDeleted,
  disabled = false,
}: ScoreScaleEditorProps) {
  const nameInputId = useId()
  const editing = useScoreScaleEditing({ scoreScale, contextExamId })
  const usage = scoreScaleUsageSummary(scoreScale)

  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <Label htmlFor={nameInputId} className="text-xs">
            類型評価の名前
          </Label>
          <Input
            id={nameInputId}
            value={editing.textOf(scoreScale.id, "name", scoreScale.name)}
            onChange={(e) => editing.changeName(e.target.value)}
            onBlur={() => editing.leaveField(scoreScale.id, "name")}
            placeholder="記述の3類型"
            disabled={disabled}
            className="h-8 text-sm"
          />
        </div>
        <ScoreScaleScopeSwitch
          scoreScale={scoreScale}
          contextExamId={contextExamId}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {scoreScale.examId === null
          ? `共通の類型評価です。${usage.examCount}試験・${usage.cropRegionCount}設問で使っています。`
          : `${scoreScale.exam?.examName ?? "試験"} の類型評価です。${usage.cropRegionCount}設問で使っています。`}
      </p>

      <ScoreScaleLevelTable
        scoreScale={scoreScale}
        points={points}
        textOf={editing.textOf}
        onLevelTextChange={editing.changeLevelText}
        onScoreChange={editing.changeScore}
        onFieldBlur={editing.leaveField}
        onAddLevel={editing.addLevel}
        onDeleteLevel={editing.deleteLevel}
        onMoveLevel={editing.moveLevel}
        disabled={disabled}
      />

      <div className="flex justify-end">
        <ScoreScaleDeleteButton scoreScale={scoreScale} onDeleted={onDeleted} />
      </div>

      <GlobalScaleEditConfirmDialog
        scoreScale={scoreScale}
        pendingEdit={editing.gate.pendingEdit}
        onContinue={editing.gate.continueEditing}
        onDuplicate={editing.gate.duplicateAndEdit}
        onCancel={editing.gate.cancel}
      />
    </div>
  )
}
