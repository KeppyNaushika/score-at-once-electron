"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  AbsentMethod,
  EstimationMode,
  GradeDataSourceWithRelations,
} from "@/types/grade.types"

const ABSENT_METHOD_LABELS: Record<AbsentMethod, string> = {
  null: "なし",
  zero: "0点",
  average: "平均比率法",
  regression: "重回帰法",
  equipercentile: "順位法",
  zscore: "標準偏差法",
}

/** 他ソースを説明変数に使う推定方法（推定ソース選択UI・R表示の対象） */
function methodUsesPredictors(method: AbsentMethod): boolean {
  return (
    method === "average" ||
    method === "regression" ||
    method === "equipercentile" ||
    method === "zscore"
  )
}

interface EstimationSettingsPopoverProps {
  dataSource: GradeDataSourceWithRelations
  /** 同じGrade内の全DataSource（自ソース含む、チェックリスト用） */
  allDataSources: GradeDataSourceWithRelations[]
  /** このソースのモデル適合度 R（他ソースからの予測しやすさ） */
  sourceFit?: { correlation: number; sampleSize: number } | null
  onUpdate: (
    id: string,
    data: {
      absentMethod?: string
      absentRatio?: number
      absentOffset?: number
      treatExpectedAsMissing?: boolean
      estimationMode?: string
      estimationSourceIds?: string[]
    }
  ) => Promise<{ success: boolean }>
}

export function EstimationSettingsPopover({
  dataSource,
  allDataSources,
  sourceFit,
  onUpdate,
}: EstimationSettingsPopoverProps) {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<AbsentMethod>(dataSource.absentMethod)
  const [ratio, setRatio] = useState(String(dataSource.absentRatio))
  const [offset, setOffset] = useState(String(dataSource.absentOffset))
  const [estimationMode, setEstimationMode] = useState<EstimationMode>(
    dataSource.estimationMode
  )
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(
    dataSource.estimationSources.map(
      (estimationSource) => estimationSource.sourceDataSourceId
    )
  )
  const [treatExpectedAsMissing, setTreatExpectedAsMissing] = useState(
    dataSource.treatExpectedAsMissing
  )

  const isExamSource =
    dataSource.type === "exam_total" ||
    dataSource.type === "subtotal" ||
    dataSource.type === "crop_region"

  const handleSave = async () => {
    await onUpdate(dataSource.id, {
      absentMethod: method,
      absentRatio: Number(ratio) || 1,
      absentOffset: Number(offset) || 0,
      treatExpectedAsMissing,
      estimationMode,
      estimationSourceIds: selectedSourceIds,
    })
    setOpen(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      // Popoverを開く時に最新のデータソース値を反映
      setMethod(dataSource.absentMethod)
      setRatio(String(dataSource.absentRatio))
      setOffset(String(dataSource.absentOffset))
      setEstimationMode(dataSource.estimationMode)
      setSelectedSourceIds(
        dataSource.estimationSources.map(
          (estimationSource) => estimationSource.sourceDataSourceId
        )
      )
      setTreatExpectedAsMissing(dataSource.treatExpectedAsMissing)
    }
    setOpen(newOpen)
  }

  const toggleSourceId = (id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id)
        ? prev.filter((sourceId) => sourceId !== id)
        : [...prev, id]
    )
  }

  // トリガーボタンのラベル（propsから直接計算して一括設定の反映に対応）
  const triggerLabel = (() => {
    if (dataSource.absentMethod === "null") return null
    const methodLabel = ABSENT_METHOD_LABELS[dataSource.absentMethod]
    const sourceCount =
      dataSource.estimationMode === "selected"
        ? dataSource.estimationSources.length
        : allDataSources.filter(
            (candidateSource) => candidateSource.id !== dataSource.id
          ).length
    const modeLabel =
      dataSource.estimationMode === "selected"
        ? `選(${sourceCount})`
        : `全(${sourceCount})`
    const parts = [methodLabel, modeLabel]
    if (dataSource.absentRatio !== 1 || dataSource.absentOffset !== 0) {
      const ratioText =
        dataSource.absentRatio !== 1 ? `×${dataSource.absentRatio}` : ""
      const offsetText =
        dataSource.absentOffset !== 0
          ? `${dataSource.absentOffset > 0 ? "+" : ""}${dataSource.absentOffset}`
          : ""
      parts.push(ratioText + offsetText)
    }
    return parts.join(" ")
  })()

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {triggerLabel ? (
          <Button
            variant="outline"
            size="sm"
            className="h-6 rounded-full border-amber-300 bg-amber-50 px-2 text-xs text-amber-700 hover:bg-amber-100"
          >
            {triggerLabel}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-6 rounded-full px-2 text-xs text-muted-foreground"
          >
            なし
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <h4 className="text-sm font-medium">欠測時推定設定</h4>

          {/* 推定方法 */}
          <div className="space-y-1.5">
            <Label className="text-xs">推定方法</Label>
            <Select
              value={method}
              onValueChange={(value) => setMethod(value as AbsentMethod)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">なし</SelectItem>
                <SelectItem value="zero">0点</SelectItem>
                <SelectItem value="average">平均比率法</SelectItem>
                <SelectItem value="regression">重回帰法</SelectItem>
                <SelectItem value="equipercentile">順位法</SelectItem>
                <SelectItem value="zscore">標準偏差法</SelectItem>
              </SelectContent>
            </Select>
            {/* このソースが他ソースからどれだけ当てられるか（手法選択の判断材料）。
                R は手法に依らないデータ側の予測しやすさ＝重回帰の縮小率。
                高いほど重回帰でも中心へ寄りにくく、低いほど順位法・標準偏差法の
                「縮小を避ける」利点が効く。 */}
            {methodUsesPredictors(method) &&
              (sourceFit ? (
                <p className="text-xs text-muted-foreground">
                  予測しやすさ 相関 R ={" "}
                  <span className="font-medium tabular-nums">
                    {sourceFit.correlation.toFixed(2)}
                  </span>
                  {sourceFit.correlation >= 0.999 ? (
                    <span className="text-amber-700 dark:text-amber-300">
                      （他ソースから完全再現＝定義上のつながり。予測ではなく復元）
                    </span>
                  ) : (
                    <>
                      （実力の約{Math.round(sourceFit.correlation * 100)}
                      %を反映／残り約
                      {100 - Math.round(sourceFit.correlation * 100)}
                      %は中心へ寄る・n={sourceFit.sampleSize}）
                    </>
                  )}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  予測しやすさ R: 算出不能（サンプルまたは共通ソース不足）
                </p>
              ))}
          </div>

          {method !== "null" && (
            <>
              {/* 乗率・加減点 */}
              {method !== "zero" && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">乗率</Label>
                    <Input
                      value={ratio}
                      onChange={(e) => setRatio(e.target.value)}
                      className="h-7 text-xs"
                      type="text"
                      placeholder="1.0"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">加減点</Label>
                    <Input
                      value={offset}
                      onChange={(e) => setOffset(e.target.value)}
                      className="h-7 text-xs"
                      type="text"
                      placeholder="0"
                    />
                  </div>
                </div>
              )}

              {/* ソース選択（他ソースを説明変数に使う手法のみ） */}
              {methodUsesPredictors(method) && (
                <div className="space-y-2">
                  <Label className="text-xs">推定に使用するソース</Label>
                  <RadioGroup
                    value={estimationMode}
                    onValueChange={(value) =>
                      setEstimationMode(value as EstimationMode)
                    }
                    className="gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="all" id="mode-all" />
                      <Label htmlFor="mode-all" className="text-xs font-normal">
                        自ソース以外の全て
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="selected" id="mode-selected" />
                      <Label
                        htmlFor="mode-selected"
                        className="text-xs font-normal"
                      >
                        選択
                      </Label>
                    </div>
                  </RadioGroup>

                  {estimationMode === "selected" && (
                    <div className="max-h-36 space-y-1 overflow-y-auto rounded border p-2">
                      {allDataSources.map((candidateSource) => {
                        const isSelf = candidateSource.id === dataSource.id
                        return (
                          <div
                            key={candidateSource.id}
                            className={`flex items-center gap-2 ${isSelf ? "opacity-40" : ""}`}
                          >
                            <Checkbox
                              checked={selectedSourceIds.includes(
                                candidateSource.id
                              )}
                              onCheckedChange={() =>
                                !isSelf && toggleSourceId(candidateSource.id)
                              }
                              disabled={isSelf}
                              className="h-3.5 w-3.5"
                            />
                            <span className="truncate text-xs">
                              {candidateSource.name}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 見込→欠測（試験DSのみ） */}
              {isExamSource && (
                <div className="flex items-center gap-2 border-t pt-3">
                  <Checkbox
                    checked={treatExpectedAsMissing}
                    onCheckedChange={(value) =>
                      setTreatExpectedAsMissing(value === true)
                    }
                    id="treat-expected"
                    className="h-3.5 w-3.5"
                  />
                  <Label
                    htmlFor="treat-expected"
                    className="text-xs font-normal"
                  >
                    受験状態「見込」を欠測とする
                  </Label>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setOpen(false)}
            >
              取消
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
              適用
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
