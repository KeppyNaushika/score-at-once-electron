"use client"

import type { LucideIcon } from "lucide-react"
import { Calendar, School, Search, Tag, X as XIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/** 複数選択フィルタ（タグ・学級）の選択肢1件 */
export interface FilterOption {
  id: string
  name: string
}

/** タグ・学級など複数選択フィルタの設定 */
export interface MultiSelectFilterConfig {
  options: FilterOption[]
  selectedIds: Set<string>
  onToggle: (id: string, checked: boolean) => void
  onClear: () => void
}

/** 日付範囲フィルタの設定（値は YYYY-MM-DD、空文字は未指定） */
export interface DateRangeFilterConfig {
  label: string
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}

interface ListFilterBarProps {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  searchPlaceholder: string
  totalCount: number
  filteredCount: number
  tagFilter?: MultiSelectFilterConfig
  classroomFilter?: MultiSelectFilterConfig
  dateRangeFilter?: DateRangeFilterConfig
  /** 左側に差し込む画面固有の要素（一括タグ付与ボタン等） */
  leading?: ReactNode
}

/** 一覧共通のフィルタバー（検索・タグ・学級・日付範囲・件数表示） */
export function ListFilterBar({
  searchTerm,
  onSearchTermChange,
  searchPlaceholder,
  totalCount,
  filteredCount,
  tagFilter,
  classroomFilter,
  dateRangeFilter,
  leading,
}: ListFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {leading}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
          <Input
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 w-48 pl-8 text-sm"
          />
        </div>
        {tagFilter && (
          <MultiSelectFilter label="タグ" icon={Tag} config={tagFilter} />
        )}
        {classroomFilter && (
          <MultiSelectFilter
            label="学級"
            icon={School}
            config={classroomFilter}
          />
        )}
        {dateRangeFilter && <DateRangeFilter config={dateRangeFilter} />}
        <span className="text-muted-foreground text-xs">
          {filteredCount === totalCount
            ? `${totalCount}件`
            : `${filteredCount} / ${totalCount}件`}
        </span>
      </div>
    </div>
  )
}

function MultiSelectFilter({
  label,
  icon: Icon,
  config,
}: {
  label: string
  icon: LucideIcon
  config: MultiSelectFilterConfig
}) {
  const { options, selectedIds, onToggle, onClear } = config
  if (options.length === 0) return null
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={selectedIds.size > 0 ? "border-primary text-primary" : ""}
        >
          <Icon className="mr-1.5 h-3.5 w-3.5" />
          {label}
          {selectedIds.size > 0 && (
            <Badge
              variant="secondary"
              className="ml-1.5 h-5 min-w-5 px-1 text-xs"
            >
              {selectedIds.size}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {options.map((option) => (
            <label
              key={option.id}
              className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm"
            >
              <Checkbox
                checked={selectedIds.has(option.id)}
                onCheckedChange={(checked) =>
                  onToggle(option.id, checked === true)
                }
              />
              {option.name}
            </label>
          ))}
        </div>
        {selectedIds.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 w-full text-xs"
            onClick={onClear}
          >
            <XIcon className="mr-1 h-3 w-3" />
            フィルタをクリア
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}

function DateRangeFilter({ config }: { config: DateRangeFilterConfig }) {
  const { label, from, to, onFromChange, onToChange } = config
  const active = from !== "" || to !== ""
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={active ? "border-primary text-primary" : ""}
        >
          <Calendar className="mr-1.5 h-3.5 w-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2 p-3" align="start">
        <div className="space-y-1">
          <span className="text-muted-foreground text-xs">開始</span>
          <Input
            type="date"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <span className="text-muted-foreground text-xs">終了</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        {active && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              onFromChange("")
              onToChange("")
            }}
          >
            <XIcon className="mr-1 h-3 w-3" />
            クリア
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
