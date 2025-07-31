"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Eye,
  RotateCcw,
} from "lucide-react"

type GridLayoutDirection =
  | "right-down"
  | "left-down"
  | "down-right"
  | "down-left"

interface NavigationControlsProps {
  layoutDirection: GridLayoutDirection
  selectedAnswersCount: number
  visibleAnswersCount: number
  totalAnswersCount: number
  onLayoutDirectionChange: (direction: GridLayoutDirection) => void
  onGridNavigation: (direction: string) => void
  onRefreshView: () => void
  currentPosition?: { row: number; col: number }
  itemsPerRow?: number[]
  onItemsPerRowChange?: (value: number[]) => void
  autoScroll?: boolean
  onAutoScrollChange?: (enabled: boolean) => void
}

const LAYOUT_OPTIONS = [
  { value: "right-down", label: "右→下", description: "右に進んでから下へ" },
  { value: "left-down", label: "左→下", description: "左に進んでから下へ" },
  { value: "down-right", label: "下→右", description: "下に進んでから右へ" },
  { value: "down-left", label: "下→左", description: "下に進んでから左へ" },
]

export default function NavigationControls({
  layoutDirection,
  selectedAnswersCount,
  visibleAnswersCount,
  totalAnswersCount,
  onLayoutDirectionChange,
  onGridNavigation,
  onRefreshView,
  currentPosition,
  itemsPerRow,
  onItemsPerRowChange,
  autoScroll = true,
  onAutoScrollChange,
}: NavigationControlsProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="mb-4 space-y-4 bg-white p-4">
        {/* 表示状況 */}
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-700">表示状況</h3>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <Eye className="h-3 w-3 text-blue-500" />
              <Badge variant="outline">{visibleAnswersCount}</Badge>
            </div>
            <div className="text-gray-400">/</div>
            <Badge variant="secondary">{totalAnswersCount}</Badge>
            {selectedAnswersCount > 0 && (
              <>
                <div className="text-gray-400">/</div>
                <Badge className="bg-blue-500">{selectedAnswersCount}</Badge>
              </>
            )}
          </div>
        </div>

        <Separator />

        {/* 1行あたりの表示件数 */}
        {itemsPerRow && onItemsPerRowChange && (
          <>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {layoutDirection === "down-right" ||
                layoutDirection === "down-left"
                  ? "1列あたりの表示件数"
                  : "1行あたりの表示件数"}
              </label>
              <div className="flex items-center space-x-4">
                <Slider
                  value={itemsPerRow}
                  onValueChange={onItemsPerRowChange}
                  max={10}
                  min={1}
                  step={1}
                  className="flex-1"
                />
                <span className="text-muted-foreground min-w-[30px] text-sm">
                  {itemsPerRow[0]}件
                </span>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* 自動スクロール設定 */}
        {onAutoScrollChange && (
          <>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                自動スクロール
              </label>
              <Switch
                checked={autoScroll}
                onCheckedChange={onAutoScrollChange}
              />
            </div>
            <p className="text-xs text-gray-500">
              WASD移動時に選択答案を画面中央に表示
            </p>
            <Separator />
          </>
        )}

        {/* レイアウト設定 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            レイアウト方向
          </label>
          <Select
            value={layoutDirection}
            onValueChange={(value) =>
              onLayoutDirectionChange(value as GridLayoutDirection)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LAYOUT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* WASD移動コントロール */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-700">移動</h3>
            {currentPosition && (
              <Badge variant="outline" className="text-xs">
                {currentPosition.row + 1}:{currentPosition.col + 1}
              </Badge>
            )}
          </div>

          {/* 移動ボタン */}
          <div className="flex flex-col items-center gap-1">
            {/* 上 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-12"
                  onClick={() => onGridNavigation("w")}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <div>上に移動</div>
                  <div className="mt-1 text-xs text-gray-400">
                    キー:{" "}
                    <kbd className="rounded bg-gray-200 px-1 py-0.5 text-xs">
                      W
                    </kbd>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>

            {/* 中央行: 左・更新・右 */}
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 w-12"
                    onClick={() => onGridNavigation("a")}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <div>左に移動</div>
                    <div className="mt-1 text-xs text-gray-400">
                      キー:{" "}
                      <kbd className="rounded bg-gray-200 px-1 py-0.5 text-xs">
                        A
                      </kbd>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 w-12"
                    onClick={onRefreshView}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <div>表示を更新</div>
                    <div className="mt-1 text-xs text-gray-400">
                      キー:{" "}
                      <kbd className="rounded bg-gray-200 px-1 py-0.5 text-xs">
                        R
                      </kbd>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 w-12"
                    onClick={() => onGridNavigation("d")}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <div>右に移動</div>
                    <div className="mt-1 text-xs text-gray-400">
                      キー:{" "}
                      <kbd className="rounded bg-gray-200 px-1 py-0.5 text-xs">
                        D
                      </kbd>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* 下 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-12"
                  onClick={() => onGridNavigation("s")}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <div>下に移動</div>
                  <div className="mt-1 text-xs text-gray-400">
                    キー:{" "}
                    <kbd className="rounded bg-gray-200 px-1 py-0.5 text-xs">
                      S
                    </kbd>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
