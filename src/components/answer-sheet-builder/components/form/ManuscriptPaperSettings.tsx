"use client"

import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type {
  LineStyle,
  ManuscriptCharGuide,
  ManuscriptGuidePosition,
  ManuscriptPaperConfig,
} from "@/types/answerSheetDefinition.types"

import {
  DEFAULT_DASH_RATIO,
  DEFAULT_GAP_RATIO,
  DEFAULT_MANUSCRIPT_BOUNDARY_WIDTH,
  DEFAULT_MANUSCRIPT_GUIDE_FONT_RATIO,
  DEFAULT_MANUSCRIPT_GUIDE_PADDING_RATIO,
  DEFAULT_MANUSCRIPT_GUIDE_POSITION,
} from "../../constants"
import { SliderWithInput } from "./SliderWithInput"

interface ManuscriptPaperSettingsProps {
  config: ManuscriptPaperConfig | undefined
  onUpdate: (config: ManuscriptPaperConfig) => void
}

const DEFAULT_CONFIG: ManuscriptPaperConfig = {
  enabled: false,
  columns: 20,
  rows: 10,
}

const GUIDE_POSITION_LABELS: Record<ManuscriptGuidePosition, string> = {
  "bottom-left": "左下",
  "bottom-right": "右下",
  "top-left": "左上",
  "top-right": "右上",
}

/** 区切り罫線の選択肢（先頭は「なし」＝罫線なし） */
const BOUNDARY_NONE = "none"
const BOUNDARY_OPTIONS: { value: string; label: string }[] = [
  { value: BOUNDARY_NONE, label: "なし" },
  { value: "solid", label: "実線" },
  { value: "dashed", label: "破線" },
  { value: "dotted", label: "点線" },
]

export function ManuscriptPaperSettings({
  config,
  onUpdate,
}: ManuscriptPaperSettingsProps) {
  const current = config ?? DEFAULT_CONFIG

  const handleToggle = (enabled: boolean) => {
    onUpdate({ ...current, enabled })
  }

  const handleChange = (data: Partial<ManuscriptPaperConfig>) => {
    onUpdate({ ...current, ...data })
  }

  /** 入力値を [min, max] の整数に丸める。空欄・非数値は fallback（0設定によるエラーを防ぐ） */
  const clampInt = (
    raw: string,
    min: number,
    max: number,
    fallback: number
  ): number => {
    const n = Math.floor(Number(raw))
    if (!Number.isFinite(n)) return fallback
    return Math.min(max, Math.max(min, n))
  }

  const capacity = current.columns * current.rows
  const guides = current.charGuides ?? []

  const updateGuide = (index: number, data: Partial<ManuscriptCharGuide>) => {
    handleChange({
      charGuides: guides.map((guide, i) =>
        i === index ? { ...guide, ...data } : guide
      ),
    })
  }

  const addGuide = () => {
    // 既定は用紙容量（末尾マス）を指す。ラベルは数値を初期表示。
    const atChar = Math.min(capacity, 100)
    handleChange({
      charGuides: [...guides, { atChar, label: String(atChar) }],
    })
  }

  const removeGuide = (index: number) => {
    handleChange({ charGuides: guides.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">原稿用紙</Label>
        <Switch
          className="scale-75"
          checked={current.enabled}
          onCheckedChange={handleToggle}
        />
      </div>

      {current.enabled && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-muted-foreground text-[10px]">列数</Label>
            <Input
              type="number"
              className="h-7 text-xs"
              value={current.columns}
              min={1}
              max={40}
              onChange={(e) =>
                handleChange({
                  columns: clampInt(e.target.value, 1, 40, current.columns),
                })
              }
            />
          </div>
          <div>
            <Label className="text-muted-foreground text-[10px]">行数</Label>
            <Input
              type="number"
              className="h-7 text-xs"
              value={current.rows}
              min={1}
              max={20}
              onChange={(e) =>
                handleChange({
                  rows: clampInt(e.target.value, 1, 20, current.rows),
                })
              }
            />
          </div>
        </div>
      )}

      {current.enabled && (
        <div className="space-y-2 rounded border p-2">
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground text-[10px]">
              文字位置マーカー（数字ガイド・区切り罫線）
            </Label>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px]"
              onClick={addGuide}
            >
              <Plus className="mr-1 h-3 w-3" />
              追加
            </Button>
          </div>

          {guides.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-muted-foreground text-[10px]">
                  数字の表示位置
                </Label>
                <Select
                  value={
                    current.guidePosition ?? DEFAULT_MANUSCRIPT_GUIDE_POSITION
                  }
                  onValueChange={(v) =>
                    handleChange({
                      guidePosition: v as ManuscriptGuidePosition,
                    })
                  }
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GUIDE_POSITION_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <SliderWithInput
                  label="文字サイズ(マス比)"
                  value={
                    current.guideFontSize ?? DEFAULT_MANUSCRIPT_GUIDE_FONT_RATIO
                  }
                  min={0.05}
                  max={1}
                  step={0.05}
                  onChange={(v) => handleChange({ guideFontSize: v })}
                />
              </div>
              <div className="col-span-2">
                <SliderWithInput
                  label="余白(マス比)"
                  value={
                    current.guidePadding ??
                    DEFAULT_MANUSCRIPT_GUIDE_PADDING_RATIO
                  }
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) => handleChange({ guidePadding: v })}
                />
              </div>
            </div>
          )}

          {guides.map((guide, index) => (
            <div key={index} className="space-y-1 rounded border p-1.5">
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  className="h-7 w-16 text-xs"
                  value={guide.atChar}
                  min={1}
                  max={capacity}
                  title="先頭からの文字数"
                  onChange={(e) =>
                    updateGuide(index, {
                      atChar: clampInt(
                        e.target.value,
                        1,
                        capacity,
                        guide.atChar
                      ),
                    })
                  }
                />
                <span className="text-muted-foreground text-[10px]">字目</span>
                <Input
                  className="h-7 flex-1 text-xs"
                  value={guide.label}
                  placeholder="数字(空欄=罫線のみ)"
                  onChange={(e) =>
                    updateGuide(index, { label: e.target.value })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive h-6 w-6"
                  onClick={() => removeGuide(index)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground shrink-0 text-[10px]">
                  次の罫線
                </span>
                <Select
                  value={guide.boundary ?? BOUNDARY_NONE}
                  onValueChange={(v) =>
                    updateGuide(
                      index,
                      v === BOUNDARY_NONE
                        ? { boundary: undefined }
                        : { boundary: v as LineStyle }
                    )
                  }
                >
                  <SelectTrigger className="h-7 w-20 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOUNDARY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {guide.boundary && (
                  <div className="flex-1">
                    <SliderWithInput
                      label="太さ(mm)"
                      value={
                        guide.boundaryWidth ?? DEFAULT_MANUSCRIPT_BOUNDARY_WIDTH
                      }
                      min={0.1}
                      max={1.5}
                      step={0.1}
                      onChange={(v) => updateGuide(index, { boundaryWidth: v })}
                    />
                  </div>
                )}
              </div>
              {(guide.boundary === "dashed" || guide.boundary === "dotted") && (
                <div className="flex items-center gap-2 pl-2">
                  {guide.boundary === "dashed" && (
                    <div className="flex-1">
                      <SliderWithInput
                        label="破線長"
                        value={guide.boundaryDashRatio ?? DEFAULT_DASH_RATIO}
                        min={0.5}
                        max={10}
                        step={0.5}
                        onChange={(v) =>
                          updateGuide(index, { boundaryDashRatio: v })
                        }
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <SliderWithInput
                      label="間隔"
                      value={guide.boundaryGapRatio ?? DEFAULT_GAP_RATIO}
                      min={0.5}
                      max={10}
                      step={0.5}
                      onChange={(v) =>
                        updateGuide(index, { boundaryGapRatio: v })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {guides.length === 0 ? (
            <p className="text-muted-foreground text-[10px]">
              「追加」で先頭からの文字数の目印を作成。数字（例:
              80）と区切り罫線（○字以内/以上）を組み合わせられます。罫線のみ使うときは数字を空欄に。
            </p>
          ) : (
            <p className="text-muted-foreground text-[10px]">
              区切り罫線は、行末にある小計・大問罫線を置き換えません。
            </p>
          )}
        </div>
      )}
    </div>
  )
}
