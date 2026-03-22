"use client"

import { Eye, EyeOff } from "lucide-react"
import { useCallback } from "react"

import { useKeyBindings } from "@/components/exams/07-score-at-once/hooks/useKeyBindings"
import type {
  MasterAnswerDisplayMode,
  MasterAnswerKeyBehavior,
} from "@/components/exams/07-score-at-once/types"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { SidePanelSection } from "./SidePanelSection"

interface MasterAnswerControlsProps {
  displayMode: MasterAnswerDisplayMode
  opacity: number
  keyBehavior: MasterAnswerKeyBehavior
  masterAnswerVisible: boolean
  onDisplayModeChange: (mode: MasterAnswerDisplayMode) => void
  onOpacityChange: (opacity: number) => void
  onKeyBehaviorChange: (behavior: MasterAnswerKeyBehavior) => void
  onToggleMasterAnswer: () => void
  onMasterAnswerShow?: () => void
  onMasterAnswerHide?: () => void
}

const DISPLAY_MODE_OPTIONS: {
  value: MasterAnswerDisplayMode
  label: string
}[] = [
  { value: "off", label: "非表示" },
  { value: "overlay", label: "オーバーレイ" },
  { value: "split-horizontal", label: "左右分割" },
  { value: "split-vertical", label: "上下分割" },
]

export function MasterAnswerControls({
  displayMode,
  opacity,
  keyBehavior,
  masterAnswerVisible,
  onDisplayModeChange,
  onOpacityChange,
  onKeyBehaviorChange,
  onToggleMasterAnswer,
  onMasterAnswerShow,
  onMasterAnswerHide,
}: MasterAnswerControlsProps) {
  const { keyBindings } = useKeyBindings()
  const toggleKey = keyBindings["view.toggleMasterAnswer"]?.toUpperCase() || "X"

  // hold-to-show: mousedown で表示、mouseup/mouseleave で非表示
  const handlePointerDown = useCallback(() => {
    if (keyBehavior === "hold-to-show") {
      onMasterAnswerShow?.()
    }
  }, [keyBehavior, onMasterAnswerShow])

  const handlePointerUp = useCallback(() => {
    if (keyBehavior === "hold-to-show") {
      onMasterAnswerHide?.()
    }
  }, [keyBehavior, onMasterAnswerHide])

  const handleClick = useCallback(() => {
    if (keyBehavior === "toggle") {
      onToggleMasterAnswer()
    }
  }, [keyBehavior, onToggleMasterAnswer])

  return (
    <TooltipProvider delayDuration={300}>
      <SidePanelSection icon={Eye} title="模範解答">
        <div className="space-y-3">
          {/* 表示モード + 表示ボタン（横並び） */}
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <Label className="text-xs">表示モード</Label>
              <Select
                value={displayMode}
                onValueChange={(v) =>
                  onDisplayModeChange(v as MasterAnswerDisplayMode)
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISPLAY_MODE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {displayMode !== "off" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={masterAnswerVisible ? "default" : "outline"}
                    size="sm"
                    className="h-8 shrink-0 px-3"
                    onClick={handleClick}
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                  >
                    {masterAnswerVisible ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <div className="font-medium">模範解答の表示切替</div>
                    <div className="mt-1 text-xs text-gray-400">
                      キー:{" "}
                      <kbd className="rounded bg-gray-200 px-1 py-0.5 text-xs">
                        {toggleKey}
                      </kbd>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* 不透明度スライダー（overlay時のみ） */}
          {displayMode === "overlay" && (
            <div className="space-y-1">
              <Label className="text-xs">不透明度: {opacity}%</Label>
              <Slider
                value={[opacity]}
                onValueChange={([v]) => onOpacityChange(v)}
                min={5}
                max={100}
                step={5}
                className="py-1"
              />
            </div>
          )}

          {/* キー動作 */}
          {displayMode !== "off" && (
            <div className="flex items-center justify-between">
              <Label className="text-xs">押し続けて表示</Label>
              <Switch
                checked={keyBehavior === "hold-to-show"}
                onCheckedChange={(checked) =>
                  onKeyBehaviorChange(checked ? "hold-to-show" : "toggle")
                }
              />
            </div>
          )}
        </div>
      </SidePanelSection>
    </TooltipProvider>
  )
}
