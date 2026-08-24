"use client"

import type { LucideIcon } from "lucide-react"
import { Calendar, School, Search, Tag, XIcon } from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useFiscalYearStart } from "@/hooks/useFiscalYearStart"
import { fiscalYearRange, type FiscalYearStart } from "@/lib/fiscalYear"
import { cn } from "@/lib/utils"

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

/**
 * 一覧の検索欄。
 *
 * 幅を呼び手が決められるのは、置かれる場所が2つあるため。並びの中では畳まれない
 * 固定幅、列見出しの popover の中では幅一杯になる。
 */
export function ListSearchInput({
  searchTerm,
  onSearchTermChange,
  placeholder,
  className = "w-48",
}: {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={searchTerm}
        onChange={(event) => onSearchTermChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn("h-8 pl-8 text-sm", className)}
      />
    </div>
  )
}

/**
 * 複数選択フィルタの中身（選択肢の一覧とクリア）。
 *
 * `clearLabel` を渡せるのは、名前列の popover が**タグと学級を縦に並べる**ため。
 * 「フィルタをクリア」が2つ並ぶと、どちらがどちらを消すのか分からない。
 */
export function MultiSelectFilterPanel({
  config,
  clearLabel = "フィルタをクリア",
}: {
  config: MultiSelectFilterConfig
  clearLabel?: string
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
          {clearLabel}
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

/** ローカル日の `YYYY-MM-DD`（`<input type="date">` が受け取る形） */
function toDayValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`
}

/**
 * よく使う範囲。
 *
 * 日付は行ごとに違うので、他の列のような「値を選ぶ」絞り込みができない。毎回2つ
 * 打ち込むのは他の列と釣り合わないので、その代わりに置く。
 *
 * 「今年度」の切れ目は設定（`AppPreference`）から来る。4月始まりを決め打ちにすると、
 * 別の区切りで動いている場所では毎回2つ打ち直すことになる。
 */
const DATE_RANGE_PRESETS: {
  label: string
  toRange: (
    today: Date,
    fiscalYearStart: FiscalYearStart
  ) => { from: string; to: string }
}[] = [
  {
    label: "今月",
    toRange: (today) => ({
      from: toDayValue(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: toDayValue(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    }),
  },
  {
    label: "今年度",
    toRange: (today, fiscalYearStart) =>
      fiscalYearRange(today, fiscalYearStart),
  },
  {
    label: "直近30日",
    toRange: (today) => ({
      from: toDayValue(
        new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)
      ),
      to: toDayValue(today),
    }),
  },
]

/**
 * 日付を1つ受ける欄。ネイティブの `type="date"` のまま（打ち込みもカレンダーも使える）。
 *
 * ネイティブの空欄は「年/月/日」と出る。**この文言は差し替えられない**ので、空のあいだは
 * 中の欄そのものを透明にし、上に自前の文言を重ねる。打ち込みに入った（focus した）時点で
 * 元へ戻すので、キーボードから数字を入れる邪魔にはならない。
 *
 * 見出しは上ではなく左に置き、欄の高さぶんで1行に収める。
 */
function DayInput({
  rangeLabel,
  edge,
  value,
  onChange,
}: {
  /** 何の日付か（「試験日」など）。読み上げの名前に使う */
  rangeLabel: string
  edge: "開始" | "終了"
  value: string
  onChange: (value: string) => void
}) {
  const [isFocused, setIsFocused] = useState(false)
  // 打ち込み中は本物の欄を出す。**空かどうかだけで決めると、途中まで打った状態が
  // 見えない**（日付は全部揃うまで値が空のままなので）
  const showsOwnPlaceholder = value === "" && !isFocused

  return (
    <label className="flex items-center gap-2">
      <span className="w-7 shrink-0 text-xs text-muted-foreground">{edge}</span>
      <div className="relative flex-1">
        <Input
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          aria-label={`${rangeLabel}（${edge}）`}
          data-blank={showsOwnPlaceholder}
          className={cn(
            "h-8 w-full px-2 text-sm tabular-nums",
            // ネイティブの「年/月/日」を隠す（消せないので見えなくする）
            "data-[blank=true]:[&::-webkit-datetime-edit]:opacity-0",
            // 右端のカレンダーの絵。既定は大きく、暗い配色でも黒いまま
            "[&::-webkit-calendar-picker-indicator]:h-3.5 [&::-webkit-calendar-picker-indicator]:w-3.5",
            "[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-40",
            "[&::-webkit-calendar-picker-indicator]:hover:opacity-100",
            "dark:[&::-webkit-calendar-picker-indicator]:invert"
          )}
        />
        {showsOwnPlaceholder && (
          <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-sm text-muted-foreground">
            指定なし
          </span>
        )}
      </div>
    </label>
  )
}

/** 日付範囲フィルタの中身（よく使う範囲・開始・終了・クリア） */
export function DateRangeFilterPanel({
  config,
}: {
  config: DateRangeFilterConfig
}) {
  const { label, from, to, onFromChange, onToChange } = config
  const fiscalYearStart = useFiscalYearStart()
  const hasRange = from !== "" || to !== ""
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {DATE_RANGE_PRESETS.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            className="h-7 flex-1 text-xs"
            onClick={() => {
              const range = preset.toRange(new Date(), fiscalYearStart)
              onFromChange(range.from)
              onToChange(range.to)
            }}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <DayInput
        rangeLabel={label}
        edge="開始"
        value={from}
        onChange={onFromChange}
      />
      <DayInput
        rangeLabel={label}
        edge="終了"
        value={to}
        onChange={onToChange}
      />
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
