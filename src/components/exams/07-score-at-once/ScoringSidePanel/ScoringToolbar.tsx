"use client"

import { Calculator, Keyboard, Mouse, Target } from "lucide-react"
import { useState } from "react"

import type {
  MouseBrushAction,
  ScoringOperationMode,
} from "@/components/exams/07-score-at-once/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getModifierKeyLabel } from "@/lib/platformUtils"
import { ignoreDeselect } from "@/lib/toggleSelection"
import { SCORING_OPERATION_MODES } from "@/lib/userPreferences"
import type {
  ClickScoringAction,
  ClickScoringConfig,
} from "@/types/clickScoring.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import { ClickScoringSettings } from "./ClickScoringSettings"
import { GridNavigationButtons } from "./GridNavigationButtons"
import { KeyboardScoringButtons } from "./KeyboardScoringButtons"
import { KeyHint } from "./KeyHint"
import { MouseBrushControls } from "./MouseBrushControls"
import { SidePanelSection } from "./SidePanelSection"

interface ScoringToolbarProps {
  selectedAnswersCount: number
  currentCropRegion?: {
    points: number | null
  } | null
  onScore: (status: ScoringStatus) => void
  onSelectAll?: () => void
  onSelectUnscored?: () => void
  onOpenPartialScoreModal?: () => void
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

export default function ScoringToolbar({
  selectedAnswersCount,
  onScore,
  onSelectAll,
  onSelectUnscored,
  onOpenPartialScoreModal,
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
            // 採点画面はキーボード優先。Tab で1つずつ辿れる並びを保つため、矢印キーでの移動（roving focus）は切る
            <ToggleGroup
              type="single"
              size="sm"
              selectedTone="primary"
              rovingFocus={false}
              value={scoringOperationMode}
              aria-label="採点操作モード"
              className="w-full gap-1 rounded-md border border-gray-200 p-0.5"
              onValueChange={ignoreDeselect(
                SCORING_OPERATION_MODES,
                onScoringOperationModeChange
              )}
            >
              <ToggleGroupItem
                value="keyboard"
                className="gap-1.5 rounded-md px-2.5 text-xs"
              >
                <Keyboard className="h-3.5 w-3.5" />
                キーボード
              </ToggleGroupItem>
              <ToggleGroupItem
                value="mouse"
                className="gap-1.5 rounded-md px-2.5 text-xs"
              >
                <Mouse className="h-3.5 w-3.5" />
                マウス
              </ToggleGroupItem>
            </ToggleGroup>
          )}

          {/* 部分点入力モーダルを開くボタン（キーボード・マウス共通） */}
          {onOpenPartialScoreModal && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`w-full text-xs ${
                    selectedAnswersCount === 0
                      ? "cursor-not-allowed opacity-50"
                      : ""
                  }`}
                  onClick={onOpenPartialScoreModal}
                  disabled={selectedAnswersCount === 0}
                >
                  <Calculator className="mr-1 h-3.5 w-3.5" />
                  部分点入力
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <div className="font-medium">選択中の答案に部分点を入力</div>
                  <KeyHint label="0〜9" />
                </div>
              </TooltipContent>
            </Tooltip>
          )}

          {/* マウスモード用UI（グリッドモードのみ） */}
          {scoringOperationMode === "mouse" && gradingMode === "grid" && (
            <>
              <MouseBrushControls
                mouseBrush={mouseBrush}
                onMouseBrushChange={onMouseBrushChange}
                visibleUnscoredCount={visibleUnscoredCount}
                hiddenUnscoredCount={hiddenUnscoredCount}
                onBatchScoreVisibleUnscored={onBatchScoreVisibleUnscored}
              />

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
                  <ClickScoringSettings
                    clickScoringConfig={clickScoringConfig}
                    onClickActionChange={onClickActionChange}
                  />
                )}
            </>
          )}

          {/* キーボードモード用UI（キーボードモードまたは個別表示時） */}
          {(scoringOperationMode === "keyboard" ||
            gradingMode === "individual") && (
            <>
              <KeyboardScoringButtons
                selectedAnswersCount={selectedAnswersCount}
                onScore={onScore}
              />

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
                  <ClickScoringSettings
                    clickScoringConfig={clickScoringConfig}
                    onClickActionChange={onClickActionChange}
                    clickScoringDebounceMs={clickScoringDebounceMs}
                    onClickScoringDebounceMsChange={
                      onClickScoringDebounceMsChange
                    }
                  />
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
              <GridNavigationButtons onGridNavigation={onGridNavigation} />
            )}
        </div>
      </SidePanelSection>
    </TooltipProvider>
  )
}
