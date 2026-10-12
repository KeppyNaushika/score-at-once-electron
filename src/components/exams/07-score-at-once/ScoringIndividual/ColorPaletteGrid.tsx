"use client"

import { Label } from "@/components/ui/label"

import { COLOR_PALETTE } from "./constants/drawingConstants"

interface ColorPaletteGridProps {
  /** 見出し（「色」「テキスト色」など） */
  label: string
  selectedColor: string
  onColorChange: (color: string) => void
}

/**
 * 描画ツール設定 Popover の色選択（COLOR_PALETTE を8列で並べる）
 */
export function ColorPaletteGrid({
  label,
  selectedColor,
  onColorChange,
}: ColorPaletteGridProps) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1 grid grid-cols-8 gap-1">
        {COLOR_PALETTE.map((color) => (
          <button
            key={color}
            onClick={(e) => {
              e.stopPropagation()
              onColorChange(color)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`h-5 w-5 rounded border transition-transform hover:scale-110 ${
              selectedColor === color
                ? "border-2 border-gray-800"
                : "border-gray-300"
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  )
}
