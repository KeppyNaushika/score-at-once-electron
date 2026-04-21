"use client"

import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle,
  Circle,
  Clock,
  CopyX,
  Keyboard,
  Minus,
  Mouse,
  Target,
  X,
} from "lucide-react"
import { useState } from "react"

import { useKeyBindings } from "@/components/exams/07-score-at-once/hooks/useKeyBindings"
import type {
  ClickScoringAction,
  ClickScoringConfig,
} from "@/components/exams/07-score-at-once/ScoringMain/hooks/useClickScoringConfig"
import type {
  MouseBrushAction,
  ScoringOperationMode,
  ScoringStatus,
} from "@/components/exams/07-score-at-once/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import { getModifierKeyLabel } from "@/lib/platformUtils"
import type { ScoringStatusType } from "@/lib/scoringStatusColors"

import { SidePanelSection } from "./SidePanelSection"

/** ショートカットキー表示用ヘルパー */
function KeyHint({ label }: { label: string }) {
  return (
    <div className="mt-1 text-xs text-gray-400">
      キー:{" "}
      <kbd className="rounded bg-gray-200 px-1 py-0.5 text-xs">{label}</kbd>
    </div>
  )
}

interface ScoringToolbarProps {
  selectedAnswersCount: number
  currentCropRegion?: {
    points: number | null
  } | null
  onScore: (status: ScoringStatus) => void
  onSelectAll?: () => void
  onSelectUnscored?: () => void
  onRefreshFilter?: () => void
  partialScoreInput: string
  gradingMode?: "grid" | "individual"
  clickScoringConfig?: ClickScoringConfig
  clickScoringDebounceMs?: number
  onClickActionChange?: (
    clickCount: 2 | 3 | 4,
    action: ClickScoringAction
  ) => void
  onClickScoringDebounceMsChange?: (value: number) => void
  autoScroll?: boolean
  onAutoScrollChange?: (enabled: boolean) => void
  onGridNavigation?: (direction: string) => void
  isSectionOpen?: (sectionId: string) => boolean
  onToggleSection?: (sectionId: string) => void
  scoringOperationMode?: ScoringOperationMode
  onScoringOperationModeChange?: (mode: ScoringOperationMode) => void
  mouseBrush?: MouseBrushAction
  onMouseBrushChange?: (brush: MouseBrushAction) => void
  visibleUnscoredCount?: number
  hiddenUnscoredCount?: number
  onBatchScoreVisibleUnscored?: (status: MouseBrushAction) => void
}

const STATUS_MAP: Record<ScoringStatus, ScoringStatusType> = {
  unscored: "unscored",
  correct: "correct",
  partial: "partial",
  pending: "pending",
  incorrect: "incorrect",
  no_answer: "no_answer",
  double_mark: "double_mark",
}

const SCORING_BUTTONS = [
  {
    status: "unscored" as ScoringStatus,
    label: "未採点",
    icon: Circle,
    description: "未採点にする",
  },
  {
    status: "correct" as ScoringStatus,
    label: "正答",
    icon: CheckCircle,
    description: "正答にする",
  },
  {
    status: "partial" as ScoringStatus,
    label: "部分点",
    icon: AlertTriangle,
    description: "部分点にする",
  },
  {
    status: "pending" as ScoringStatus,
    label: "保留",
    icon: Clock,
    description: "保留にする",
  },
  {
    status: "incorrect" as ScoringStatus,
    label: "誤答",
    icon: X,
    description: "誤答にする",
  },
  {
    status: "no_answer" as ScoringStatus,
    label: "無答",
    icon: Minus,
    description: "無答にする",
  },
  {
    status: "double_mark" as ScoringStatus,
    label: "Wマーク",
    icon: CopyX,
    description: "ダブルマークにする",
  },
] as const

/** マウスモード用ブラシ（unscoredを除く） */
const BRUSH_BUTTONS = SCORING_BUTTONS.filter(
  (b) => b.status !== "unscored"
) as Array<{
  status: MouseBrushAction
  label: string
  icon: typeof CheckCircle
  description: string
}>

const CLICK_ACTION_OPTIONS: { value: ClickScoringAction; label: string }[] = [
  { value: "none", label: "なし" },
  { value: "correct", label: "正答" },
  { value: "incorrect", label: "誤答" },
  { value: "partial_modal", label: "部分点入力" },
  { value: "partial", label: "部分点（非推奨）" },
  { value: "pending", label: "保留（非推奨）" },
  { value: "unscored", label: "未採点" },
  { value: "no_answer", label: "無答" },
  { value: "double_mark", label: "Wマーク" },
  { value: "individual", label: "個別表示" },
]

const GRID_4_3_STYLE = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "0.5rem",
} as const

export default function ScoringToolbar({
  selectedAnswersCount,
  onScore,
  onSelectAll,
  onSelectUnscored,
  onRefreshFilter,
  partialScoreInput,
  gradingMode = "grid",
  clickScoringConfig,
  clickScoringDebounceMs = 300,
  onClickActionChange,
  onClickScoringDebounceMsChange,
  autoScroll = true,
  onAutoScrollChange,
  onGridNavigation,
  isSectionOpen,
  onToggleSection,
  scoringOperationMode = "keyboard",
  onScoringOperationModeChange,
  mouseBrush = "correct",
  onMouseBrushChange,
  visibleUnscoredCount = 0,
  hiddenUnscoredCount = 0,
  onBatchScoreVisibleUnscored,
}: ScoringToolbarProps) {
  const { keyBindings } = useKeyBindings()
  const scoringColors = useScoringStatusColors()
  const [modifierKeyLabel] = useState(() => getModifierKeyLabel() || "Alt")
  const ctrlLabel = modifierKeyLabel === "Option" ? "⌘" : "Ctrl"

  return (
    <TooltipProvider delayDuration={300}>
      <SidePanelSection
        icon={Target}
        title="採点"
        collapsible={!!onToggleSection}
        isOpen={isSectionOpen?.("scoring") ?? true}
        onToggle={() => onToggleSection?.("scoring")}
        badge={
          selectedAnswersCount > 0 ? `${selectedAnswersCount}件` : undefined
        }
        rightElement={
          partialScoreInput ? (
            <Badge
              variant="outline"
              className="border-yellow-300 bg-yellow-50 text-xs"
            >
              入力中: {partialScoreInput}
              {partialScoreInput.endsWith(".") ? "●" : ""}
            </Badge>
          ) : undefined
        }
      >
        <div className="space-y-3">
          {/* モード切替トグル（グリッドモードのみ） */}
          {gradingMode === "grid" && onScoringOperationModeChange && (
            <div className="flex items-center gap-1 rounded-md border border-gray-200 p-0.5">
              <Button
                variant={
                  scoringOperationMode === "keyboard" ? "default" : "ghost"
                }
                size="sm"
                className="flex flex-1 items-center gap-1.5 text-xs"
                onClick={() => onScoringOperationModeChange("keyboard")}
              >
                <Keyboard className="h-3.5 w-3.5" />
                キーボード
              </Button>
              <Button
                variant={scoringOperationMode === "mouse" ? "default" : "ghost"}
                size="sm"
                className="flex flex-1 items-center gap-1.5 text-xs"
                onClick={() => onScoringOperationModeChange("mouse")}
              >
                <Mouse className="h-3.5 w-3.5" />
                マウス
              </Button>
            </div>
          )}

          {/* マウスモード用UI（グリッドモードのみ） */}
          {scoringOperationMode === "mouse" && gradingMode === "grid" && (
            <>
              {/* ブラシ選択 */}
              <div>
                <div className="mb-1 text-xs font-medium text-gray-600">
                  クリック時の採点ブラシ
                </div>
                <div style={GRID_4_3_STYLE}>
                  {BRUSH_BUTTONS.map((button) => {
                    const Icon = button.icon
                    const statusType = STATUS_MAP[button.status]
                    const colors = scoringColors[statusType]
                    const isActive = mouseBrush === button.status
                    return (
                      <Tooltip key={button.status}>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`flex h-12 flex-col gap-1 border-2 ${
                              isActive
                                ? "ring-2 ring-blue-500 ring-offset-1"
                                : "opacity-60 hover:opacity-80"
                            }`}
                            style={{
                              backgroundColor: colors.bg,
                              color: colors.text,
                              borderColor: colors.bg,
                            }}
                            onClick={() => onMouseBrushChange?.(button.status)}
                          >
                            <Icon className="h-4 w-4" />
                            <div className="text-xs">{button.label}</div>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-center">
                            <div className="font-medium">
                              {button.description}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>

              {/* 一括採点ボタン */}
              {onBatchScoreVisibleUnscored && visibleUnscoredCount > 0 && (
                <div className="space-y-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => onBatchScoreVisibleUnscored(mouseBrush)}
                  >
                    表示中の未採点{visibleUnscoredCount}件を
                    {BRUSH_BUTTONS.find((b) => b.status === mouseBrush)
                      ?.label ?? mouseBrush}
                    にする
                  </Button>
                  {hiddenUnscoredCount > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      非表示の未採点が{hiddenUnscoredCount}件あります
                    </div>
                  )}
                </div>
              )}

              {/* フィルタ更新 */}
              {onRefreshFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={onRefreshFilter}
                >
                  表示フィルターに合わせて表示を更新
                </Button>
              )}

              {/* クリックで採点（ダブル以上） */}
              {gradingMode === "grid" &&
                clickScoringConfig &&
                onClickActionChange && (
                  <div className="space-y-1.5">
                    {([2, 3, 4] as const).map((clickCount) => {
                      const labels = {
                        2: "ダブルクリック:",
                        3: "トリプルクリック:",
                        4: "クアトロクリック:",
                      }
                      return (
                        <div
                          key={clickCount}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-gray-600">
                            {labels[clickCount]}
                          </span>
                          <Select
                            value={clickScoringConfig[clickCount]}
                            onValueChange={(v) =>
                              onClickActionChange(
                                clickCount,
                                v as ClickScoringAction
                              )
                            }
                          >
                            <SelectTrigger className="h-7 w-60 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CLICK_ACTION_OPTIONS.map((opt) => (
                                <SelectItem
                                  key={opt.value}
                                  value={opt.value}
                                  className="text-xs"
                                >
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )
                    })}
                  </div>
                )}
            </>
          )}

          {/* キーボードモード用UI（キーボードモードまたは個別表示時） */}
          {(scoringOperationMode === "keyboard" ||
            gradingMode === "individual") && (
            <>
              {/* 採点ボタン */}
              <div style={GRID_4_3_STYLE}>
                {SCORING_BUTTONS.map((button) => {
                  const Icon = button.icon
                  const commandId = `scoring.${button.status === "no_answer" ? "noAnswer" : button.status}`
                  const keyBinding = keyBindings[commandId] || "?"
                  const statusType = STATUS_MAP[button.status]
                  const colors = scoringColors[statusType]
                  return (
                    <Tooltip key={button.status}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`flex h-12 flex-col gap-1 border-2 ${
                            selectedAnswersCount === 0
                              ? "cursor-not-allowed opacity-50"
                              : "hover:opacity-80"
                          }`}
                          style={{
                            backgroundColor: colors.bg,
                            color: colors.text,
                            borderColor: colors.bg,
                          }}
                          onClick={() => onScore(button.status)}
                          disabled={selectedAnswersCount === 0}
                        >
                          <Icon className="h-4 w-4" />
                          <div className="text-xs">{button.label}</div>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-center">
                          <div className="font-medium">
                            {button.description}
                          </div>
                          <KeyHint label={keyBinding.toUpperCase()} />
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>

              {/* 選択操作 */}
              {gradingMode === "grid" && (
                <div className="space-y-1">
                  {onSelectUnscored && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={onSelectUnscored}
                    >
                      未採点の生徒答案を全て選択
                    </Button>
                  )}
                  {onSelectAll && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={onSelectAll}
                        >
                          表示されている生徒答案を全て選択
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-center">
                          <div className="font-medium">
                            表示中の答案を全て選択
                          </div>
                          <KeyHint label={`${ctrlLabel}+A`} />
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {onRefreshFilter && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={onRefreshFilter}
                        >
                          表示フィルターに合わせて表示を更新
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-center">
                          <div className="font-medium">フィルターを再適用</div>
                          <KeyHint label="R" />
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}

              {/* クリックで採点 */}
              {gradingMode === "grid" &&
                clickScoringConfig &&
                onClickActionChange && (
                  <div className="space-y-1.5">
                    {([2, 3, 4] as const).map((clickCount) => {
                      const labels = {
                        2: "ダブルクリック:",
                        3: "トリプルクリック:",
                        4: "クアトロクリック:",
                      }
                      return (
                        <div
                          key={clickCount}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-gray-600">
                            {labels[clickCount]}
                          </span>
                          <Select
                            value={clickScoringConfig[clickCount]}
                            onValueChange={(v) =>
                              onClickActionChange(
                                clickCount,
                                v as ClickScoringAction
                              )
                            }
                          >
                            <SelectTrigger className="h-7 w-60 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CLICK_ACTION_OPTIONS.map((opt) => (
                                <SelectItem
                                  key={opt.value}
                                  value={opt.value}
                                  className="text-xs"
                                >
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )
                    })}

                    {onClickScoringDebounceMsChange && (
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-gray-500">
                          クリックの最長間隔
                        </span>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <span className="shrink-0 text-base" title="速い">
                            🐇
                          </span>
                          <Slider
                            className="flex-1"
                            value={[clickScoringDebounceMs]}
                            min={100}
                            max={800}
                            step={50}
                            onValueChange={([v]) =>
                              onClickScoringDebounceMsChange(v)
                            }
                          />
                          <span className="shrink-0 text-base" title="遅い">
                            🐢
                          </span>
                          <span className="w-10 shrink-0 text-right text-[10px] text-gray-400">
                            {clickScoringDebounceMs}ms
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
            </>
          )}

          {/* 自動スクロール（共通） */}
          {gradingMode === "grid" && onAutoScrollChange && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">自動スクロール</span>
              <Switch
                checked={autoScroll}
                onCheckedChange={onAutoScrollChange}
              />
            </div>
          )}

          {/* WASD移動（キーボードモードのみ） */}
          {scoringOperationMode === "keyboard" &&
            gradingMode === "grid" &&
            onGridNavigation && (
              <div className="flex items-center justify-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-8"
                      onClick={() => onGridNavigation("a")}
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center">
                      <div className="font-medium">左に移動</div>
                      <KeyHint label="A" />
                    </div>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-8"
                      onClick={() => onGridNavigation("w")}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center">
                      <div className="font-medium">上に移動</div>
                      <KeyHint label="W" />
                    </div>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-8"
                      onClick={() => onGridNavigation("s")}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center">
                      <div className="font-medium">下に移動</div>
                      <KeyHint label="S" />
                    </div>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-8"
                      onClick={() => onGridNavigation("d")}
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center">
                      <div className="font-medium">右に移動</div>
                      <KeyHint label="D" />
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
        </div>
      </SidePanelSection>
    </TooltipProvider>
  )
}
