"use client"

import type { LucideIcon } from "lucide-react"
import type { ComponentProps } from "react"

import { Button } from "@/components/ui/button"

/** 絞り込みのボタン1つの色（入のときは塗り、切のときは線と文字だけ） */
export interface FilterToggleColors {
  bg: string
  text: string
  icon: string
}

type FilterToggleButtonProps = Omit<
  ComponentProps<typeof Button>,
  "children" | "style" | "onClick"
> & {
  label: string
  icon: LucideIcon
  colors: FilterToggleColors
  isActive: boolean
  onToggle: () => void
}

/**
 * 絞り込みの切り替えボタン1つ（採点状態の7色・AI採点モードの確信度で同じ形）。
 * 入は塗り＋色の文字＋色の線、切は透明の地に色の文字と線。Tooltip の中に置けるよう、
 * 受け取ったほかの属性はそのまま Button へ渡す
 */
export function FilterToggleButton({
  label,
  icon: Icon,
  colors,
  isActive,
  onToggle,
  ...buttonProps
}: FilterToggleButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      aria-pressed={isActive}
      className="flex h-10 w-full min-w-0 items-center gap-1 border-2 px-1"
      {...buttonProps}
      style={
        isActive
          ? {
              backgroundColor: colors.bg,
              color: colors.text,
              borderColor: colors.icon,
            }
          : {
              backgroundColor: "transparent",
              color: colors.icon,
              borderColor: colors.icon,
            }
      }
      onClick={onToggle}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="w-10 shrink-0 text-center text-[10px]">{label}</span>
    </Button>
  )
}
