"use client"

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react"

import { Button } from "@/components/ui/button"

import { ShortcutTooltip } from "./ShortcutTooltip"

/** WASD 移動のボタン（並びは 左・上・下・右） */
const GRID_NAVIGATION_BUTTONS = [
  { direction: "a", label: "左に移動", icon: ArrowLeft },
  { direction: "w", label: "上に移動", icon: ArrowUp },
  { direction: "s", label: "下に移動", icon: ArrowDown },
  { direction: "d", label: "右に移動", icon: ArrowRight },
] as const

/** キーボードモードの WASD 移動 */
export function GridNavigationButtons({
  onGridNavigation,
}: {
  onGridNavigation: (direction: string) => void
}) {
  return (
    <div className="flex items-center justify-center gap-1">
      {GRID_NAVIGATION_BUTTONS.map((navigationButton) => {
        const Icon = navigationButton.icon
        return (
          <ShortcutTooltip
            key={navigationButton.direction}
            description={navigationButton.label}
            keys={[navigationButton.direction.toUpperCase()]}
          >
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-8"
              onClick={() => onGridNavigation(navigationButton.direction)}
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          </ShortcutTooltip>
        )
      })}
    </div>
  )
}
