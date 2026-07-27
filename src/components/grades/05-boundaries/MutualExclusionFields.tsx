"use client"

import { Label } from "@/components/ui/label"
import type { GradeConstraintInput } from "@/types/grade.types"

interface MutualExclusionFieldsProps {
  /** 同時に現れてはいけないラベル集合 */
  exclusionLabels: string[]
  /** 境界セットに登場する全ラベル（選択肢） */
  labels: string[]
  onChange: (patch: Partial<GradeConstraintInput>) => void
}

export function MutualExclusionFields({
  exclusionLabels,
  labels,
  onChange,
}: MutualExclusionFieldsProps) {
  const displayLabels = labels.length > 0 ? labels : exclusionLabels
  const toggle = (label: string) => {
    const next = exclusionLabels.includes(label)
      ? exclusionLabels.filter((existingLabel) => existingLabel !== label)
      : [...exclusionLabels, label]
    onChange({ exclusionLabels: next })
  }
  return (
    <div className="space-y-2 text-sm">
      <Label className="text-muted-foreground text-xs">
        同時に現れてはいけないラベル（2つ以上選択）
      </Label>
      <div className="flex flex-wrap gap-2">
        {displayLabels.map((label) => {
          const active = exclusionLabels.includes(label)
          return (
            <button
              key={label}
              type="button"
              onClick={() => toggle(label)}
              className={`rounded border px-3 py-1 text-sm ${
                active
                  ? "border-primary bg-primary/10 text-foreground font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>
      <p className="text-muted-foreground text-xs">
        観点の中に選択したラベルのうち2種以上が現れたら違反とみなします。
      </p>
    </div>
  )
}
