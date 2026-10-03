"use client"

import type React from "react"

import { WithTooltip } from "@/components/common/WithTooltip"
import { Button } from "@/components/ui/button"

interface TooltipButtonProps extends React.ComponentProps<typeof Button> {
  /**
   * ボタンの名前。**読み上げの名前（aria-label）と Tooltip の両方に入る。**
   * アイコンだけのボタンは見た目に名前が無いので、同じ文言を2か所へ手で書くと
   * 片方だけ直して食い違う。1回だけ渡す。
   */
  label: string
  /** Tooltip を出す向き（既定は上） */
  tooltipSide?: React.ComponentProps<typeof WithTooltip>["side"]
  tooltipSideOffset?: number
}

/** 名前を Tooltip で見せる、アイコンだけのボタン */
export function TooltipButton({
  label,
  tooltipSide,
  tooltipSideOffset,
  ...buttonProps
}: TooltipButtonProps) {
  return (
    <WithTooltip
      content={label}
      side={tooltipSide}
      sideOffset={tooltipSideOffset}
    >
      <Button aria-label={label} {...buttonProps} />
    </WithTooltip>
  )
}
