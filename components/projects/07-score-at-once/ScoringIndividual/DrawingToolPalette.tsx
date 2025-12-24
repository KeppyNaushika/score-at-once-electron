"use client"

import type { CropRegionWithProjectPage } from "@/components/projects/07-score-at-once/types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cn } from "@/lib/utils"
import {
  Crop,
  Hand,
  Maximize,
  MousePointer2,
  Type,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { EllipseToolPopover } from "./EllipseToolPopover"
import { LineToolPopover } from "./LineToolPopover"
import { RectangleToolPopover } from "./RectangleToolPopover"
import type { DrawingTool } from "./types/answer-individual-types"

const FADE_OUT_DELAY = 3000 // 3秒無操作でフェードアウト

interface DrawingToolPaletteProps {
  // Container ref for mouse event monitoring
  containerRef?: React.RefObject<HTMLDivElement | null>

  // View controls
  onZoomIn: () => void
  onZoomOut: () => void
  onMaximizeView: () => void
  onCropView: () => void
  currentCropRegion?: CropRegionWithProjectPage

  // Tool selection
  currentTool: DrawingTool
  onToolChange: (tool: DrawingTool) => void

  // Drawing settings
  strokeColor: string
  strokeWidth: number
  lineStyle: string
  onStrokeColorChange: (color: string) => void
  onStrokeWidthChange: (width: number) => void
  onLineStyleChange: (style: string) => void
}

export function DrawingToolPalette({
  containerRef,
  onZoomIn,
  onZoomOut,
  onMaximizeView,
  onCropView,
  currentCropRegion,
  currentTool,
  onToolChange,
  strokeColor,
  strokeWidth,
  lineStyle,
  onStrokeColorChange,
  onStrokeWidthChange,
  onLineStyleChange,
}: DrawingToolPaletteProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [isHovered, setIsHovered] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // タイマーをリセットして表示状態に戻す
  const resetTimer = useCallback(() => {
    setIsVisible(true)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => {
      if (!isHovered) {
        setIsVisible(false)
      }
    }, FADE_OUT_DELAY)
  }, [isHovered])

  // コンテナのマウスイベントを監視
  useEffect(() => {
    const container = containerRef?.current
    if (!container) return

    const handleMouseMove = () => {
      resetTimer()
    }

    const handleMouseDown = () => {
      resetTimer()
    }

    container.addEventListener("mousemove", handleMouseMove)
    container.addEventListener("mousedown", handleMouseDown)

    // 初回タイマー開始
    resetTimer()

    return () => {
      container.removeEventListener("mousemove", handleMouseMove)
      container.removeEventListener("mousedown", handleMouseDown)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [containerRef, resetTimer])

  // ホバー状態変更時にタイマーを調整
  useEffect(() => {
    if (isHovered) {
      // ホバー中はタイマーをクリア
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    } else if (isVisible) {
      // ホバー解除時にタイマーを再開
      resetTimer()
    }
  }, [isHovered, isVisible, resetTimer])

  // Tooltipコンテンツのスタイル
  const tooltipContentClass = cn(
    "bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95",
    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
    "data-[side=right]:slide-in-from-left-2",
    "z-50 w-fit rounded-md px-3 py-1.5 text-xs"
  )

  return (
    <TooltipPrimitive.Provider delayDuration={300} disableHoverableContent>
      <div
        className="absolute top-4 left-4 transition-opacity duration-300"
        style={{ opacity: isVisible ? 1 : 0, pointerEvents: isVisible ? "auto" : "none" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Card className="p-2">
          <div className="flex flex-col space-y-1">
            {/* ズーム・ビュー操作 */}
            <TooltipPrimitive.Root>
              <TooltipPrimitive.Trigger asChild>
                <Button size="sm" variant="ghost" onClick={onZoomIn}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipPrimitive.Trigger>
              <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content side="right" sideOffset={5} className={tooltipContentClass}>
                  <div className="text-center">
                    <div className="font-medium">拡大</div>
                    <div className="mt-1 text-xs text-gray-400">
                      キー:{" "}
                      <kbd className="rounded bg-gray-200 px-1 py-0.5 text-xs text-gray-800">
                        +
                      </kbd>
                    </div>
                  </div>
                </TooltipPrimitive.Content>
              </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>

            <TooltipPrimitive.Root>
              <TooltipPrimitive.Trigger asChild>
                <Button size="sm" variant="ghost" onClick={onZoomOut}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipPrimitive.Trigger>
              <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content side="right" sideOffset={5} className={tooltipContentClass}>
                  <div className="text-center">
                    <div className="font-medium">縮小</div>
                    <div className="mt-1 text-xs text-gray-400">
                      キー:{" "}
                      <kbd className="rounded bg-gray-200 px-1 py-0.5 text-xs text-gray-800">
                        -
                      </kbd>
                    </div>
                  </div>
                </TooltipPrimitive.Content>
              </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>

            <TooltipPrimitive.Root>
              <TooltipPrimitive.Trigger asChild>
                <Button size="sm" variant="ghost" onClick={onMaximizeView}>
                  <Maximize className="h-4 w-4" />
                </Button>
              </TooltipPrimitive.Trigger>
              <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content side="right" sideOffset={5} className={tooltipContentClass}>
                  <div className="text-center">
                    <div className="font-medium">全体表示</div>
                    <div className="mt-1 text-xs text-gray-400">
                      キー:{" "}
                      <kbd className="rounded bg-gray-200 px-1 py-0.5 text-xs text-gray-800">
                        A
                      </kbd>
                    </div>
                  </div>
                </TooltipPrimitive.Content>
              </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>

            <TooltipPrimitive.Root>
              <TooltipPrimitive.Trigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onCropView}
                  disabled={!currentCropRegion}
                >
                  <Crop className="h-4 w-4" />
                </Button>
              </TooltipPrimitive.Trigger>
              <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content side="right" sideOffset={5} className={tooltipContentClass}>
                  <div className="text-center">
                    <div className="font-medium">設問表示</div>
                    <div className="mt-1 text-xs text-gray-400">
                      キー:{" "}
                      <kbd className="rounded bg-gray-200 px-1 py-0.5 text-xs text-gray-800">
                        C
                      </kbd>
                    </div>
                  </div>
                </TooltipPrimitive.Content>
              </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>

            {/* セパレーター */}
            <Separator className="my-1" />

            {/* ツール選択 */}
            <TooltipPrimitive.Root>
              <TooltipPrimitive.Trigger asChild>
                <Button
                  size="sm"
                  variant={currentTool === "hand" ? "default" : "ghost"}
                  onClick={() => onToolChange("hand")}
                >
                  <Hand className="h-4 w-4" />
                </Button>
              </TooltipPrimitive.Trigger>
              <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content side="right" sideOffset={5} className={tooltipContentClass}>
                  <div className="text-center">
                    <div className="font-medium">ハンドツール</div>
                    <div className="text-xs text-gray-400">ドラッグで移動</div>
                  </div>
                </TooltipPrimitive.Content>
              </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>

            <TooltipPrimitive.Root>
              <TooltipPrimitive.Trigger asChild>
                <Button
                  size="sm"
                  variant={currentTool === "select" ? "default" : "ghost"}
                  onClick={() => onToolChange("select")}
                >
                  <MousePointer2 className="h-4 w-4" />
                </Button>
              </TooltipPrimitive.Trigger>
              <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content side="right" sideOffset={5} className={tooltipContentClass}>
                  <div className="text-center">
                    <div className="font-medium">選択ツール</div>
                    <div className="text-xs text-gray-400">図形を選択・移動・削除</div>
                  </div>
                </TooltipPrimitive.Content>
              </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>

            <LineToolPopover
              currentTool={currentTool}
              onToolChange={onToolChange}
              strokeColor={strokeColor}
              strokeWidth={strokeWidth}
              lineStyle={lineStyle}
              onStrokeColorChange={onStrokeColorChange}
              onStrokeWidthChange={onStrokeWidthChange}
              onLineStyleChange={onLineStyleChange}
            />

            <RectangleToolPopover
              currentTool={currentTool}
              onToolChange={onToolChange}
              strokeColor={strokeColor}
              strokeWidth={strokeWidth}
              onStrokeColorChange={onStrokeColorChange}
              onStrokeWidthChange={onStrokeWidthChange}
            />

            <EllipseToolPopover
              currentTool={currentTool}
              onToolChange={onToolChange}
              strokeColor={strokeColor}
              strokeWidth={strokeWidth}
              onStrokeColorChange={onStrokeColorChange}
              onStrokeWidthChange={onStrokeWidthChange}
            />

            {/* V4統合テキストアンカーボタン */}
            <TooltipPrimitive.Root>
              <TooltipPrimitive.Trigger asChild>
                <Button
                  size="sm"
                  variant={currentTool === "text" ? "default" : "ghost"}
                  onClick={() => onToolChange("text")}
                  style={{
                    backgroundColor: currentTool === "text" ? strokeColor : undefined,
                    borderColor: currentTool === "text" ? strokeColor : undefined,
                  }}
                >
                  <Type
                    className="h-4 w-4"
                    style={{ color: currentTool === "text" ? "white" : undefined }}
                  />
                </Button>
              </TooltipPrimitive.Trigger>
              <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content side="right" sideOffset={5} className={tooltipContentClass}>
                  <div className="text-center">
                    <div className="font-medium">テキストアンカー</div>
                    <div className="text-xs text-gray-400">クリックでテキスト配置</div>
                  </div>
                </TooltipPrimitive.Content>
              </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>

          </div>
        </Card>
      </div>
    </TooltipPrimitive.Provider>
  )
}
