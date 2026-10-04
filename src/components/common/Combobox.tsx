"use client"

import { CheckIcon, ChevronsUpDownIcon, LockIcon } from "lucide-react"
import { type KeyboardEvent, useMemo, useRef, useState } from "react"

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
import { normalizeForSearch } from "@/lib/searchText"
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
 * 選択肢に、絞り込みに使う形（`filterByKeywords` が見る keywords）を添える。
 *
 * 打つたびに全件の文字列を作り直さないよう、選択肢が変わったときだけ作る。
 */
function useSearchableOptions<TOption extends ComboboxOption>(
  options: readonly TOption[]
) {
  return useMemo(
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

  const searchableOptions = useSearchableOptions(options)

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

/** チェック一覧の1行。チェックの有無と、行に添える状態を持つ */
export interface ComboboxCheckOption extends ComboboxOption {
  checked: boolean
  /**
   * 行の右に出す状態（「選択中」「含めない」など）。行の読み上げ文にも入るので、
   * チェックの有無はここで言葉にする（cmdk は今いる行に aria-selected を使うため、
   * チェックの有無を aria-selected で伝えられない）
   */
  statusText?: string
  /** 入れ替えられない理由。鍵と一緒に出し、選んでもチェックは変わらない */
  lockedReason?: string
  /** 外したものとして、薄く打ち消し線で残す */
  isStruckOut?: boolean
  /** 赤枠で囲む。文言は読み上げにだけ添える（例「外すと一緒に外れます」） */
  warningText?: string
}

interface ComboboxCheckListProps {
  /** 並べる行（並び順は呼び出し側が決める） */
  options: readonly ComboboxCheckOption[]
  /** 行を選んだ（クリック・Enter・Space）。外せない行・選べない行では呼ばない */
  onCheckedChange: (value: string, checked: boolean) => void
  /**
   * 今いる行（マウスを当てた・↑↓ で来た）が変わった。マウスもフォーカスも一覧から
   * 離れたとき・絞り込みを打ったときは null。開いたとき・絞り込んだときに cmdk が先頭へ
   * 寄せた行は知らせない
   */
  onActiveValueChange?: (value: string | null) => void
  searchPlaceholder: string
  emptyText: string
  /** 一覧（listbox）と検索欄の名前 */
  "aria-label": string
  className?: string
  /** 一覧の高さ（既定は h-48。中でスクロールする） */
  listClassName?: string
}

/** 日本語入力の変換中のキー（cmdk の Enter と同じ判定。Safari は keyCode 229 だけを立てる） */
const isComposingKey = (event: KeyboardEvent): boolean =>
  event.nativeEvent.isComposing || event.keyCode === 229

/**
 * 今いる行が無いときに cmdk へ渡す値（どの行の value とも一致しない）。
 *
 * cmdk は value が空だと、行が並んだ時点で先頭の行を選び、その行を scrollIntoView する。
 * 開いたままの一覧ではそれで外側（ダイアログの本文）までスクロールし、触ってもいない一覧の
 * 先頭が全部「今いる行」の色になる。空でない値を渡しておくと、先頭を選びにいかない
 */
const NO_ACTIVE_VALUE = "__combobox-check-list-no-active-value__"

/** 行を移るキー（cmdk の ↑↓・Home・End と、Ctrl+N/J/P/K） */
const isNavigationKey = (event: KeyboardEvent): boolean =>
  ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) ||
  (event.ctrlKey && ["n", "j", "p", "k"].includes(event.key))

/**
 * 開いたままのチェック一覧（cmdk）。複数を選ぶ。
 *
 * - 行そのものを選ぶ（クリック・↑↓ と Enter）とチェックが入れ替わる。行の中に操作できる
 *   部品は置かない（チェックの印は見た目だけ）
 * - Space は検索欄が空のときだけ入れ替えに使う（打った語の区切りの空白は奪わない）
 * - 検索欄にフォーカスを置いたまま ↑↓ で行を移れる。絞り込みは Combobox と同じ規則
 * - 日本語入力の変換中の Enter・Space では入れ替えない
 * - 検索欄にフォーカスするか行にマウスを当てるまで、今いる行を持たない（開いた直後に
 *   先頭の行を選ばない。外側がスクロールしない）。一覧から離れると今いる行は消える
 */
export function ComboboxCheckList({
  options,
  onCheckedChange,
  onActiveValueChange,
  searchPlaceholder,
  emptyText,
  "aria-label": ariaLabel,
  className,
  listClassName,
}: ComboboxCheckListProps) {
  const [search, setSearch] = useState("")
  const [activeValue, setActiveValue] = useState("")
  const searchableOptions = useSearchableOptions(options)
  // 以下はイベントの中でだけ読み書きする（描画には使わない）
  const isPointerInsideRef = useRef(false)
  const isFocusInsideRef = useRef(false)
  /** 今の keydown が行を移るキーか（cmdk はその keydown の中で onValueChange を呼ぶ） */
  const isKeyNavigationRef = useRef(false)
  const reportedValueRef = useRef<string | null>(null)

  const reportActiveValue = (value: string | null) => {
    if (reportedValueRef.current === value) return
    reportedValueRef.current = value
    onActiveValueChange?.(value)
  }

  const toggleOption = (value: string) => {
    const option = options.find((candidate) => candidate.value === value)
    if (!option || option.disabled || option.lockedReason) return
    onCheckedChange(option.value, !option.checked)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const isComposing = isComposingKey(event)
    isKeyNavigationRef.current = !isComposing && isNavigationKey(event)
    // 端で押して行が動かないときも、今の行を「↑↓ で来た行」として知らせる（動けば
    // 続く onValueChange が移った先で上書きする）
    if (isKeyNavigationRef.current) reportActiveValue(activeValue || null)
    if (event.key !== " " || search !== "" || isComposing) return
    event.preventDefault()
    if (activeValue) toggleOption(activeValue)
  }

  return (
    <Command
      label={ariaLabel}
      filter={filterByKeywords}
      value={activeValue || NO_ACTIVE_VALUE}
      onValueChange={(value) => {
        // 触れていない一覧では今いる行を持たない（フォーカスかマウスが入ってから）
        if (!isFocusInsideRef.current && !isPointerInsideRef.current) return
        setActiveValue(value)
        // ↑↓ で来た行だけを知らせる（開いたとき・絞り込んだときに cmdk が先頭へ寄せた行は
        // 利用者が選んだ「今いる行」ではない）。マウスで来た行は onPointerMove が知らせる
        if (isKeyNavigationRef.current) reportActiveValue(value || null)
      }}
      onKeyDown={handleKeyDown}
      onFocus={() => {
        isFocusInsideRef.current = true
      }}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return
        isFocusInsideRef.current = false
        if (isPointerInsideRef.current) return
        // 一覧から離れたら、今いる行の強調も消す
        setActiveValue("")
        reportActiveValue(null)
      }}
      onPointerEnter={() => {
        isPointerInsideRef.current = true
      }}
      onPointerMove={(event) => {
        // 行の上にいるときだけ、その行を今いる行として知らせる（行の間・検索欄では変えない）
        const optionElement =
          event.target instanceof Element
            ? event.target.closest("[data-check-option-value]")
            : null
        const hoveredValue = optionElement?.getAttribute(
          "data-check-option-value"
        )
        if (hoveredValue) reportActiveValue(hoveredValue)
      }}
      onPointerLeave={() => {
        isPointerInsideRef.current = false
        if (isFocusInsideRef.current) return
        setActiveValue("")
        reportActiveValue(null)
      }}
      className={cn("h-auto rounded-md border bg-background", className)}
    >
      <CommandInput
        placeholder={searchPlaceholder}
        value={search}
        onValueChange={(nextSearch) => {
          setSearch(nextSearch)
          // 絞り込むと今いる行が隠れうるので、↑↓ かマウスで選び直すまで知らせない
          reportActiveValue(null)
        }}
      />
      <CommandList label={ariaLabel} className={cn("h-48", listClassName)}>
        <CommandEmpty>{emptyText}</CommandEmpty>
        {searchableOptions.map(({ option, searchKeywords }) => (
          <CommandItem
            key={option.value}
            value={option.value}
            keywords={searchKeywords}
            disabled={option.disabled}
            data-check-option-value={option.value}
            onSelect={toggleOption}
            className={cn(
              option.warningText !== undefined &&
                "ring-1 ring-destructive ring-inset",
              option.isStruckOut &&
                "bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input",
                option.checked &&
                  "border-primary bg-primary text-primary-foreground",
                option.lockedReason && "opacity-60"
              )}
            >
              {option.checked && (
                <CheckIcon className="size-3.5 text-primary-foreground" />
              )}
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                option.isStruckOut &&
                  "text-amber-700/60 line-through dark:text-amber-300/60"
              )}
            >
              {option.label}
            </span>
            {option.statusText && (
              <span className="shrink-0 text-xs font-medium">
                {option.statusText}
              </span>
            )}
            {option.lockedReason && (
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <LockIcon aria-hidden className="size-3" />
                {option.lockedReason}
              </span>
            )}
            {option.warningText !== undefined && (
              <span className="sr-only">{option.warningText}</span>
            )}
          </CommandItem>
        ))}
      </CommandList>
    </Command>
  )
}
