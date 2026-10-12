"use client"

import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"

interface StrokeWidthSliderProps {
  strokeWidth: number
  onStrokeWidthChange: (width: number) => void
}

/**
 * 描画ツール設定 Popover の線幅スライダー（0.1〜5.0mm、0.1mm 刻み）
 */
export function StrokeWidthSlider({
  strokeWidth,
  onStrokeWidthChange,
}: StrokeWidthSliderProps) {
  return (
    <div onPointerDown={(e) => e.stopPropagation()}>
      <Label className="text-xs">線幅: {strokeWidth}mm</Label>
      <Slider
        min={0.1}
        max={5.0}
        step={0.1}
        value={[strokeWidth]}
        onValueChange={(value) =>
          onStrokeWidthChange(Math.round(value[0] * 10) / 10)
        }
        className="mt-2"
      />
    </div>
  )
}
