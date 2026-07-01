"use client"

import { Label } from "@/components/ui/label"
import {
  DEFAULT_MUTUAL_EXCLUSION_CONFIG,
  parseConfig,
} from "@/lib/gradeConstraints"
import type { MutualExclusionConfig } from "@/types/grade.types"

/** 混在禁止ルールの設定JSONを復元 */
export function parseMutualExclusion(raw: string): MutualExclusionConfig {
  return parseConfig(raw, DEFAULT_MUTUAL_EXCLUSION_CONFIG)
}

interface MutualExclusionFieldsProps {
  config: MutualExclusionConfig
  labels: string[]
  onChange: (config: MutualExclusionConfig) => void
}

export function MutualExclusionFields({
  config,
  labels,
  onChange,
}: MutualExclusionFieldsProps) {
  const displayLabels = labels.length > 0 ? labels : config.labels
  const toggle = (label: string) => {
    const next = config.labels.includes(label)
      ? config.labels.filter((l) => l !== label)
      : [...config.labels, label]
    onChange({ ...config, labels: next })
  }
  return (
    <div className="space-y-2 text-sm">
      <Label className="text-muted-foreground text-xs">
        同時に現れてはいけないラベル（2つ以上選択）
      </Label>
      <div className="flex flex-wrap gap-2">
        {displayLabels.map((label) => {
          const active = config.labels.includes(label)
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
