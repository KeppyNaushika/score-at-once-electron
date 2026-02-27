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
  GlobalSettings,
  Orientation,
  PaperSize,
} from "@/types/answerSheetBuilder.types"

import { PAPER_SIZE_OPTIONS } from "../../constants"

interface GlobalSettingsFormProps {
  settings: GlobalSettings
  onUpdate: (settings: Partial<GlobalSettings>) => void
}

export function GlobalSettingsForm({
  settings,
  onUpdate,
}: GlobalSettingsFormProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-muted-foreground text-sm font-semibold">用紙設定</h3>

      {/* 用紙サイズ・向き */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">用紙サイズ</Label>
          <Select
            value={settings.paperSize}
            onValueChange={(v) => onUpdate({ paperSize: v as PaperSize })}
          >
            <SelectTrigger className="h-8 text-xs">
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
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait">縦</SelectItem>
              <SelectItem value="landscape">横</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* マージン */}
      <div>
        <Label className="text-xs">余白 (mm)</Label>
        <div className="grid grid-cols-4 gap-2">
          {(["top", "bottom", "left", "right"] as const).map((side) => (
            <div key={side}>
              <Label className="text-muted-foreground text-[10px]">
                {side === "top"
                  ? "上"
                  : side === "bottom"
                    ? "下"
                    : side === "left"
                      ? "左"
                      : "右"}
              </Label>
              <Input
                type="number"
                className="h-7 text-xs"
                value={settings.margins[side]}
                min={0}
                max={50}
                onChange={(e) =>
                  onUpdate({
                    margins: {
                      ...settings.margins,
                      [side]: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
          ))}
        </div>
      </div>

      {/* 行高さ */}
      <div>
        <Label className="text-xs">基本行高さ (mm)</Label>
        <Input
          type="number"
          className="h-8 text-xs"
          value={settings.baseRowHeight}
          min={5}
          max={50}
          step={1}
          onChange={(e) => onUpdate({ baseRowHeight: Number(e.target.value) })}
        />
      </div>

      {/* 列幅 */}
      <div>
        <Label className="text-xs">列幅 (mm)</Label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-muted-foreground text-[10px]">
              大問番号
            </Label>
            <Input
              type="number"
              className="h-7 text-xs"
              value={settings.columnWidths.majorNumber}
              min={5}
              max={30}
              onChange={(e) =>
                onUpdate({
                  columnWidths: {
                    ...settings.columnWidths,
                    majorNumber: Number(e.target.value),
                  },
                })
              }
            />
          </div>
          <div>
            <Label className="text-muted-foreground text-[10px]">
              小問番号
            </Label>
            <Input
              type="number"
              className="h-7 text-xs"
              value={settings.columnWidths.subNumber}
              min={5}
              max={30}
              onChange={(e) =>
                onUpdate({
                  columnWidths: {
                    ...settings.columnWidths,
                    subNumber: Number(e.target.value),
                  },
                })
              }
            />
          </div>
          <div>
            <Label className="text-muted-foreground text-[10px]">
              枝問番号
            </Label>
            <Input
              type="number"
              className="h-7 text-xs"
              value={settings.columnWidths.branchNumber}
              min={5}
              max={30}
              onChange={(e) =>
                onUpdate({
                  columnWidths: {
                    ...settings.columnWidths,
                    branchNumber: Number(e.target.value),
                  },
                })
              }
            />
          </div>
        </div>
      </div>

      {/* 大問間スペーシング */}
      <div>
        <Label className="text-xs">大問間スペース (mm)</Label>
        <Input
          type="number"
          className="h-8 text-xs"
          value={settings.spacing.majorQuestionSpacing}
          min={0}
          max={20}
          onChange={(e) =>
            onUpdate({
              spacing: {
                ...settings.spacing,
                majorQuestionSpacing: Number(e.target.value),
              },
            })
          }
        />
      </div>

      {/* フォントサイズ */}
      <div>
        <Label className="text-xs">フォントサイズ (pt)</Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-muted-foreground text-[10px]">
              テキスト
            </Label>
            <Input
              type="number"
              className="h-7 text-xs"
              value={settings.fonts.defaultSize}
              min={6}
              max={24}
              step={0.5}
              onChange={(e) =>
                onUpdate({
                  fonts: {
                    ...settings.fonts,
                    defaultSize: Number(e.target.value),
                  },
                })
              }
            />
          </div>
          <div>
            <Label className="text-muted-foreground text-[10px]">
              設問番号
            </Label>
            <Input
              type="number"
              className="h-7 text-xs"
              value={settings.fonts.numberSize}
              min={6}
              max={24}
              step={0.5}
              onChange={(e) =>
                onUpdate({
                  fonts: {
                    ...settings.fonts,
                    numberSize: Number(e.target.value),
                  },
                })
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
