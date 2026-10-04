"use client"

import { ChevronDown, Plus, TrendingUp, X } from "lucide-react"
import type { ReactNode } from "react"

import { TooltipButton } from "@/components/common/TooltipButton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  type SubtotalOption,
  TOTAL_SUBTOTAL_ID,
  type TrendSeries,
} from "./types"

interface TrendSeriesEditorProps<TSeries extends TrendSeries> {
  /** カードの題（「成績の推移」など） */
  title: string
  seriesList: TSeries[]
  subtotalOptions: SubtotalOption[]
  subtotalGroups: [string, SubtotalOption[]][]
  allTags: string[]
  onAddSeries: () => void
  onRemoveSeries: (seriesId: string) => void
  onToggleTag: (seriesId: string, tag: string) => void
  onClearTags: (seriesId: string) => void
  onSetSubtotal: (seriesId: string, subtotalId: string) => void
  /** タグの後ろ（削除ボタンの前）に足す、その画面だけの切り替え */
  renderExtraControls?: (series: TSeries) => ReactNode
}

/** 推移グラフのカード見出し。題・系列の追加・系列ごとの設定行 */
export function TrendSeriesEditor<TSeries extends TrendSeries>({
  title,
  seriesList,
  subtotalOptions,
  subtotalGroups,
  allTags,
  onAddSeries,
  onRemoveSeries,
  onToggleTag,
  onClearTags,
  onSetSubtotal,
  renderExtraControls,
}: TrendSeriesEditorProps<TSeries>) {
  return (
    <CardHeader className="space-y-3">
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {title}
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg"
          onClick={onAddSeries}
        >
          <Plus className="mr-1 h-4 w-4" />
          系列を追加
        </Button>
      </div>

      {/* 系列設定 */}
      <div className="space-y-2">
        {seriesList.map((series) => (
          <div
            key={series.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 px-3 py-2"
          >
            <div
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: series.color }}
            />

            {/* 小計選択 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 rounded px-2 text-xs font-normal"
                >
                  {series.subtotalId === TOTAL_SUBTOTAL_ID
                    ? "合計得点率"
                    : (subtotalOptions.find(
                        (option) => option.id === series.subtotalId
                      )?.label ?? "合計得点率")}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => onSetSubtotal(series.id, TOTAL_SUBTOTAL_ID)}
                >
                  合計得点率
                </DropdownMenuItem>
                {subtotalGroups.map(([groupName, items]) => (
                  <DropdownMenuSub key={groupName}>
                    <DropdownMenuSubTrigger>{groupName}</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {items.map((option) => (
                        <DropdownMenuItem
                          key={option.id}
                          onClick={() => onSetSubtotal(series.id, option.id)}
                        >
                          {option.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* タグフィルタ */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-xs text-muted-foreground">タグ:</span>
                <Badge
                  variant={series.tags.size === 0 ? "default" : "outline"}
                  className="h-5 cursor-pointer rounded-full px-2 text-[10px] font-normal"
                  onClick={() => onClearTags(series.id)}
                >
                  全て
                </Badge>
                {allTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={series.tags.has(tag) ? "default" : "outline"}
                    className="h-5 cursor-pointer rounded-full px-2 text-[10px] font-normal"
                    onClick={() => onToggleTag(series.id, tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {renderExtraControls?.(series)}

            {/* 削除ボタン */}
            {seriesList.length > 1 && (
              <TooltipButton
                label="系列を削除"
                variant="ghost"
                size="icon"
                className="ml-auto h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onRemoveSeries(series.id)}
              >
                <X className="h-3.5 w-3.5" />
              </TooltipButton>
            )}
          </div>
        ))}
      </div>
    </CardHeader>
  )
}
