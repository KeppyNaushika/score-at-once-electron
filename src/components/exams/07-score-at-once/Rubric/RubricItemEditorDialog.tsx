"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SCORING_STATUS_LABELS } from "@/lib/shared/scoringStatusLabels"
import type { RubricItemRow } from "@/queries/rubric"
import {
  type RubricEffectKind,
  type RubricSetStatus,
  rubricSetStatusesFor,
  type ScoringMethod,
  toRubricEffectKind,
} from "@/types/rubric.types"

import {
  type ScaleLevelChoice,
  scaleLevelColorsAt,
} from "../ScaleLevel/utils/scaleLevelAppearance"
import type { RubricItemDraft } from "./hooks/useRubricItemEditing"

interface RubricItemEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 直す項目。新しく作るときは null */
  rubricItem: RubricItemRow | null
  /** 設問の配点（点の欄の上限の案内） */
  points: number | null
  scoringMethod: ScoringMethod
  /** 設問の類型表の類型（類型方式の設問で、類型にする項目の選択肢。ほかの方式では空） */
  scaleLevels: readonly ScaleLevelChoice[]
  /** 保存する。保存できたら true（ダイアログを閉じる） */
  onSubmit: (draft: RubricItemDraft) => Promise<boolean>
}

/**
 * ルーブリック項目の追加・変更（docs/vlm-grading-design.md §4-2）。
 * 類型方式の設問では、項目は判定を決めるものだけで、判定は「類型にする」（類型を選ぶ）・無答・保留（§4-8-6）
 */
export function RubricItemEditorDialog(props: RubricItemEditorDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-lg">
        {/* 開くたびに中身を作り直す（前に書きかけた値を持ち越さない） */}
        {props.open && <RubricItemEditorForm {...props} />}
      </DialogContent>
    </Dialog>
  )
}

const EFFECT_KIND_LABELS: Record<RubricEffectKind, string> = {
  adjust: "点を加減する",
  set: "判定と点を決める",
}

/** 数の欄の文字を数へ（空欄は null。数でなければ NaN のまま渡して検証に知らせてもらう） */
const toNumberOrNull = (text: string): number | null =>
  text.trim() === "" ? null : Number(text)

const numberText = (score: number | null) => (score === null ? "" : `${score}`)

/** 判定のボタンの言葉（類型にする項目は、類型そのものを下の欄で選ぶ） */
const setStatusButtonLabel = (status: RubricSetStatus) =>
  status === "evaluated" ? "類型にする" : SCORING_STATUS_LABELS[status]

function RubricItemEditorForm({
  onOpenChange,
  rubricItem,
  points,
  scoringMethod,
  scaleLevels,
  onSubmit,
}: RubricItemEditorDialogProps) {
  const isScaleQuestion = scoringMethod === "scale"
  const setStatuses = rubricSetStatusesFor(scoringMethod)
  const [effectKind, setEffectKind] = useState<RubricEffectKind>(
    // 類型方式の設問の項目は判定を決めるものだけ
    isScaleQuestion
      ? "set"
      : rubricItem
        ? toRubricEffectKind(rubricItem.effectKind)
        : "adjust"
  )
  const [pointDeltaText, setPointDeltaText] = useState(
    rubricItem
      ? numberText(rubricItem.pointDelta)
      : scoringMethod === "addition"
        ? "1"
        : "-1"
  )
  const [setStatus, setSetStatus] = useState<RubricSetStatus>(
    setStatuses.find((status) => status === rubricItem?.setStatus) ??
      (isScaleQuestion ? "evaluated" : "incorrect")
  )
  const [setScaleLevelId, setSetScaleLevelId] = useState<string | null>(
    scaleLevels.find(
      (scaleLevel) => scaleLevel.id === rubricItem?.setScaleLevelId
    )?.id ??
      scaleLevels[0]?.id ??
      null
  )
  const [setScoreText, setSetScoreText] = useState(
    numberText(rubricItem?.setScore ?? null)
  )
  const [label, setLabel] = useState(rubricItem?.label ?? "")
  const [adviceText, setAdviceText] = useState(rubricItem?.adviceText ?? "")
  const [isSaving, setIsSaving] = useState(false)

  // 類型方式の設問の項目は点を持たない（点は類型の点数から読む）
  const keepsScore =
    !isScaleQuestion && (setStatus === "partial" || setStatus === "pending")

  const handleSave = async () => {
    setIsSaving(true)
    const saved = await onSubmit({
      label: label.trim(),
      adviceText: adviceText.trim(),
      effectKind,
      pointDelta:
        effectKind === "adjust" ? toNumberOrNull(pointDeltaText) : null,
      setStatus: effectKind === "set" ? setStatus : null,
      setScore:
        effectKind === "set" && keepsScore
          ? toNumberOrNull(setScoreText)
          : null,
      setScaleLevelId:
        effectKind === "set" && setStatus === "evaluated"
          ? setScaleLevelId
          : null,
    })
    setIsSaving(false)
    if (saved) onOpenChange(false)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {rubricItem ? "採点項目を変更" : "採点項目を追加"}
        </DialogTitle>
        <DialogDescription>
          項目はこの設問を採点する教員の間で共有します
          {points !== null ? `（配点 ${points}点）` : ""}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className={`space-y-1 ${isScaleQuestion ? "hidden" : ""}`}>
          <Label>種類</Label>
          <div className="flex gap-2">
            {(["adjust", "set"] as const).map((kind) => (
              <Button
                key={kind}
                type="button"
                size="sm"
                variant={effectKind === kind ? "default" : "outline"}
                aria-pressed={effectKind === kind}
                onClick={() => setEffectKind(kind)}
              >
                {EFFECT_KIND_LABELS[kind]}
              </Button>
            ))}
          </div>
        </div>

        {effectKind === "adjust" ? (
          <div className="space-y-1">
            <Label htmlFor="rubric-item-point-delta">加減する点</Label>
            <Input
              id="rubric-item-point-delta"
              inputMode="decimal"
              value={pointDeltaText}
              onChange={(event) => setPointDeltaText(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              減点は「-1」、加点は「1」のように書きます
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label>判定</Label>
              <div className="flex flex-wrap gap-2">
                {setStatuses.map((status) => (
                  <Button
                    key={status}
                    type="button"
                    size="sm"
                    variant={setStatus === status ? "default" : "outline"}
                    aria-pressed={setStatus === status}
                    onClick={() => setSetStatus(status)}
                  >
                    {setStatusButtonLabel(status)}
                  </Button>
                ))}
              </div>
            </div>
            {setStatus === "evaluated" && (
              <div className="space-y-1">
                <Label>類型</Label>
                {scaleLevels.length === 0 ? (
                  <p className="text-xs text-amber-700">
                    この設問には類型表が選ばれていません。03
                    の領域情報で選んでください
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {scaleLevels.map((scaleLevel, order) => {
                      const colors = scaleLevelColorsAt(order)
                      const isSelected = setScaleLevelId === scaleLevel.id
                      return (
                        <Button
                          key={scaleLevel.id}
                          type="button"
                          size="sm"
                          variant="outline"
                          aria-pressed={isSelected}
                          title={scaleLevel.description || undefined}
                          className={isSelected ? "ring-2 ring-gray-800" : ""}
                          style={{
                            backgroundColor: colors.bg,
                            color: colors.text,
                          }}
                          onClick={() => setSetScaleLevelId(scaleLevel.id)}
                        >
                          {scaleLevel.label}
                          <span className="text-[10px] opacity-80">
                            {scaleLevel.score}点
                          </span>
                        </Button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            {keepsScore && (
              <div className="space-y-1">
                <Label htmlFor="rubric-item-set-score">
                  点{setStatus === "pending" ? "（任意）" : ""}
                </Label>
                <Input
                  id="rubric-item-set-score"
                  inputMode="decimal"
                  value={setScoreText}
                  onChange={(event) => setSetScoreText(event.target.value)}
                />
              </div>
            )}
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="rubric-item-label">
            判断理由（教員向け・印刷しない）
          </Label>
          <Input
            id="rubric-item-label"
            value={label}
            placeholder={
              isScaleQuestion ? "例: 根拠を2つ挙げている" : "例: 単位が無い"
            }
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="rubric-item-advice">
            助言（生徒向け・空なら朱書きなし）
          </Label>
          <Textarea
            id="rubric-item-advice"
            rows={2}
            value={adviceText}
            placeholder="例: 単位を書こう"
            onChange={(event) => setAdviceText(event.target.value)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          やめる
        </Button>
        <Button onClick={() => void handleSave()} disabled={isSaving}>
          保存
        </Button>
      </DialogFooter>
    </>
  )
}
