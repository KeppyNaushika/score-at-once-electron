"use client"

import { toast } from "sonner"

import {
  type SidebarBehavior,
  type SidebarSectionConfig,
  useSidebarBehavior,
} from "@/components/layout/sidebarBehavior"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

const BEHAVIOR_OPTIONS: { behavior: SidebarBehavior; label: string }[] = [
  { behavior: "collapse", label: "縮小する" },
  { behavior: "expand", label: "展開する" },
  { behavior: "none", label: "変更しない" },
]

interface SidebarBehaviorRowProps {
  section: SidebarSectionConfig
}

/** 区分1つぶんのサイドバー動作。保存先はサイドバー本体と同じ購読（useSidebarBehavior）。 */
export function SidebarBehaviorRow({ section }: SidebarBehaviorRowProps) {
  const { behavior: currentBehavior, setBehavior } = useSidebarBehavior(section)

  const handleBehaviorChange = (
    nextBehavior: SidebarBehavior,
    optionLabel: string
  ) => {
    setBehavior(nextBehavior)
    toast.success(
      `${section.label}のサイドバー動作を「${optionLabel}」に設定しました`
    )
  }

  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm font-medium">{section.label}</Label>
      <div className="flex items-center gap-1.5">
        {BEHAVIOR_OPTIONS.map((option) => (
          <Button
            key={option.behavior}
            variant={
              currentBehavior === option.behavior ? "default" : "outline"
            }
            size="sm"
            onClick={() => handleBehaviorChange(option.behavior, option.label)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
