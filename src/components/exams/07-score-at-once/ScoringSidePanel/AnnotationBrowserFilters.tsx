"use client"

import { Star } from "lucide-react"

import { Combobox, type ComboboxOption } from "@/components/common/Combobox"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import type { AnnotationFilters } from "./hooks/useAnnotationBrowser"

/** 手書きの一覧の絞り込み（設問・生徒・種類・お気に入り） */
export function AnnotationBrowserFilters({
  filters,
  onFiltersChange,
  cropRegions,
  examStudentFilterOptions,
}: {
  filters: AnnotationFilters
  onFiltersChange: (partial: Partial<AnnotationFilters>) => void
  cropRegions: QuestionAnswerRegionRow[]
  examStudentFilterOptions: ComboboxOption[]
}) {
  return (
    <div className="space-y-2 border-b p-3">
      <div className="grid grid-cols-2 gap-2">
        {/* 設問フィルタ */}
        <Select
          value={filters.cropRegionId ?? "all"}
          onValueChange={(value) =>
            onFiltersChange({ cropRegionId: value === "all" ? null : value })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="設問" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全設問</SelectItem>
            {cropRegions.map((cropRegion) => (
              <SelectItem key={cropRegion.id} value={cropRegion.id}>
                {cropRegion.label || cropRegion.id.slice(0, 6)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 生徒フィルタ */}
        <Combobox
          options={examStudentFilterOptions}
          value={filters.examStudentId ?? "all"}
          onValueChange={(value) =>
            onFiltersChange({ examStudentId: value === "all" ? null : value })
          }
          placeholder="生徒"
          searchPlaceholder="番号・氏名で検索"
          emptyText="該当する生徒がいません"
          aria-label="生徒で絞り込む"
          className="h-8 text-xs"
        />
      </div>

      <div className="flex items-center gap-2">
        {/* 種類フィルタ */}
        <Select
          value={filters.type ?? "all"}
          onValueChange={(value) =>
            onFiltersChange({
              type:
                value === "all"
                  ? null
                  : (value as "text" | "line" | "rectangle" | "ellipse"),
            })
          }
        >
          <SelectTrigger className="h-8 flex-1 text-xs">
            <SelectValue placeholder="種類" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全種類</SelectItem>
            <SelectItem value="text">テキスト</SelectItem>
            <SelectItem value="line">直線</SelectItem>
            <SelectItem value="rectangle">長方形</SelectItem>
            <SelectItem value="ellipse">楕円</SelectItem>
          </SelectContent>
        </Select>

        {/* お気に入りのみトグル */}
        <Button
          variant={filters.favoritesOnly ? "default" : "outline"}
          size="sm"
          className="h-8 shrink-0 px-2"
          onClick={() =>
            onFiltersChange({ favoritesOnly: !filters.favoritesOnly })
          }
        >
          <Star
            className={cn(
              "h-3.5 w-3.5",
              filters.favoritesOnly && "fill-current"
            )}
          />
        </Button>
      </div>
    </div>
  )
}
