"use client"

import type React from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface WithTooltipProps {
  /** Tooltip に出す説明 */
  content: React.ReactNode
  /** Tooltip を付ける要素（ref とイベントを受け取れる1要素） */
  children: React.ReactElement
  /** 出す向き（既定は上） */
  side?: React.ComponentProps<typeof TooltipContent>["side"]
  sideOffset?: number
}

/** 1つの要素に Tooltip を付ける。Tooltip・TooltipTrigger・TooltipContent の手書きを畳む */
export function WithTooltip({
  content,
  children,
  side,
  sideOffset,
}: WithTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={sideOffset}>
        {content}
      </TooltipContent>
    </Tooltip>
  )
}
