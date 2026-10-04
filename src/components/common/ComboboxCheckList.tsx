"use client"

import { CheckIcon, LockIcon } from "lucide-react"
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"

import type { ComboboxOption } from "./Combobox"
import { filterByKeywords, useSearchableOptions } from "./comboboxSearch"

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
  /**
   * 行の右端に赤字で出す文言（例「3件の選択を解除」）。出している間、statusText は
   * 見た目だけ隠す（同じ場所に重ねるので行の大きさは変わらない。読み上げには両方入る）
   */
  impactText?: string
  /** 赤字の補足（理由など）。title と読み上げに添える */
  impactDescription?: string
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
  /** 一覧の上（検索欄の上）の見出しの行に、全選択のチェックボックスと並べて出すもの */
  header?: ReactNode
  /**
   * 見出しの全選択で、今一覧に出ている行（絞り込んでいれば絞った行）にまとめてチェックを
   * 当てる。渡すと全選択のチェックボックスを出す。外せない行・選べない行は渡さない
   */
  onCheckedChangeMany?: (values: string[], checked: boolean) => void
  /** 全選択のチェックボックスの名前（例「表示中の生徒を全て選ぶ」） */
  selectAllLabel?: string
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
  header,
  onCheckedChangeMany,
  selectAllLabel,
}: ComboboxCheckListProps) {
  const [search, setSearch] = useState("")
  const [activeValue, setActiveValue] = useState("")
  const searchableOptions = useSearchableOptions(options)
  // 全選択が効く行。cmdk と同じ絞り込みの関数で求めるので、表示と食い違わない
  const visibleToggleableOptions = searchableOptions
    .filter(
      ({ option, searchKeywords }) =>
        search === "" ||
        filterByKeywords(option.value, search, searchKeywords) > 0
    )
    .map(({ option }) => option)
    .filter((option) => !option.disabled && !option.lockedReason)
  const checkedVisibleCount = visibleToggleableOptions.filter(
    (option) => option.checked
  ).length
  const selectAllState =
    checkedVisibleCount === 0
      ? false
      : checkedVisibleCount === visibleToggleableOptions.length
        ? true
        : "indeterminate"
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
    <div className={cn("space-y-1", className)}>
      {(header !== undefined || onCheckedChangeMany) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {onCheckedChangeMany && (
            <Checkbox
              aria-label={selectAllLabel}
              checked={selectAllState}
              disabled={visibleToggleableOptions.length === 0}
              onCheckedChange={() => {
                // 全部入っていれば全部外す。一部・何も無いときは全部入れる
                const isChecking = selectAllState !== true
                onCheckedChangeMany(
                  visibleToggleableOptions
                    .filter((option) => option.checked !== isChecking)
                    .map((option) => option.value),
                  isChecking
                )
              }}
            />
          )}
          {header}
        </div>
      )}
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
        className="h-auto rounded-md border bg-background"
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
              {(option.statusText || option.impactText) && (
                // 状態と赤字を同じ升目に重ねる。赤字が出ても行の高さは変わらず、並びもずれない
                <span className="grid shrink-0 text-right text-xs font-medium whitespace-nowrap">
                  {option.statusText && (
                    <span
                      className={cn(
                        "col-start-1 row-start-1",
                        // 見た目だけ隠す（読み上げには残す）
                        option.impactText && "opacity-0"
                      )}
                    >
                      {option.statusText}
                    </span>
                  )}
                  {option.impactText && (
                    <span
                      title={option.impactDescription}
                      className="col-start-1 row-start-1 text-destructive"
                    >
                      {option.impactText}
                    </span>
                  )}
                </span>
              )}
              {option.impactDescription && (
                <span className="sr-only">{option.impactDescription}</span>
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
    </div>
  )
}
