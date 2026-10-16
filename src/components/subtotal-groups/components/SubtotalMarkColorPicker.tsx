"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { InlineColorPicker } from "@/components/ui/color-picker"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { OVERLAY_COLOR_PRESETS } from "@/types/scoringOverlay.types"

/** 未設定（null）を表す見本。白地に赤の斜線で「色なし」と分かるようにする */
const NO_COLOR_SWATCH_STYLE = {
  backgroundImage:
    "linear-gradient(to top right, transparent calc(50% - 1px), #ef4444 calc(50% - 1px), #ef4444 calc(50% + 1px), transparent calc(50% + 1px))",
}

interface SubtotalMarkColorPickerProps {
  /** 採点マークの色（HEX）。null は未設定＝試験全体の色で描く */
  markColor: string | null
  onChange: (markColor: string | null) => void
}

/**
 * 小計項目1つの「採点マークの色」を選ぶ。行の幅を取らないよう、見本のボタンから開く。
 * 色は「9. 結果と出力」の採点マークの色と同じ8色のプリセット＋任意の HEX で選ぶ
 */
export function SubtotalMarkColorPicker({
  markColor,
  onChange,
}: SubtotalMarkColorPickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 gap-2 px-2"
          aria-label="採点マークの色を選択"
        >
          <span
            className="h-5 w-5 shrink-0 rounded border bg-background"
            style={
              markColor === null
                ? NO_COLOR_SWATCH_STYLE
                : { backgroundColor: markColor }
            }
          />
          <span
            className={cn(
              "w-16 text-left text-xs",
              markColor === null ? "text-muted-foreground" : "font-mono"
            )}
          >
            {markColor ?? "色なし"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto space-y-3" align="end">
        <InlineColorPicker
          value={markColor ?? ""}
          onChange={onChange}
          presets={[...OVERLAY_COLOR_PRESETS]}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={markColor === null}
          onClick={() => {
            onChange(null)
            setOpen(false)
          }}
        >
          <span
            className="mr-2 h-4 w-4 rounded border bg-background"
            style={NO_COLOR_SWATCH_STYLE}
          />
          色なし（試験全体の色で描く）
        </Button>
      </PopoverContent>
    </Popover>
  )
}
