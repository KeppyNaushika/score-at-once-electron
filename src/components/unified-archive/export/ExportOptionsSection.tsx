"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { isOneOf } from "@/types/stringUnion"
import type { ArchiveOptionalItem } from "@/types/unifiedArchive.types"

import type { ExportSelectionState } from "./types"

const SCORING_KINDS: readonly ExportSelectionState["scoringKind"][] = [
  "all",
  "self",
]

/** 選べる項目（docs §5.5）。関連データではないので既定は含めない */
const OPTIONAL_ITEMS: readonly {
  value: ArchiveOptionalItem
  label: string
  description: string
}[] = [
  {
    value: "userSettings",
    label: "利用者個人の設定",
    description: "書き出しに入る利用者の、ショートカットや表示の設定",
  },
  {
    value: "appPreference",
    label: "組織の設定",
    description: "全員で共通の設定",
  },
  {
    value: "auditLog",
    label: "監査ログ",
    description: "書き出す試験・資料・成績算出・解答用紙定義についての記録",
  },
]

interface ExportOptionsSectionProps {
  selection: ExportSelectionState
  currentUserName: string
  onScoringKindChange: (
    scoringKind: ExportSelectionState["scoringKind"]
  ) => void
  onIncludeAnswersChange: (includeAnswers: boolean) => void
  onOptionalItemChange: (
    optionalItem: ArchiveOptionalItem,
    isIncluded: boolean
  ) => void
}

/** 採点の範囲・採点と答案を含めるか・選べる項目 */
export function ExportOptionsSection({
  selection,
  currentUserName,
  onScoringKindChange,
  onIncludeAnswersChange,
  onOptionalItemChange,
}: ExportOptionsSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">採点と答案</h3>
        <div className="flex items-center gap-2">
          <Checkbox
            id="unified-export-include-answers"
            checked={selection.includeAnswers}
            onCheckedChange={(checked) =>
              onIncludeAnswersChange(checked === true)
            }
          />
          <Label htmlFor="unified-export-include-answers">
            採点と答案を含める
          </Label>
        </div>
        <RadioGroup
          aria-label="採点の範囲"
          value={selection.scoringKind}
          onValueChange={(value) => {
            if (isOneOf(SCORING_KINDS, value)) onScoringKindChange(value)
          }}
          disabled={!selection.includeAnswers}
          className="space-y-1 pl-6"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="all" id="unified-export-scoring-all" />
            <Label htmlFor="unified-export-scoring-all">全員分の採点</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="self" id="unified-export-scoring-self" />
            <Label htmlFor="unified-export-scoring-self">
              本人分の採点だけ（{currentUserName}）
            </Label>
          </div>
        </RadioGroup>
        {!selection.includeAnswers && (
          <p className="text-xs text-muted-foreground">
            受験生・採点・答案画像・確定・返却版を含めません
          </p>
        )}
        {selection.includeAnswers && selection.scoringKind === "self" && (
          <p className="text-xs text-muted-foreground">
            他の教員の採点と注釈・確定・返却版を含めません
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">選べる項目</h3>
        {OPTIONAL_ITEMS.map((optionalItem) => {
          const checkboxId = `unified-export-optional-${optionalItem.value}`
          return (
            <div key={optionalItem.value} className="flex items-start gap-2">
              <Checkbox
                id={checkboxId}
                className="mt-0.5"
                checked={selection.optionalItems.includes(optionalItem.value)}
                onCheckedChange={(checked) =>
                  onOptionalItemChange(optionalItem.value, checked === true)
                }
              />
              <Label
                htmlFor={checkboxId}
                className="flex flex-col items-start gap-0.5"
              >
                <span>{optionalItem.label}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {optionalItem.description}
                </span>
              </Label>
            </div>
          )
        })}
      </section>
    </div>
  )
}
