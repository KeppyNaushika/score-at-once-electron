"use client"

import type { LucideIcon } from "lucide-react"
import { Calendar, School, Search, Tag, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/**
 * 一覧の絞り込み部品。
 *
 * **どれも「ボタン（popover）」と「中身だけ」の2つの姿を持つ。** ヘッダー右の並びが
 * 溢れると `OverflowToolbar` が「…」の popover へ移すので、popover のボタンをそのまま
 * 入れると popover の中で popover を開くことになる。中では開いた中身をそのまま置く。
 *
 * 姿が2つでも実装は1つ（ボタンは中身を popover で包むだけ）なので、選択の見た目や
 * クリアの導線が2通りに割れることはない。
 */

/** 複数選択フィルタ（タグ・学級）の選択肢1件 */
interface FilterOption {
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

/** 一覧の検索欄。ヘッダーの並びでは最後まで畳まない（検索できない一覧にしない） */
export function ListSearchInput({
  searchTerm,
  onSearchTermChange,
  placeholder,
}: {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={searchTerm}
        onChange={(event) => onSearchTermChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 w-48 pl-8 text-sm"
      />
    </div>
  )
}

/** 複数選択フィルタの中身（選択肢の一覧とクリア） */
export function MultiSelectFilterPanel({
  config,
}: {
  config: MultiSelectFilterConfig
}) {
  const { options, selectedIds, onToggle, onClear } = config
  return (
    <>
      <div className="max-h-48 space-y-1 overflow-y-auto">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
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
    </>
  )
}

/** 複数選択フィルタのボタン（押すと中身を popover で開く） */
function MultiSelectFilterButton({
  label,
  icon: Icon,
  config,
}: {
  label: string
  icon: LucideIcon
  config: MultiSelectFilterConfig
}) {
  if (config.options.length === 0) return null
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={
            config.selectedIds.size > 0 ? "border-primary text-primary" : ""
          }
        >
          <Icon className="mr-1.5 h-3.5 w-3.5" />
          {label}
          {config.selectedIds.size > 0 && (
            <Badge
              variant="secondary"
              className="ml-1.5 h-5 min-w-5 px-1 text-xs"
            >
              {config.selectedIds.size}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <MultiSelectFilterPanel config={config} />
      </PopoverContent>
    </Popover>
  )
}

/** 日付範囲フィルタの中身（開始・終了とクリア） */
export function DateRangeFilterPanel({
  config,
}: {
  config: DateRangeFilterConfig
}) {
  const { label, from, to, onFromChange, onToChange } = config
  const hasRange = from !== "" || to !== ""
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">{label}（開始）</span>
        <Input
          type="date"
          value={from}
          onChange={(event) => onFromChange(event.target.value)}
          aria-label={`${label}（開始）`}
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">{label}（終了）</span>
        <Input
          type="date"
          value={to}
          onChange={(event) => onToChange(event.target.value)}
          aria-label={`${label}（終了）`}
          className="h-8 text-sm"
        />
      </div>
      {hasRange && (
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
    </div>
  )
}

/** 日付範囲フィルタのボタン（押すと中身を popover で開く） */
export function DateRangeFilterButton({
  config,
}: {
  config: DateRangeFilterConfig
}) {
  const hasRange = config.from !== "" || config.to !== ""
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={hasRange ? "border-primary text-primary" : ""}
        >
          <Calendar className="mr-1.5 h-3.5 w-3.5" />
          {config.label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <DateRangeFilterPanel config={config} />
      </PopoverContent>
    </Popover>
  )
}

/**
 * タグ絞り込み。**語とアイコンをここで決めてしまう**のは、4画面すべてが持つ絞り込みで、
 * 呼び手ごとに書けば「タグ」「タグで絞り込み」のように割れるため。
 */
export function TagFilterButton({
  config,
}: {
  config: MultiSelectFilterConfig
}) {
  return <MultiSelectFilterButton label="タグ" icon={Tag} config={config} />
}

/** 学級絞り込み。タグと同じ理由で語とアイコンをここに持つ */
export function ClassroomFilterButton({
  config,
}: {
  config: MultiSelectFilterConfig
}) {
  return <MultiSelectFilterButton label="学級" icon={School} config={config} />
}
