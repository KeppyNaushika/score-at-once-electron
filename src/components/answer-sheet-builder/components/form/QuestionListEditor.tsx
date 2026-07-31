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
  BranchQuestion,
  LabelPresets,
  MajorQuestion,
  SubQuestion,
} from "@/types/answerSheetDefinition.types"

import {
  BRANCH_QUESTION_LABEL_PRESETS,
  MAJOR_QUESTION_LABEL_PRESETS,
  parsePresetLabels,
  SUB_QUESTION_LABEL_PRESETS,
} from "../../constants"
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
  onSetLabelPreset: (
    category: "major" | "sub" | "branch",
    preset: string
  ) => void
  onAddMajor: () => void
  onUpdateMajor: (index: number, data: Partial<MajorQuestion>) => void
  onDeleteMajor: (index: number) => void
  onReorderMajor: (fromIndex: number, toIndex: number) => void
  onAddSub: (majorIndex: number) => void
  onUpdateSub: (
    majorIndex: number,
    subIndex: number,
    data: Partial<SubQuestion>
  ) => void
  onDeleteSub: (majorIndex: number, subIndex: number) => void
  onReorderSub: (majorIndex: number, fromIndex: number, toIndex: number) => void
  onAddBranch: (majorIndex: number, subIndex: number) => void
  onUpdateBranch: (
    majorIndex: number,
    subIndex: number,
    branchIndex: number,
    data: Partial<BranchQuestion>
  ) => void
  onDeleteBranch: (
    majorIndex: number,
    subIndex: number,
    branchIndex: number
  ) => void
  onReorderBranch: (
    majorIndex: number,
    subIndex: number,
    fromIndex: number,
    toIndex: number
  ) => void
  /** 縦書きレイアウトか（高さ/幅ラベルの表示を入れ替える） */
  vertical?: boolean
}

export function QuestionListEditor({
  majorQuestions,
  labelPresets,
  definitionId,
  vertical = false,
  onSetLabelPreset,
  onAddMajor,
  onUpdateMajor,
  onDeleteMajor,
  onReorderMajor,
  onAddSub,
  onUpdateSub,
  onDeleteSub,
  onReorderSub,
  onAddBranch,
  onUpdateBranch,
  onDeleteBranch,
  onReorderBranch,
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
              onValueChange={(v) => onSetLabelPreset("major", v)}
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
              onValueChange={(v) => onSetLabelPreset("sub", v)}
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
              onValueChange={(v) => onSetLabelPreset("branch", v)}
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
          onClick={onAddMajor}
        >
          <Plus className="mr-1 h-3 w-3" />
          大問追加
        </Button>
      </div>

      <div className="space-y-2">
        {majorQuestions.map((major, mi) => (
          <MajorQuestionForm
            key={major.id}
            major={major}
            majorIndex={mi}
            totalMajorCount={majorQuestions.length}
            definitionId={definitionId}
            vertical={vertical}
            onUpdate={(data) => onUpdateMajor(mi, data)}
            onDelete={() => onDeleteMajor(mi)}
            onMoveUp={mi > 0 ? () => onReorderMajor(mi, mi - 1) : undefined}
            onMoveDown={
              mi < majorQuestions.length - 1
                ? () => onReorderMajor(mi, mi + 1)
                : undefined
            }
            onAddSub={() => onAddSub(mi)}
            onUpdateSub={(si, data) => onUpdateSub(mi, si, data)}
            onDeleteSub={(si) => onDeleteSub(mi, si)}
            onReorderSub={(from, to) => onReorderSub(mi, from, to)}
            onAddBranch={(si) => onAddBranch(mi, si)}
            onUpdateBranch={(si, bi, data) => onUpdateBranch(mi, si, bi, data)}
            onDeleteBranch={(si, bi) => onDeleteBranch(mi, si, bi)}
            onReorderBranch={(si, from, to) =>
              onReorderBranch(mi, si, from, to)
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
