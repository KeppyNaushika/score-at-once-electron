"use client"

import { useQuery } from "@tanstack/react-query"
import { XIcon } from "lucide-react"
import {
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react"

import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { matchesSearchTerm } from "@/lib/searchText"
import { auditLogScopesQuery } from "@/queries/auditLog"
import type { PublicUser } from "@/queries/user"

import {
  addAuditFilterTokens,
  AUDIT_FILTER_FIELDS,
  type AuditFilterCandidate,
  auditFilterFieldByKeyword,
  auditFilterFieldOf,
  type AuditFilterState,
  type AuditFilterToken,
} from "../filterFields"

/** 打った文字列が `student:…` の形なら、欄の名前とその後ろ */
const FIELD_INPUT = /^([A-Za-z]+):(.*)$/

/** 候補の一覧に出す1行。欄の名前の補完か、値の候補か */
type SuggestionRow =
  | { kind: "field"; key: string; keyword: string; label: string }
  | { kind: "value"; key: string; candidate: AuditFilterCandidate }

interface AuditLogFilterBarProps {
  filter: AuditFilterState
  setFilter: Dispatch<SetStateAction<AuditFilterState>>
  users: PublicUser[]
}

/**
 * 監査ログの絞り込み欄（構文 + 補完）。
 *
 * 確定した条件は chip、未確定の文字列は素の `<input>` に置く。`student:` のように
 * 欄の名前を打つと、その欄の候補が出る（Tab / Enter で確定）。欄の名前を付けずに
 * 打った文字列は、内容（要約）の全文検索になる。
 *
 * - 欄の定義（候補の出し方・条件への写し方）は `filterFields.ts` の1か所にある
 * - 日本語入力の変換中は、Tab / Backspace / Esc を欄の操作に使わない
 * - ↑↓ と Enter は cmdk が受け持つ（入力欄が `Command` の中にあるので届く）
 */
export function AuditLogFilterBar({
  filter,
  setFilter,
  users,
}: AuditLogFilterBarProps) {
  const [inputText, setInputText] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedKey, setHighlightedKey] = useState("")

  const { data: facets } = useQuery(auditLogScopesQuery())

  const fieldInput = FIELD_INPUT.exec(inputText)
  const activeField = fieldInput
    ? auditFilterFieldByKeyword(fieldInput[1].toLowerCase())
    : undefined
  const query = activeField && fieldInput ? fieldInput[2] : inputText

  const suggestions = useMemo((): SuggestionRow[] => {
    if (activeField) {
      return activeField
        .candidates(
          {
            scopes: facets?.scopes ?? [],
            targets: facets?.targets ?? [],
            users,
            tokens: filter.tokens,
          },
          query
        )
        .map((candidate) => ({ kind: "value", key: candidate.key, candidate }))
    }
    return AUDIT_FILTER_FIELDS.filter(
      (field) =>
        (!field.isAvailable || field.isAvailable(filter.tokens)) &&
        matchesSearchTerm(query, [field.keyword, field.label])
    ).map((field) => ({
      kind: "field",
      key: `field:${field.keyword}`,
      keyword: field.keyword,
      label: field.label,
    }))
  }, [activeField, facets, users, filter.tokens, query])

  // いま選ばれている候補。候補が入れ替わって選んでいたものが消えたら先頭にする
  // （Enter は cmdk が、Tab はここが、この候補を確定する）
  const highlighted =
    suggestions.find((suggestion) => suggestion.key === highlightedKey) ??
    suggestions[0]

  // 欄の名前を付けずに打った文字列は全文検索。デバウンスして条件へ反映する。
  //
  // **いま効いている検索語と同じなら書かない。** `setFilter` は条件が変わった合図
  // なので、無条件に1ページ目へ戻す。書き換える理由が無いときに書くと、開いた直後
  // （どちらも空）に 300ms 遅れて絞り込みを「変えた」ことになり、その間に送った
  // ページが1ページ目へ引き戻される
  const searchText = activeField ? "" : inputText.trim()
  const appliedSearchText = filter.search ?? ""
  useEffect(() => {
    if (searchText === appliedSearchText) return
    const timeoutId = setTimeout(() => {
      setFilter((prev) => ({ ...prev, search: searchText || undefined }))
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [searchText, appliedSearchText, setFilter])

  const addTokens = (tokens: AuditFilterToken[]) => {
    setFilter((prev) => ({
      ...prev,
      tokens: addAuditFilterTokens(prev.tokens, tokens),
    }))
    setInputText("")
  }

  const removeToken = (removed: AuditFilterToken) => {
    setFilter((prev) => ({
      ...prev,
      tokens: prev.tokens.filter((token) => token !== removed),
    }))
  }

  const selectSuggestion = (suggestion: SuggestionRow) => {
    if (suggestion.kind === "field") {
      setInputText(`${suggestion.keyword}:`)
    } else {
      addTokens(suggestion.candidate.tokens)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === "Backspace" && inputText === "") {
      const lastToken = filter.tokens.at(-1)
      if (lastToken) removeToken(lastToken)
      return
    }
    if (e.key === "Escape") {
      setIsOpen(false)
      return
    }
    if (e.key === "Tab" && isOpen) {
      if (!highlighted) return
      e.preventDefault()
      selectSuggestion(highlighted)
    }
  }

  const showList = isOpen && (suggestions.length > 0 || activeField)

  return (
    <Command
      shouldFilter={false}
      loop
      value={highlighted?.key ?? ""}
      onValueChange={setHighlightedKey}
      className="relative overflow-visible bg-transparent"
    >
      <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border bg-background px-2 py-1 focus-within:ring-2 focus-within:ring-ring/50">
        {filter.tokens.map((token) => {
          const fieldLabel = auditFilterFieldOf(token.field)?.label ?? ""
          return (
            <Badge
              key={`${token.field}:${token.value}`}
              variant="secondary"
              className="gap-1 font-normal"
            >
              <span className="text-muted-foreground">{fieldLabel}:</span>
              <span className="max-w-48 truncate">{token.label}</span>
              <button
                type="button"
                aria-label={`${fieldLabel}「${token.label}」を外す`}
                className="rounded-sm opacity-60 hover:opacity-100"
                onClick={() => removeToken(token)}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          )
        })}
        <input
          aria-label="絞り込み・内容で検索"
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          onKeyDown={handleKeyDown}
          placeholder={
            filter.tokens.length === 0
              ? "内容で検索（student: で生徒、scope: で試験などに絞り込み）"
              : ""
          }
          className="min-w-40 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {showList && (
        <CommandList
          // 一覧を押してもフォーカスを入力欄に残す（onBlur で閉じないように）
          onMouseDown={(e) => e.preventDefault()}
          className="absolute top-full right-0 left-0 z-50 mt-1 rounded-md border bg-popover shadow-md"
        >
          <CommandEmpty>
            {activeField
              ? activeField.key === "since" || activeField.key === "until"
                ? "日付を YYYY-MM-DD の形で打ってください"
                : "該当する候補がありません"
              : "該当する欄がありません"}
          </CommandEmpty>
          {suggestions.map((suggestion) => (
            <CommandItem
              key={suggestion.key}
              value={suggestion.key}
              onSelect={() => selectSuggestion(suggestion)}
            >
              {suggestion.kind === "field" ? (
                <>
                  <span className="font-mono text-xs">
                    {suggestion.keyword}:
                  </span>
                  <span>{suggestion.label}</span>
                </>
              ) : (
                <>
                  <span className="truncate">{suggestion.candidate.label}</span>
                  {suggestion.candidate.description && (
                    <span className="ml-auto truncate text-xs text-muted-foreground">
                      {suggestion.candidate.description}
                    </span>
                  )}
                </>
              )}
            </CommandItem>
          ))}
        </CommandList>
      )}
    </Command>
  )
}
