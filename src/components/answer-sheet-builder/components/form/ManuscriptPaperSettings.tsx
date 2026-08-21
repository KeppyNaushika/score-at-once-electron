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
  AsbCharGuideAttributes,
  AsbManuscriptPaperSettings,
  BorderLineStyle,
  ManuscriptCharGuide,
  ManuscriptGuidePosition,
  ManuscriptPaper,
} from "@/types/answerSheetDefinition.types"
import {
  MANUSCRIPT_GUIDE_POSITIONS,
  toManuscriptGuidePosition,
} from "@/types/answerSheetDefinition.types"

import {
  DEFAULT_DASH_RATIO,
  DEFAULT_GAP_RATIO,
  DEFAULT_MANUSCRIPT_BOUNDARY_WIDTH,
  DEFAULT_MANUSCRIPT_GUIDE_FONT_RATIO,
  DEFAULT_MANUSCRIPT_GUIDE_PADDING_RATIO,
  DEFAULT_MANUSCRIPT_GUIDE_POSITION,
  DEFAULT_MANUSCRIPT_PAPER,
  generateId,
} from "../../constants"
import { SliderWithInput } from "./SliderWithInput"

interface ManuscriptPaperSettingsProps {
  /** セルの原稿用紙。無い＝一度も使っていない */
  manuscriptPaper: ManuscriptPaper | undefined
  /**
   * 段の幅に収まる最大列数。マス目は `基準行高 × 倍率` の正方形なので、
   * 段の幅・番号欄の幅・倍率から決まる。
   *
   * **入力をここで止めるためのもので、既にこれを超えている定義は切り詰めない。**
   * 超過はそのまま描き、警告だけを出す（勝手に値を書き換えると「なぜ列数が減ったのか」を
   * 後から追えなくなる）。
   */
  maxColumns: number
  /** 使うかどうかの切り替え。オンにすると行ができる */
  onSetEnabled: (enabled: boolean) => void
  /** 原稿用紙そのものの設定（オンオフと文字位置マーカーは別の実体・別の意図） */
  onUpdateSettings: (
    manuscriptPaperId: string,
    data: Partial<AsbManuscriptPaperSettings>
  ) => void
  onAddCharGuide: (
    manuscriptPaperId: string,
    charGuide: ManuscriptCharGuide
  ) => void
  onUpdateCharGuide: (
    charGuideId: string,
    data: Partial<AsbCharGuideAttributes>
  ) => void
  onDeleteCharGuide: (charGuideId: string) => void
}

/** 表示名だけ。並びと値の集合は `MANUSCRIPT_GUIDE_POSITIONS` が唯一の持ち主 */
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
  manuscriptPaper,
  maxColumns,
  onSetEnabled,
  onUpdateSettings,
  onAddCharGuide,
  onUpdateCharGuide,
  onDeleteCharGuide,
}: ManuscriptPaperSettingsProps) {
  // 行がまだ無いセルでは既定の姿を見せる（スイッチはオフ）。実体を作るのはオンにしたとき
  const current = manuscriptPaper ?? DEFAULT_MANUSCRIPT_PAPER

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
  const columnsOverflow = current.columns > maxColumns

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">原稿用紙</Label>
        <Switch
          className="scale-75"
          checked={current.enabled}
          onCheckedChange={onSetEnabled}
        />
      </div>

      {manuscriptPaper?.enabled && (
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">列数</Label>
              <Input
                type="number"
                className="h-7 text-xs"
                value={manuscriptPaper.columns}
                min={1}
                max={maxColumns}
                onChange={(e) =>
                  onUpdateSettings(manuscriptPaper.id, {
                    columns: clampInt(
                      e.target.value,
                      1,
                      maxColumns,
                      manuscriptPaper.columns
                    ),
                  })
                }
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">行数</Label>
              <Input
                type="number"
                className="h-7 text-xs"
                value={manuscriptPaper.rows}
                min={1}
                max={20}
                onChange={(e) =>
                  onUpdateSettings(manuscriptPaper.id, {
                    rows: clampInt(e.target.value, 1, 20, manuscriptPaper.rows),
                  })
                }
              />
            </div>
          </div>
          {columnsOverflow ? (
            <p className="text-[10px] text-destructive">
              {`この段幅では最大${maxColumns}マスです。いまの${manuscriptPaper.columns}マスは枠と用紙からはみ出して描かれます（値はそのまま残しています）。`}
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              {`この段幅では最大${maxColumns}マス`}
            </p>
          )}
        </div>
      )}

      {manuscriptPaper?.enabled && (
        <div className="space-y-2 rounded border p-2">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground">
              文字位置マーカー（数字ガイド・区切り罫線）
            </Label>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px]"
              onClick={() => {
                // 既定は用紙容量（末尾マス）を指す。ラベルは数値を初期表示
                const atChar = Math.min(capacity, 100)
                onAddCharGuide(manuscriptPaper.id, {
                  id: generateId(),
                  atChar,
                  label: String(atChar),
                })
              }}
            >
              <Plus className="mr-1 h-3 w-3" />
              追加
            </Button>
          </div>

          {manuscriptPaper.charGuides.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">
                  数字の表示位置
                </Label>
                <Select
                  value={
                    manuscriptPaper.guidePosition ??
                    DEFAULT_MANUSCRIPT_GUIDE_POSITION
                  }
                  onValueChange={(value) =>
                    onUpdateSettings(manuscriptPaper.id, {
                      guidePosition: toManuscriptGuidePosition(value),
                    })
                  }
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MANUSCRIPT_GUIDE_POSITIONS.map((position) => (
                      <SelectItem key={position} value={position}>
                        {GUIDE_POSITION_LABELS[position]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <SliderWithInput
                  label="文字サイズ(マス比)"
                  value={
                    manuscriptPaper.guideFontSize ??
                    DEFAULT_MANUSCRIPT_GUIDE_FONT_RATIO
                  }
                  min={0.05}
                  max={1}
                  step={0.05}
                  onChange={(guideFontSize) =>
                    onUpdateSettings(manuscriptPaper.id, { guideFontSize })
                  }
                />
              </div>
              <div className="col-span-2">
                <SliderWithInput
                  label="余白(マス比)"
                  value={
                    manuscriptPaper.guidePadding ??
                    DEFAULT_MANUSCRIPT_GUIDE_PADDING_RATIO
                  }
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(guidePadding) =>
                    onUpdateSettings(manuscriptPaper.id, { guidePadding })
                  }
                />
              </div>
            </div>
          )}

          {manuscriptPaper.charGuides.map((charGuide) => (
            <div key={charGuide.id} className="space-y-1 rounded border p-1.5">
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  className="h-7 w-16 text-xs"
                  value={charGuide.atChar}
                  min={1}
                  max={capacity}
                  title="先頭からの文字数"
                  onChange={(e) =>
                    onUpdateCharGuide(charGuide.id, {
                      atChar: clampInt(
                        e.target.value,
                        1,
                        capacity,
                        charGuide.atChar
                      ),
                    })
                  }
                />
                <span className="text-[10px] text-muted-foreground">字目</span>
                <Input
                  className="h-7 flex-1 text-xs"
                  value={charGuide.label}
                  placeholder="数字(空欄=罫線のみ)"
                  onChange={(e) =>
                    onUpdateCharGuide(charGuide.id, { label: e.target.value })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={() => onDeleteCharGuide(charGuide.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  次の罫線
                </span>
                <Select
                  value={charGuide.boundary ?? BOUNDARY_NONE}
                  onValueChange={(v) =>
                    onUpdateCharGuide(
                      charGuide.id,
                      v === BOUNDARY_NONE
                        ? { boundary: undefined }
                        : { boundary: v as BorderLineStyle }
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
                {charGuide.boundary && (
                  <div className="flex-1">
                    <SliderWithInput
                      label="太さ(mm)"
                      value={
                        charGuide.boundaryWidth ??
                        DEFAULT_MANUSCRIPT_BOUNDARY_WIDTH
                      }
                      min={0.1}
                      max={1.5}
                      step={0.1}
                      onChange={(v) =>
                        onUpdateCharGuide(charGuide.id, { boundaryWidth: v })
                      }
                    />
                  </div>
                )}
              </div>
              {(charGuide.boundary === "dashed" ||
                charGuide.boundary === "dotted") && (
                <div className="flex items-center gap-2 pl-2">
                  {charGuide.boundary === "dashed" && (
                    <div className="flex-1">
                      <SliderWithInput
                        label="破線長"
                        value={
                          charGuide.boundaryDashRatio ?? DEFAULT_DASH_RATIO
                        }
                        min={0.5}
                        max={10}
                        step={0.5}
                        onChange={(v) =>
                          onUpdateCharGuide(charGuide.id, {
                            boundaryDashRatio: v,
                          })
                        }
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <SliderWithInput
                      label="間隔"
                      value={charGuide.boundaryGapRatio ?? DEFAULT_GAP_RATIO}
                      min={0.5}
                      max={10}
                      step={0.5}
                      onChange={(v) =>
                        onUpdateCharGuide(charGuide.id, { boundaryGapRatio: v })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {manuscriptPaper.charGuides.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">
              「追加」で先頭からの文字数の目印を作成。数字（例:
              80）と区切り罫線（○字以内/以上）を組み合わせられます。罫線のみ使うときは数字を空欄に。
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              区切り罫線は、行末にある小計・大問罫線を置き換えません。
            </p>
          )}
        </div>
      )}
    </div>
  )
}
