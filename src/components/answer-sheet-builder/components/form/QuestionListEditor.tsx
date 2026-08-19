"use client"

import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  LabelPresets,
  MajorQuestion,
} from "@/types/answerSheetDefinition.types"

import {
  BRANCH_QUESTION_LABEL_PRESETS,
  MAJOR_QUESTION_LABEL_PRESETS,
  parsePresetLabels,
  SUB_QUESTION_LABEL_PRESETS,
} from "../../constants"
import { movedIds } from "../../reorderIds"
import type { AsbEditorActions } from "../../types"
import { MajorQuestionForm } from "./MajorQuestionForm"

/** プリセット文字列の短縮表示ラベルを生成 */
function presetShortLabel(preset: string): string {
  const labels = parsePresetLabels(preset)
  if (labels.length >= 3) return `${labels[0]}${labels[1]}${labels[2]}...`
  return labels.join("")
}

interface QuestionListEditorProps {
  majorQuestions: MajorQuestion[]
  labelPresets?: LabelPresets
  definitionId: string
  actions: AsbEditorActions
  /** 縦書きレイアウトか（高さ/幅ラベルの表示を入れ替える） */
  vertical?: boolean
}

export function QuestionListEditor({
  majorQuestions,
  labelPresets,
  definitionId,
  actions,
  vertical = false,
}: QuestionListEditorProps) {
  return (
    <div className="space-y-3">
      {/* 既定の番号 */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <h4 className="mb-2 text-xs font-semibold text-muted-foreground">
          既定の番号
        </h4>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs whitespace-nowrap">大問</span>
            <Select
              value={labelPresets?.major ?? ""}
              onValueChange={(preset) =>
                actions.applyLabelPreset("major", preset)
              }
            >
              <SelectTrigger className="h-7 w-28 text-xs">
                <SelectValue placeholder="選択..." />
              </SelectTrigger>
              <SelectContent>
                {MAJOR_QUESTION_LABEL_PRESETS.map((preset) => (
                  <SelectItem key={preset} value={preset} className="text-xs">
                    {presetShortLabel(preset)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs whitespace-nowrap">小問</span>
            <Select
              value={labelPresets?.sub ?? ""}
              onValueChange={(preset) =>
                actions.applyLabelPreset("sub", preset)
              }
            >
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue placeholder="選択..." />
              </SelectTrigger>
              <SelectContent>
                {SUB_QUESTION_LABEL_PRESETS.map((preset) => (
                  <SelectItem key={preset} value={preset} className="text-xs">
                    {presetShortLabel(preset)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs whitespace-nowrap">枝問</span>
            <Select
              value={labelPresets?.branch ?? ""}
              onValueChange={(preset) =>
                actions.applyLabelPreset("branch", preset)
              }
            >
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue placeholder="選択..." />
              </SelectTrigger>
              <SelectContent>
                {BRANCH_QUESTION_LABEL_PRESETS.map((preset) => (
                  <SelectItem key={preset} value={preset} className="text-xs">
                    {presetShortLabel(preset)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">
          問題構成
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={actions.addMajorQuestion}
        >
          <Plus className="mr-1 h-3 w-3" />
          大問追加
        </Button>
      </div>

      <div className="space-y-2">
        {majorQuestions.map((majorQuestion, majorIndex) => (
          <MajorQuestionForm
            key={majorQuestion.id}
            majorQuestion={majorQuestion}
            majorIndex={majorIndex}
            definitionId={definitionId}
            actions={actions}
            vertical={vertical}
            onMoveUp={
              majorIndex > 0
                ? () =>
                    actions.reorderMajorQuestions(
                      movedIds(majorQuestions, majorIndex, majorIndex - 1)
                    )
                : undefined
            }
            onMoveDown={
              majorIndex < majorQuestions.length - 1
                ? () =>
                    actions.reorderMajorQuestions(
                      movedIds(majorQuestions, majorIndex, majorIndex + 1)
                    )
                : undefined
            }
          />
        ))}
      </div>

      {majorQuestions.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          大問がありません。「大問追加」ボタンで追加してください。
        </div>
      )}
    </div>
  )
}
