"use client"

import { ChevronDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/** プルダウンに並べる選択肢1つ */
export interface CheckboxDropdownOption<Value extends string> {
  value: Value
  label: string
}

interface CheckboxDropdownProps<Value extends string> {
  /** 並べる選択肢（この順に並べ、要約の「先頭」もこの順で決まる） */
  options: readonly CheckboxDropdownOption<Value>[]
  /** チェックの入っている値 */
  selectedValues: ReadonlySet<Value>
  onSelectedValuesChange: (selectedValues: ReadonlySet<Value>) => void
  /** 何も選んでいないときにボタンに出す文言 */
  emptyText: string
  "aria-label": string
  /** ボタンの見た目（幅・高さ） */
  className?: string
}

/**
 * ボタンに出す要約。全部なら「すべて」、1つならその名前、複数なら先頭＋「ほかN」、
 * 何も無ければ `emptyText`
 */
function summarizeSelectedValues<Value extends string>(
  options: readonly CheckboxDropdownOption<Value>[],
  selectedValues: ReadonlySet<Value>,
  emptyText: string
): string {
  const selectedOptions = options.filter((option) =>
    selectedValues.has(option.value)
  )
  if (selectedOptions.length > 0 && selectedOptions.length === options.length) {
    return "すべて"
  }
  const [firstOption, ...restOptions] = selectedOptions
  if (firstOption === undefined) return emptyText
  return restOptions.length === 0
    ? firstOption.label
    : `${firstOption.label}ほか${restOptions.length}`
}

/**
 * プルダウンを開くとチェックが並び、複数を選ぶ部品。
 *
 * 1つ選ぶ形だと「未在籍・在籍中」のような組み合わせに名前を付けることになり、選択肢が
 * 増えると組み合わせが欄に収まらない。選択肢ごとに付け外しすれば組み合わせに名前は要らない。
 * 続けて付け外しできるよう、選んでもメニューを閉じない
 */
export function CheckboxDropdown<Value extends string>({
  options,
  selectedValues,
  onSelectedValuesChange,
  emptyText,
  "aria-label": ariaLabel,
  className,
}: CheckboxDropdownProps<Value>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={ariaLabel}
          className={cn("justify-between rounded-lg font-normal", className)}
        >
          <span className="truncate">
            {summarizeSelectedValues(options, selectedValues, emptyText)}
          </span>
          <ChevronDownIcon className="opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selectedValues.has(option.value)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(isChecked) => {
              const nextValues = new Set(selectedValues)
              if (isChecked === true) nextValues.add(option.value)
              else nextValues.delete(option.value)
              onSelectedValuesChange(nextValues)
            }}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
