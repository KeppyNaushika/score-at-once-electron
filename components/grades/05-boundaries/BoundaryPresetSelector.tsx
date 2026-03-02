"use client"

import { Button } from "@/components/ui/button"

const presets = [
  {
    label: "5段階（A-E）",
    boundaries: [
      { label: "A", minPercentage: 84, order: 0 },
      { label: "B", minPercentage: 75, order: 1 },
      { label: "C", minPercentage: 50, order: 2 },
      { label: "D", minPercentage: 20, order: 3 },
      { label: "E", minPercentage: 0, order: 4 },
    ],
  },
  {
    label: "3段階（A/B/C）",
    boundaries: [
      { label: "A", minPercentage: 80, order: 0 },
      { label: "B", minPercentage: 50, order: 1 },
      { label: "C", minPercentage: 0, order: 2 },
    ],
  },
  {
    label: "5段階（5-1）",
    boundaries: [
      { label: "5", minPercentage: 84, order: 0 },
      { label: "4", minPercentage: 75, order: 1 },
      { label: "3", minPercentage: 50, order: 2 },
      { label: "2", minPercentage: 20, order: 3 },
      { label: "1", minPercentage: 0, order: 4 },
    ],
  },
  {
    label: "10段階",
    boundaries: [
      { label: "10", minPercentage: 95, order: 0 },
      { label: "9", minPercentage: 85, order: 1 },
      { label: "8", minPercentage: 75, order: 2 },
      { label: "7", minPercentage: 65, order: 3 },
      { label: "6", minPercentage: 55, order: 4 },
      { label: "5", minPercentage: 45, order: 5 },
      { label: "4", minPercentage: 35, order: 6 },
      { label: "3", minPercentage: 25, order: 7 },
      { label: "2", minPercentage: 15, order: 8 },
      { label: "1", minPercentage: 0, order: 9 },
    ],
  },
]

interface BoundaryPresetSelectorProps {
  onSelect: (
    boundaries: { label: string; minPercentage: number; order: number }[]
  ) => void
}

export function BoundaryPresetSelector({
  onSelect,
}: BoundaryPresetSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="text-muted-foreground self-center text-xs">
        プリセット:
      </span>
      {presets.map((preset) => (
        <Button
          key={preset.label}
          variant="outline"
          size="sm"
          onClick={() => onSelect(preset.boundaries)}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  )
}
