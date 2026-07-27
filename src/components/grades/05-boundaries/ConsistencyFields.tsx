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
import type {
  ConstraintAggregate,
  GradeConstraintInput,
} from "@/types/grade.types"

interface ConsistencyFieldsProps {
  /** 比較先の「評定」にあたる評価項目。未選択なら null */
  targetGradeItemId: string | null
  aggregate: ConstraintAggregate
  tolerance: number
  /** 集計対象の観点の評価項目id。空なら比較先以外の全項目が対象 */
  viewpointGradeItemIds: string[]
  /** ラベル→数値の対応 */
  labelValues: Record<string, number>
  /** 境界セットに登場する全ラベル */
  labels: string[]
  gradeItems: { id: string; name: string }[]
  onChange: (patch: Partial<GradeConstraintInput>) => void
}

export function ConsistencyFields({
  targetGradeItemId,
  aggregate,
  tolerance,
  viewpointGradeItemIds,
  labelValues,
  labels,
  gradeItems,
  onChange,
}: ConsistencyFieldsProps) {
  // ラベル値は A/B/C 等の非数値ラベルのみ（数値ラベルはそのまま数値化される）
  const valueLabels = (
    labels.length > 0 ? labels : Object.keys(labelValues)
  ).filter((label) => Number.isNaN(Number(label)))

  const viewpointCandidates = gradeItems.filter(
    (gradeItem) => gradeItem.id !== targetGradeItemId
  )
  // 未指定は「比較先以外の全項目」を意味するので、表示上は全候補を選択済みとして扱う
  const effectiveViewpointIds =
    viewpointGradeItemIds.length > 0
      ? viewpointGradeItemIds
      : viewpointCandidates.map((gradeItem) => gradeItem.id)

  const targetName =
    gradeItems.find((gradeItem) => gradeItem.id === targetGradeItemId)?.name ??
    ""

  const toggleViewpoint = (gradeItemId: string) => {
    const viewpointSet = new Set(effectiveViewpointIds)
    if (viewpointSet.has(gradeItemId)) viewpointSet.delete(gradeItemId)
    else viewpointSet.add(gradeItemId)
    onChange({ viewpointGradeItemIds: [...viewpointSet] })
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-muted-foreground text-xs">
            評定（比較先の項目）
          </Label>
          <Select
            value={targetGradeItemId ?? ""}
            onValueChange={(value) =>
              onChange({
                targetGradeItemId: value,
                viewpointGradeItemIds: gradeItems
                  .filter((gradeItem) => gradeItem.id !== value)
                  .map((gradeItem) => gradeItem.id),
              })
            }
          >
            <SelectTrigger className="mt-1 h-8 w-44">
              <SelectValue placeholder="項目を選択" />
            </SelectTrigger>
            <SelectContent>
              {gradeItems.map((gradeItem) => (
                <SelectItem key={gradeItem.id} value={gradeItem.id}>
                  {gradeItem.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">集計</Label>
          <Select
            value={aggregate}
            onValueChange={(value) =>
              onChange({ aggregate: value as ConstraintAggregate })
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
            value={tolerance}
            onChange={(e) => onChange({ tolerance: Number(e.target.value) })}
            className="mt-1 h-8 w-20"
          />
        </div>
      </div>

      <div>
        <Label className="text-muted-foreground text-xs">
          集計する観点（{aggregate === "sum" ? "合計" : "平均"}
          をとる項目）
        </Label>
        <div className="mt-1 flex flex-wrap gap-2">
          {viewpointCandidates.map((gradeItem) => {
            const active = effectiveViewpointIds.includes(gradeItem.id)
            return (
              <button
                key={gradeItem.id}
                type="button"
                onClick={() => toggleViewpoint(gradeItem.id)}
                className={`rounded border px-2 py-1 text-xs ${
                  active
                    ? "border-primary bg-primary/10 text-foreground font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {gradeItem.name}
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
                  value={labelValues[label] ?? 0}
                  onChange={(e) =>
                    onChange({
                      labelValues: {
                        ...labelValues,
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
        「{targetName || "（未選択）"}」と、選んだ観点の
        {aggregate === "sum" ? "合計" : "平均"}の差が {tolerance}{" "}
        を超えたら違反とみなします。
      </p>
    </div>
  )
}
