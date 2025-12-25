"use client"

import type { CropRegionWithProjectPage } from "@/components/projects/07-score-at-once/types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import {
  Crop,
  Hand,
  Maximize,
  MousePointer2,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { EllipseToolPopover } from "./EllipseToolPopover"
import { LineToolPopover } from "./LineToolPopover"
import { RectangleToolPopover } from "./RectangleToolPopover"
import { TextToolPopover } from "./TextToolPopover"
import type {
  DrawingElement,
  DrawingTool,
} from "./types/answer-individual-types"

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

  // 選択中の要素（スタイル編集用）
  selectedElements?: DrawingElement[]
  onUpdateSelectedElements?: (
    updates: Array<{ id: string; updates: Partial<DrawingElement> }>,
  ) => void
  onClearSelection?: () => void
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
  selectedElements = [],
  onUpdateSelectedElements,
  onClearSelection,
}: DrawingToolPaletteProps) {
  // 選択中の各タイプの要素を取得（複数選択対応）
  const selectedLines = selectedElements.filter((el) => el.type === "line")
  const selectedRectangles = selectedElements.filter(
    (el) => el.type === "rectangle",
  )
  const selectedEllipses = selectedElements.filter(
    (el) => el.type === "ellipse",
  )
  const selectedTexts = selectedElements.filter((el) => el.type === "text")

  // 代表要素（UI表示用に最初の要素を使用）
  const firstLine = selectedLines[0]
  const firstRectangle = selectedRectangles[0]
  const firstEllipse = selectedEllipses[0]
  const firstText = selectedTexts[0]

  // 選択中の線がある場合はその値を、なければデフォルト値を使用
  const effectiveLineStyle = firstLine?.lineStyle || lineStyle
  const effectiveLineColor = firstLine?.color || strokeColor
  const effectiveLineWidth = firstLine?.strokeWidth || strokeWidth

  // 選択中の長方形がある場合はその値を使用
  const effectiveRectColor = firstRectangle?.color || strokeColor
  const effectiveRectWidth = firstRectangle?.strokeWidth || strokeWidth

  // 選択中の楕円がある場合はその値を使用
  const effectiveEllipseColor = firstEllipse?.color || strokeColor
  const effectiveEllipseWidth = firstEllipse?.strokeWidth || strokeWidth

  // 選択中のテキストがある場合はその色を使用
  const effectiveTextColor = firstText?.color || strokeColor

  // ===== 線用ハンドラ（線のみに適用） =====
  const handleLineColorChange = useCallback(
    (color: string) => {
      if (selectedLines.length > 0 && onUpdateSelectedElements) {
        const updates = selectedLines.map((el) => ({
          id: el.id,
          updates: { color },
        }))
        onUpdateSelectedElements(updates)
      }
      onStrokeColorChange(color)
    },
    [selectedLines, onUpdateSelectedElements, onStrokeColorChange],
  )

  const handleLineWidthChange = useCallback(
    (width: number) => {
      if (selectedLines.length > 0 && onUpdateSelectedElements) {
        const updates = selectedLines.map((el) => ({
          id: el.id,
          updates: { strokeWidth: width },
        }))
        onUpdateSelectedElements(updates)
      }
      onStrokeWidthChange(width)
    },
    [selectedLines, onUpdateSelectedElements, onStrokeWidthChange],
  )

  const handleLineStyleChange = useCallback(
    (style: string) => {
      if (selectedLines.length > 0 && onUpdateSelectedElements) {
        const updates = selectedLines.map((el) => ({
          id: el.id,
          updates: { lineStyle: style as any },
        }))
        onUpdateSelectedElements(updates)
      }
      onLineStyleChange(style)
    },
    [selectedLines, onUpdateSelectedElements, onLineStyleChange],
  )

  // ===== 長方形用ハンドラ（長方形のみに適用） =====
  const handleRectColorChange = useCallback(
    (color: string) => {
      if (selectedRectangles.length > 0 && onUpdateSelectedElements) {
        const updates = selectedRectangles.map((el) => ({
          id: el.id,
          updates: { color },
        }))
        onUpdateSelectedElements(updates)
      }
      onStrokeColorChange(color)
    },
    [selectedRectangles, onUpdateSelectedElements, onStrokeColorChange],
  )

  const handleRectWidthChange = useCallback(
    (width: number) => {
      if (selectedRectangles.length > 0 && onUpdateSelectedElements) {
        const updates = selectedRectangles.map((el) => ({
          id: el.id,
          updates: { strokeWidth: width },
        }))
        onUpdateSelectedElements(updates)
      }
      onStrokeWidthChange(width)
    },
    [selectedRectangles, onUpdateSelectedElements, onStrokeWidthChange],
  )

  // ===== 楕円用ハンドラ（楕円のみに適用） =====
  const handleEllipseColorChange = useCallback(
    (color: string) => {
      if (selectedEllipses.length > 0 && onUpdateSelectedElements) {
        const updates = selectedEllipses.map((el) => ({
          id: el.id,
          updates: { color },
        }))
        onUpdateSelectedElements(updates)
      }
      onStrokeColorChange(color)
    },
    [selectedEllipses, onUpdateSelectedElements, onStrokeColorChange],
  )

  const handleEllipseWidthChange = useCallback(
    (width: number) => {
      if (selectedEllipses.length > 0 && onUpdateSelectedElements) {
        const updates = selectedEllipses.map((el) => ({
          id: el.id,
          updates: { strokeWidth: width },
        }))
        onUpdateSelectedElements(updates)
      }
      onStrokeWidthChange(width)
    },
    [selectedEllipses, onUpdateSelectedElements, onStrokeWidthChange],
  )

  // ===== テキスト用ハンドラ（テキストのみに適用） =====
  const handleTextColorChange = useCallback(
    (color: string) => {
      if (selectedTexts.length > 0 && onUpdateSelectedElements) {
        const updates = selectedTexts.map((el) => ({
          id: el.id,
          updates: { color },
        }))
        onUpdateSelectedElements(updates)
      }
      onStrokeColorChange(color)
    },
    [selectedTexts, onUpdateSelectedElements, onStrokeColorChange],
  )
  const [isVisible, setIsVisible] = useState(true)
  const [isHovered, setIsHovered] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isHoveredRef = useRef(isHovered)

  // isHoveredの最新値をrefで追跡
  useEffect(() => {
    isHoveredRef.current = isHovered
  }, [isHovered])

  // フェードアウトタイマーを開始（setStateを含まない、effect用）
  const startFadeoutTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => {
      if (!isHoveredRef.current) {
        setIsVisible(false)
      }
    }, FADE_OUT_DELAY)
  }, [])

  // タイマーをリセットして表示状態に戻す（イベントハンドラ用）
  const resetTimer = useCallback(() => {
    setIsVisible(true)
    startFadeoutTimer()
  }, [startFadeoutTimer])

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

    // 初回タイマー開始（setStateを呼ばずタイマーのみ設定）
    startFadeoutTimer()

    return () => {
      container.removeEventListener("mousemove", handleMouseMove)
      container.removeEventListener("mousedown", handleMouseDown)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [containerRef, resetTimer, startFadeoutTimer])

  // ホバー状態変更時にタイマーを調整
  useEffect(() => {
    if (isHovered) {
      // ホバー中はタイマーをクリア
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    } else if (isVisible) {
      // ホバー解除時にタイマーを再開（setStateを呼ばずタイマーのみ設定）
      startFadeoutTimer()
    }
  }, [isHovered, isVisible, startFadeoutTimer])

  // Tooltipコンテンツのスタイル
  const tooltipContentClass = cn(
    "bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95",
    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
    "data-[side=right]:slide-in-from-left-2",
    "z-50 w-fit rounded-md px-3 py-1.5 text-xs",
  )

  return (
    <TooltipPrimitive.Provider delayDuration={300} disableHoverableContent>
      <div
        className="absolute top-4 left-4 transition-opacity duration-300"
        style={{
          opacity: isVisible ? 1 : 0,
          pointerEvents: isVisible ? "auto" : "none",
        }}
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
                <TooltipPrimitive.Content
                  side="right"
                  sideOffset={5}
                  className={tooltipContentClass}
                >
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
                <TooltipPrimitive.Content
                  side="right"
                  sideOffset={5}
                  className={tooltipContentClass}
                >
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
                <TooltipPrimitive.Content
                  side="right"
                  sideOffset={5}
                  className={tooltipContentClass}
                >
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
                <TooltipPrimitive.Content
                  side="right"
                  sideOffset={5}
                  className={tooltipContentClass}
                >
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
                <TooltipPrimitive.Content
                  side="right"
                  sideOffset={5}
                  className={tooltipContentClass}
                >
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
                <TooltipPrimitive.Content
                  side="right"
                  sideOffset={5}
                  className={tooltipContentClass}
                >
                  <div className="text-center">
                    <div className="font-medium">選択ツール</div>
                    <div className="text-xs text-gray-400">
                      図形を選択・移動・削除
                    </div>
                  </div>
                </TooltipPrimitive.Content>
              </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>

            <LineToolPopover
              currentTool={currentTool}
              onToolChange={onToolChange}
              strokeColor={effectiveLineColor}
              strokeWidth={effectiveLineWidth}
              lineStyle={effectiveLineStyle}
              onStrokeColorChange={handleLineColorChange}
              onStrokeWidthChange={handleLineWidthChange}
              onLineStyleChange={handleLineStyleChange}
              hasSelectedElement={selectedLines.length > 0}
              hasOtherTypeSelected={
                selectedRectangles.length > 0 ||
                selectedEllipses.length > 0 ||
                selectedTexts.length > 0
              }
              onClearSelection={onClearSelection}
            />

            <RectangleToolPopover
              currentTool={currentTool}
              onToolChange={onToolChange}
              strokeColor={effectiveRectColor}
              strokeWidth={effectiveRectWidth}
              onStrokeColorChange={handleRectColorChange}
              onStrokeWidthChange={handleRectWidthChange}
              hasSelectedElement={selectedRectangles.length > 0}
              hasOtherTypeSelected={
                selectedLines.length > 0 ||
                selectedEllipses.length > 0 ||
                selectedTexts.length > 0
              }
              onClearSelection={onClearSelection}
            />

            <EllipseToolPopover
              currentTool={currentTool}
              onToolChange={onToolChange}
              strokeColor={effectiveEllipseColor}
              strokeWidth={effectiveEllipseWidth}
              onStrokeColorChange={handleEllipseColorChange}
              onStrokeWidthChange={handleEllipseWidthChange}
              hasSelectedElement={selectedEllipses.length > 0}
              hasOtherTypeSelected={
                selectedLines.length > 0 ||
                selectedRectangles.length > 0 ||
                selectedTexts.length > 0
              }
              onClearSelection={onClearSelection}
            />

            <TextToolPopover
              currentTool={currentTool}
              onToolChange={onToolChange}
              textColor={effectiveTextColor}
              onTextColorChange={handleTextColorChange}
              hasSelectedElement={selectedTexts.length > 0}
              hasOtherTypeSelected={
                selectedLines.length > 0 ||
                selectedRectangles.length > 0 ||
                selectedEllipses.length > 0
              }
              onClearSelection={onClearSelection}
            />
          </div>
        </Card>
      </div>
    </TooltipPrimitive.Provider>
  )
}
