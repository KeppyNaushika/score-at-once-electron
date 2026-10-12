"use client"

import { useMutation } from "@tanstack/react-query"
import { useId } from "react"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  type ScoreScaleRow,
  setScoreScaleExamMutation,
} from "@/queries/scoreScale"

import { examReturnTargetOf } from "./utils/scoreScaleUsage"

interface ScoreScaleScopeSwitchProps {
  scoreScale: ScoreScaleRow
  /** 03 から開いたときの試験（試験に戻す先）。管理の画面では null */
  contextExamId: string | null
}

/**
 * 「共通にする（ほかの試験でも使う）」のスイッチ（§4-8-3a）。
 *
 * 共通にするのはいつでもできる。試験に戻せるのは、その試験の設問だけが使っているときに限る
 * （main でも確かめて拒む）。戻せないときはスイッチを止め、理由を添える
 */
export function ScoreScaleScopeSwitch({
  scoreScale,
  contextExamId,
}: ScoreScaleScopeSwitchProps) {
  const switchId = useId()
  const { mutate: setScoreScaleExam, isPending } = useMutation(
    setScoreScaleExamMutation()
  )
  const isGlobal = scoreScale.examId === null
  const returnTarget = examReturnTargetOf(scoreScale, contextExamId)
  const blockedReason =
    isGlobal && returnTarget.kind === "blocked" ? returnTarget.reason : null

  const handleCheckedChange = (checked: boolean) => {
    if (checked) {
      setScoreScaleExam({ scoreScaleId: scoreScale.id, examId: null })
      return
    }
    if (returnTarget.kind !== "available") return
    setScoreScaleExam({
      scoreScaleId: scoreScale.id,
      examId: returnTarget.examId,
    })
  }

  return (
    <div className="flex h-8 items-center gap-2">
      <Switch
        id={switchId}
        checked={isGlobal}
        onCheckedChange={handleCheckedChange}
        disabled={isPending || blockedReason !== null}
      />
      <Label htmlFor={switchId} className="text-xs">
        共通にする（ほかの試験でも使う）
      </Label>
      {blockedReason && (
        <span className="text-[11px] text-muted-foreground">
          試験のものに戻せません: {blockedReason}
        </span>
      )}
    </div>
  )
}
