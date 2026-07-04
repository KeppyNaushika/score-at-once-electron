"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DEFAULT_CONSISTENCY_CONFIG, parseConfig } from "@/lib/gradeConstraints"
import type { ConsistencyConfig } from "@/types/grade.types"

/** 整合ルールの設定JSONを復元 */
export function parseConsistency(raw: string): ConsistencyConfig {
  return parseConfig(raw, DEFAULT_CONSISTENCY_CONFIG)
}

interface ConsistencyFieldsProps {
  config: ConsistencyConfig
  labels: string[]
  itemNames: string[]
  onChange: (config: ConsistencyConfig) => void
}

export function ConsistencyFields({
  config,
  labels,
  itemNames,
  onChange,
}: ConsistencyFieldsProps) {
  // ラベル値は A/B/C 等の非数値ラベルのみ（数値ラベルはそのまま数値化される）
  const valueLabels = (
    labels.length > 0 ? labels : Object.keys(config.labelValues)
  ).filter((label) => Number.isNaN(Number(label)))

  const target = config.target
  const viewpointNames = itemNames.filter((itemName) => itemName !== target)
  const effectiveViewpoints =
    config.viewpointItems && config.viewpointItems.length > 0
      ? config.viewpointItems
      : viewpointNames

  const toggleViewpoint = (name: string) => {
    const viewpointSet = new Set(effectiveViewpoints)
    if (viewpointSet.has(name)) viewpointSet.delete(name)
    else viewpointSet.add(name)
    onChange({ ...config, viewpointItems: [...viewpointSet] })
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-muted-foreground text-xs">
            評定（比較先の項目）
          </Label>
          <Select
            value={target}
            onValueChange={(value) =>
              onChange({
                ...config,
                target: value,
                viewpointItems: itemNames.filter(
                  (itemName) => itemName !== value
                ),
              })
            }
          >
            <SelectTrigger className="mt-1 h-8 w-44">
              <SelectValue placeholder="項目を選択" />
            </SelectTrigger>
            <SelectContent>
              {itemNames.map((itemName) => (
                <SelectItem key={itemName} value={itemName}>
                  {itemName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">集計</Label>
          <Select
            value={config.aggregate}
            onValueChange={(value) =>
              onChange({
                ...config,
                aggregate: value as ConsistencyConfig["aggregate"],
              })
            }
          >
            <SelectTrigger className="mt-1 h-8 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="average">平均</SelectItem>
              <SelectItem value="sum">合計</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">許容差 ±</Label>
          <Input
            type="number"
            step="0.1"
            value={config.tolerance}
            onChange={(e) =>
              onChange({ ...config, tolerance: Number(e.target.value) })
            }
            className="mt-1 h-8 w-20"
          />
        </div>
      </div>

      <div>
        <Label className="text-muted-foreground text-xs">
          集計する観点（{config.aggregate === "sum" ? "合計" : "平均"}
          をとる項目）
        </Label>
        <div className="mt-1 flex flex-wrap gap-2">
          {viewpointNames.map((name) => {
            const active = effectiveViewpoints.includes(name)
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleViewpoint(name)}
                className={`rounded border px-2 py-1 text-xs ${
                  active
                    ? "border-primary bg-primary/10 text-foreground font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {name}
              </button>
            )
          })}
        </div>
      </div>

      {valueLabels.length > 0 && (
        <div>
          <Label className="text-muted-foreground text-xs">
            ラベル値（観点の A/B/C 等を数値に換算）
          </Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {valueLabels.map((label) => (
              <div key={label} className="flex items-center gap-1">
                <span className="w-5 text-center font-medium">{label}</span>
                <Input
                  type="number"
                  value={config.labelValues[label] ?? 0}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      labelValues: {
                        ...config.labelValues,
                        [label]: Number(e.target.value),
                      },
                    })
                  }
                  className="h-8 w-16"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        「{target || "（未選択）"}」と、選んだ観点の
        {config.aggregate === "sum" ? "合計" : "平均"}の差が {config.tolerance}{" "}
        を超えたら違反とみなします。
      </p>
    </div>
  )
}
