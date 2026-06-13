"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  GlobalSettings,
  MajorNumberDisplayMode,
  Orientation,
  PaperSize,
} from "@/types/answerSheetDefinition.types"

import { PAPER_SIZE_OPTIONS } from "../../constants"
import { SliderWithInput } from "./SliderWithInput"

interface GlobalSettingsFormProps {
  settings: GlobalSettings
  onUpdate: (settings: Partial<GlobalSettings>) => void
}

/**
 * グローバル設定フォーム。
 * 用紙サイズ・余白・行高さ・列幅・フォントなどの全体設定を編集する。
 */
export function GlobalSettingsForm({
  settings,
  onUpdate,
}: GlobalSettingsFormProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-muted-foreground text-sm font-semibold">用紙設定</h3>

      {/* 用紙サイズ・向き・大問番号・組み方向（2×2で等幅に統一） */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">用紙サイズ</Label>
          <Select
            value={settings.paperSize}
            onValueChange={(v) => onUpdate({ paperSize: v as PaperSize })}
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAPER_SIZE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">向き</Label>
          <Select
            value={settings.orientation}
            onValueChange={(v) => onUpdate({ orientation: v as Orientation })}
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait">縦</SelectItem>
              <SelectItem value="landscape">横</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">大問番号</Label>
          <Select
            value={settings.numberDisplayMode}
            onValueChange={(v) =>
              onUpdate({ numberDisplayMode: v as MajorNumberDisplayMode })
            }
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="multirow">結合</SelectItem>
              <SelectItem value="boxed-top">四角</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">書字方向</Label>
          <Select
            value={settings.verticalLayout ? "vertical" : "horizontal"}
            onValueChange={(v) =>
              onUpdate({ verticalLayout: v === "vertical" })
            }
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="horizontal">横書き</SelectItem>
              <SelectItem value="vertical">縦書き（国語向け）</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 縦書き時の補足：段組みは上下方向になる */}
      {settings.verticalLayout && settings.multiColumn.enabled && (
        <p className="text-muted-foreground text-[10px]">
          縦書きでは段組みが上下方向（上下{settings.multiColumn.columnCount}
          段）になります。
        </p>
      )}

      {/* マージン */}
      <div className="space-y-2">
        <Label className="text-xs">余白 (mm)</Label>
        {(
          [
            ["top", "上"],
            ["bottom", "下"],
            ["left", "左"],
            ["right", "右"],
          ] as const
        ).map(([side, label]) => (
          <SliderWithInput
            key={side}
            label={label}
            value={settings.margins[side]}
            min={0}
            max={50}
            step={1}
            onChange={(v) =>
              onUpdate({ margins: { ...settings.margins, [side]: v } })
            }
          />
        ))}
      </div>

      {/* 行高さ */}
      <div className="space-y-2">
        <Label className="text-xs">基本行高さ (mm)</Label>
        <SliderWithInput
          label=""
          value={settings.baseRowHeight}
          min={5}
          max={50}
          step={1}
          onChange={(v) => onUpdate({ baseRowHeight: v })}
        />
      </div>

      {/* 列幅 */}
      <div className="space-y-2">
        <Label className="text-xs">列幅 (mm)</Label>
        <SliderWithInput
          label="大問番号"
          value={settings.columnWidths.majorNumber}
          min={5}
          max={30}
          step={1}
          onChange={(v) =>
            onUpdate({
              columnWidths: { ...settings.columnWidths, majorNumber: v },
            })
          }
        />
        <SliderWithInput
          label="小問番号"
          value={settings.columnWidths.subNumber}
          min={5}
          max={30}
          step={1}
          onChange={(v) =>
            onUpdate({
              columnWidths: { ...settings.columnWidths, subNumber: v },
            })
          }
        />
        <SliderWithInput
          label="枝問番号"
          value={settings.columnWidths.branchNumber}
          min={5}
          max={30}
          step={1}
          onChange={(v) =>
            onUpdate({
              columnWidths: { ...settings.columnWidths, branchNumber: v },
            })
          }
        />
      </div>

      {/* スペーシング */}
      <div className="space-y-2">
        <Label className="text-xs">スペーシング (mm)</Label>
        <SliderWithInput
          label="大問間"
          value={settings.spacing.majorQuestionSpacing}
          min={0}
          max={20}
          step={1}
          onChange={(v) =>
            onUpdate({
              spacing: { ...settings.spacing, majorQuestionSpacing: v },
            })
          }
        />
        <SliderWithInput
          label="ヘッダー"
          value={settings.spacing.headerHeight}
          min={0}
          max={50}
          step={1}
          onChange={(v) =>
            onUpdate({
              spacing: { ...settings.spacing, headerHeight: v },
            })
          }
        />
      </div>

      {/* フォントサイズ */}
      <div className="space-y-2">
        <Label className="text-xs">フォントサイズ (pt)</Label>
        <SliderWithInput
          label="テキスト"
          value={settings.fonts.defaultSize}
          min={2}
          max={24}
          step={0.5}
          onChange={(v) =>
            onUpdate({ fonts: { ...settings.fonts, defaultSize: v } })
          }
        />
        <SliderWithInput
          label="大問番号"
          value={settings.fonts.majorNumberSize}
          min={2}
          max={24}
          step={0.5}
          onChange={(v) =>
            onUpdate({ fonts: { ...settings.fonts, majorNumberSize: v } })
          }
        />
        <SliderWithInput
          label="小問番号"
          value={settings.fonts.subNumberSize}
          min={2}
          max={24}
          step={0.5}
          onChange={(v) =>
            onUpdate({ fonts: { ...settings.fonts, subNumberSize: v } })
          }
        />
        <SliderWithInput
          label="枝問番号"
          value={settings.fonts.branchNumberSize}
          min={2}
          max={24}
          step={0.5}
          onChange={(v) =>
            onUpdate({ fonts: { ...settings.fonts, branchNumberSize: v } })
          }
        />
      </div>
    </div>
  )
}
