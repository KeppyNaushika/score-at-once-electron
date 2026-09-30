"use client"

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/** 選択肢1つ。`value` は id、探すときは `label` と `keywords` だけを見る */
export interface ComboboxOption {
  value: string
  label: string
  /** 表示はしないが打てば引っかかる語（生徒なら番号・カナ、試験なら日付など） */
  keywords?: string[]
  /** 見せはするが選ばせない（他で使用済みなど、選べない理由を label に添える） */
  disabled?: boolean
}

interface ComboboxProps {
  options: ComboboxOption[]
  /** 選んでいる選択肢の value。未選択は空文字 */
  value: string
  onValueChange: (value: string) => void
  /** 未選択のときにボタンに出す文言 */
  placeholder: string
  /** 絞り込み欄の placeholder */
  searchPlaceholder: string
  /** 絞り込んで1件も残らないときの文言 */
  emptyText: string
  disabled?: boolean
  /** ボタンの見た目（幅・高さ・文字の大きさ） */
  className?: string
  id?: string
  "aria-label"?: string
}

/**
 * 絞り込みに使う形へ揃える。全角英数は半角へ（NFKC）、英字は小文字へ、カタカナは
 * ひらがなへ寄せる。カナの列はカタカナで持っている一方、打つときはひらがなのまま
 * 確定しがちなので、どちらで打っても引っかかるようにする。
 */
function normalizeForSearch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (katakana) =>
      String.fromCharCode(katakana.charCodeAt(0) - 0x60)
    )
}

/**
 * cmdk の絞り込み。**value（= id）は見ない。** 既定の絞り込みは value も対象に
 * するので、id の文字列に打った文字が含まれるだけで無関係の選択肢が残ってしまう。
 *
 * 空白で区切った語をすべて含むものだけを残す（あいまい一致はしない。漢字の氏名で
 * 飛び飛びに一致すると、関係の無い生徒が大量に残る）。並び順を変えないよう、残す
 * ものは全部同じ点にする。
 */
function filterByKeywords(
  _value: string,
  search: string,
  keywords?: string[]
): number {
  const haystack = keywords?.join(" ") ?? ""
  const searchTerms = normalizeForSearch(search).split(/\s+/).filter(Boolean)
  return searchTerms.every((searchTerm) => haystack.includes(searchTerm))
    ? 1
    : 0
}

/**
 * 件数の多い選択肢から、打って絞り込んで1つ選ぶ部品（Popover + cmdk）。
 *
 * - キーボードだけで、開く（Enter/Space）・打つ・選ぶ（↑↓ と Enter）・閉じる（Esc）ができる
 * - 閉じるとフォーカスはボタンへ戻る
 * - 日本語入力の変換中の Enter では選ばない（cmdk が `isComposing` を見て止める）。
 *   変換中の Esc でも閉じない
 */
export function Combobox({
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  className,
  id,
  "aria-label": ariaLabel,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)

  const selectedOption = options.find((option) => option.value === value)

  // 打つたびに全件の文字列を作り直さないよう、絞り込みに使う形を先に作っておく
  const searchableOptions = useMemo(
    () =>
      options.map((option) => {
        const searchText = [option.label, ...(option.keywords ?? [])].join(" ")
        const normalizedText = normalizeForSearch(searchText)
        return {
          option,
          // 「山田太郎」と続けて打っても「山田 太郎」に引っかかるよう、空白を抜いた形も持つ
          searchKeywords: [normalizedText, normalizedText.replace(/\s+/g, "")],
        }
      }),
    [options]
  )

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn("justify-between font-normal", className)}
        >
          <span
            className={cn(
              "truncate",
              !selectedOption && "text-muted-foreground"
            )}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 min-w-(--radix-popover-trigger-width) p-0"
        align="start"
        onEscapeKeyDown={(event) => {
          // 変換を取り消す Esc で一覧まで閉じない
          if (event.isComposing) event.preventDefault()
        }}
      >
        <Command filter={filterByKeywords} defaultValue={value}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {searchableOptions.map(({ option, searchKeywords }) => (
              <CommandItem
                key={option.value}
                value={option.value}
                keywords={searchKeywords}
                disabled={option.disabled}
                onSelect={() => {
                  onValueChange(option.value)
                  setOpen(false)
                }}
              >
                <CheckIcon
                  className={cn(
                    "size-4",
                    option.value === value ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="truncate">{option.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
