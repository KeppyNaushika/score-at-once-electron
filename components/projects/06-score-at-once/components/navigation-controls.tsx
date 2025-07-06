"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Grid3X3,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  Settings,
} from "lucide-react"

type GridLayoutDirection = "right-down" | "left-down" | "down-right" | "down-left"

interface NavigationControlsProps {
  gridSize: { columns: number; rows: number }
  layoutDirection: GridLayoutDirection
  selectedAnswersCount: number
  visibleAnswersCount: number
  totalAnswersCount: number
  onGridSizeChange: (size: { columns: number; rows: number }) => void
  onLayoutDirectionChange: (direction: GridLayoutDirection) => void
  onGridNavigation: (direction: string) => void
  onRefreshView: () => void
  currentPosition?: { row: number; col: number }
}

const LAYOUT_OPTIONS = [
  { value: "right-down", label: "右→下", description: "右に進んでから下へ" },
  { value: "left-down", label: "左→下", description: "左に進んでから下へ" },
  { value: "down-right", label: "下→右", description: "下に進んでから右へ" },
  { value: "down-left", label: "下→左", description: "下に進んでから左へ" },
]

const GRID_SIZE_OPTIONS = [
  { columns: 3, rows: 2, label: "3×2" },
  { columns: 4, rows: 3, label: "4×3" },
  { columns: 5, rows: 3, label: "5×3" },
  { columns: 6, rows: 4, label: "6×4" },
  { columns: 8, rows: 4, label: "8×4" },
  { columns: 10, rows: 5, label: "10×5" },
]

export default function NavigationControls({
  gridSize,
  layoutDirection,
  selectedAnswersCount,
  visibleAnswersCount,
  totalAnswersCount,
  onGridSizeChange,
  onLayoutDirectionChange,
  onGridNavigation,
  onRefreshView,
  currentPosition,
}: NavigationControlsProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Card className="mb-4">
        <CardContent className="p-4 space-y-4">
          
          {/* 表示状況 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">表示状況</h3>
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

          {/* グリッド設定 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                グリッドサイズ
              </label>
              <Select
                value={`${gridSize.columns}x${gridSize.rows}`}
                onValueChange={(value) => {
                  const option = GRID_SIZE_OPTIONS.find(opt => `${opt.columns}x${opt.rows}` === value)
                  if (option) {
                    onGridSizeChange({ columns: option.columns, rows: option.rows })
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRID_SIZE_OPTIONS.map((option) => (
                    <SelectItem 
                      key={`${option.columns}x${option.rows}`} 
                      value={`${option.columns}x${option.rows}`}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                レイアウト方向
              </label>
              <Select
                value={layoutDirection}
                onValueChange={(value) => onLayoutDirectionChange(value as GridLayoutDirection)}
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
          </div>

          <Separator />

          {/* WASD移動コントロール */}
          <div>
            <div className="flex items-center gap-2 mb-3">
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
                    className="w-12 h-10"
                    onClick={() => onGridNavigation("w")}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <div>上に移動</div>
                    <div className="text-xs text-gray-400 mt-1">
                      キー: <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">W</kbd>
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
                      className="w-12 h-10"
                      onClick={() => onGridNavigation("a")}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center">
                      <div>左に移動</div>
                      <div className="text-xs text-gray-400 mt-1">
                        キー: <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">A</kbd>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-12 h-10"
                      onClick={onRefreshView}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center">
                      <div>表示を更新</div>
                      <div className="text-xs text-gray-400 mt-1">
                        キー: <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">R</kbd>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-12 h-10"
                      onClick={() => onGridNavigation("d")}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center">
                      <div>右に移動</div>
                      <div className="text-xs text-gray-400 mt-1">
                        キー: <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">D</kbd>
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
                    className="w-12 h-10"
                    onClick={() => onGridNavigation("s")}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <div>下に移動</div>
                    <div className="text-xs text-gray-400 mt-1">
                      キー: <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">S</kbd>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>

          </div>

        </CardContent>
      </Card>
    </TooltipProvider>
  )
}