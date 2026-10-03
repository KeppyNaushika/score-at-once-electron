"use client"

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  UnfoldVertical,
} from "lucide-react"
import { useCallback } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { AnchorDirection } from "@/types/drawingAnnotation.types"

import { ToolbarTooltip } from "./ToolbarTooltip"

// アンカー方向の取得関数
const getHorizontalAlign = (direction: AnchorDirection) => {
  if (direction.includes("left")) return "left"
  if (direction.includes("right")) return "right"
  return "center"
}

const getVerticalAlign = (direction: AnchorDirection) => {
  if (direction.includes("top")) return "top"
  if (direction.includes("bottom")) return "bottom"
  return "center"
}

/** 文字の窓の、アンカー位置（横・縦の寄せ）の欄 */
export function AnchorAlignControls({
  anchorDirection,
  onAnchorDirectionChange,
}: {
  anchorDirection: AnchorDirection
  onAnchorDirectionChange: (direction: AnchorDirection) => void
}) {
  // アンカー方向設定
  const setHorizontalAlign = useCallback(
    (align: "left" | "center" | "right") => {
      const vertical = getVerticalAlign(anchorDirection)
      let newDirection: AnchorDirection

      if (vertical === "center" && align === "center") {
        newDirection = "center"
      } else if (vertical === "center") {
        newDirection = align as AnchorDirection
      } else if (align === "center") {
        newDirection = vertical as AnchorDirection
      } else {
        newDirection = `${vertical}-${align}` as AnchorDirection
      }

      onAnchorDirectionChange(newDirection)
    },
    [anchorDirection, onAnchorDirectionChange]
  )

  const setVerticalAlign = useCallback(
    (align: "top" | "center" | "bottom") => {
      const horizontal = getHorizontalAlign(anchorDirection)
      let newDirection: AnchorDirection

      if (align === "center" && horizontal === "center") {
        newDirection = "center"
      } else if (align === "center") {
        newDirection = horizontal as AnchorDirection
      } else if (horizontal === "center") {
        newDirection = align as AnchorDirection
      } else {
        newDirection = `${align}-${horizontal}` as AnchorDirection
      }

      onAnchorDirectionChange(newDirection)
    },
    [anchorDirection, onAnchorDirectionChange]
  )

  return (
    <div>
      <Label className="text-sm font-medium">アンカー位置</Label>
      <div className="mt-2 flex items-center gap-4">
        {/* 横方向 */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">横:</span>
          <ToolbarTooltip label="左寄せ">
            <Button
              size="sm"
              variant={
                getHorizontalAlign(anchorDirection) === "left"
                  ? "default"
                  : "ghost"
              }
              onClick={() => setHorizontalAlign("left")}
              aria-label="左寄せ"
            >
              <AlignLeft className="h-4 w-4" />
            </Button>
          </ToolbarTooltip>
          <ToolbarTooltip label="左右中央寄せ">
            <Button
              size="sm"
              variant={
                getHorizontalAlign(anchorDirection) === "center"
                  ? "default"
                  : "ghost"
              }
              onClick={() => setHorizontalAlign("center")}
              aria-label="左右中央寄せ"
            >
              <AlignCenter className="h-4 w-4" />
            </Button>
          </ToolbarTooltip>
          <ToolbarTooltip label="右寄せ">
            <Button
              size="sm"
              variant={
                getHorizontalAlign(anchorDirection) === "right"
                  ? "default"
                  : "ghost"
              }
              onClick={() => setHorizontalAlign("right")}
              aria-label="右寄せ"
            >
              <AlignRight className="h-4 w-4" />
            </Button>
          </ToolbarTooltip>
        </div>

        {/* 縦方向 */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">縦:</span>
          <ToolbarTooltip label="上寄せ">
            <Button
              size="sm"
              variant={
                getVerticalAlign(anchorDirection) === "top"
                  ? "default"
                  : "ghost"
              }
              onClick={() => setVerticalAlign("top")}
              aria-label="上寄せ"
            >
              <ArrowUpToLine className="h-4 w-4" />
            </Button>
          </ToolbarTooltip>
          <ToolbarTooltip label="上下中央寄せ">
            <Button
              size="sm"
              variant={
                getVerticalAlign(anchorDirection) === "center"
                  ? "default"
                  : "ghost"
              }
              onClick={() => setVerticalAlign("center")}
              aria-label="上下中央寄せ"
            >
              <UnfoldVertical className="h-4 w-4" />
            </Button>
          </ToolbarTooltip>
          <ToolbarTooltip label="下寄せ">
            <Button
              size="sm"
              variant={
                getVerticalAlign(anchorDirection) === "bottom"
                  ? "default"
                  : "ghost"
              }
              onClick={() => setVerticalAlign("bottom")}
              aria-label="下寄せ"
            >
              <ArrowDownToLine className="h-4 w-4" />
            </Button>
          </ToolbarTooltip>
        </div>

        {/* 現在の設定表示 */}
        <div className="text-xs text-gray-500">現在: {anchorDirection}</div>
      </div>
    </div>
  )
}
