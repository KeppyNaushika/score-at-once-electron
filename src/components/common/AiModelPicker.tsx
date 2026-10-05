"use client"

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"
import { type KeyboardEvent, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { ProviderModelCatalog } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"
import { cn } from "@/lib/utils"

import type { ComboboxOption } from "./Combobox"
import { filterByKeywords, useSearchableOptions } from "./comboboxSearch"

/**
 * モデルの一覧をまだ取得していないときに並べる、組み込みの選択肢（設計 §3-3）。
 * 無い事業者（OpenAI）は自由入力にする。先頭が推奨
 */
const BUILT_IN_MODEL_IDS: Partial<Record<GradingProviderId, string[]>> = {
  anthropic: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-4-5"],
}

/** 打った id をそのまま使う選択肢の value（モデルの id と重ならない接頭辞） */
const CUSTOM_MODEL_ITEM_PREFIX = "custom-model:"

/**
 * 選択肢を組む。取得した一覧があればそれを、無ければ組み込みの一覧を並べる。
 * 今の値が一覧に無ければ先頭に足す（選んでいる値が見えなくならないように）
 */
function buildModelOptions(
  provider: GradingProviderId,
  catalog: ProviderModelCatalog | null,
  value: string
): ComboboxOption[] {
  const listedOptions: ComboboxOption[] = catalog
    ? catalog.models.map((modelInfo) => ({
        value: modelInfo.id,
        label:
          modelInfo.displayName === modelInfo.id
            ? modelInfo.id
            : `${modelInfo.displayName}（${modelInfo.id}）`,
        keywords: [modelInfo.id, modelInfo.displayName],
      }))
    : (BUILT_IN_MODEL_IDS[provider] ?? []).map((modelId) => ({
        value: modelId,
        label: modelId,
        keywords: [modelId],
      }))
  if (
    value === "" ||
    listedOptions.some((modelOption) => modelOption.value === value)
  ) {
    return listedOptions
  }
  return [{ value, label: value, keywords: [value] }, ...listedOptions]
}

interface AiModelPickerProps {
  provider: GradingProviderId
  /** 取得しておいたその事業者のモデルの一覧。まだ取得していなければ null */
  catalog: ProviderModelCatalog | null
  value: string
  /** 選んだ・打ち終えたモデルの id（前後の空白は除いてある。空なら呼ばない） */
  onValueChange: (model: string) => void
  id?: string
  className?: string
}

/**
 * AI 採点のモデルを選ぶ部品（「AI採点」の画面の既定値・単価の行の追加と、07 の実行のダイアログが使う）。
 *
 * - 取得した一覧（または組み込みの一覧）から、名前か id を打って絞り込んで選ぶ
 * - 一覧に無い id も、打って「〜を使う」で選べる（新しいモデル・別名を使うため）
 * - 一覧も組み込みの一覧も無い事業者（一覧を取得していない OpenAI）は自由入力で、
 *   入力欄を離れたとき・Enter で確定する
 */
export function AiModelPicker({
  provider,
  catalog,
  value,
  onValueChange,
  id,
  className,
}: AiModelPickerProps) {
  const hasOptions =
    catalog !== null || BUILT_IN_MODEL_IDS[provider] !== undefined
  if (!hasOptions) {
    return (
      <AiModelTextInput
        // 値が外で変わったら入力欄を作り直す（他の画面での変更に追いつく）
        key={value}
        id={id}
        value={value}
        onValueChange={onValueChange}
        className={className}
      />
    )
  }
  return (
    <AiModelCombobox
      options={buildModelOptions(provider, catalog, value)}
      value={value}
      onValueChange={onValueChange}
      id={id}
      className={className}
    />
  )
}

interface AiModelTextInputProps {
  id?: string
  value: string
  onValueChange: (model: string) => void
  className?: string
}

/** 自由入力のモデルの欄。離れたとき・Enter で確定する */
function AiModelTextInput({
  id,
  value,
  onValueChange,
  className,
}: AiModelTextInputProps) {
  const commit = (input: HTMLInputElement) => {
    const trimmedModel = input.value.trim()
    if (trimmedModel === "") {
      input.value = value
      return
    }
    if (trimmedModel !== value) onValueChange(trimmedModel)
  }
  return (
    <Input
      id={id}
      defaultValue={value}
      placeholder="モデルの id"
      onBlur={(event) => commit(event.target)}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") event.currentTarget.blur()
      }}
      className={cn("font-mono", className)}
    />
  )
}

interface AiModelComboboxProps {
  options: ComboboxOption[]
  value: string
  onValueChange: (model: string) => void
  id?: string
  className?: string
}

/**
 * 一覧から選ぶか、打った id をそのまま使う Combobox。
 * 共通の `Combobox` は一覧の外の値を選ばせないので、同じ作り（Popover + cmdk・同じ絞り込み）で
 * 「打った id を使う」行だけを足したもの
 */
function AiModelCombobox({
  options,
  value,
  onValueChange,
  id,
  className,
}: AiModelComboboxProps) {
  const [open, setOpen] = useState(false)
  const [searchText, setSearchText] = useState("")
  const searchableOptions = useSearchableOptions(options)
  const typedModelId = searchText.trim()
  const canUseTypedModelId =
    typedModelId !== "" &&
    !options.some((modelOption) => modelOption.value === typedModelId)

  const selectModel = (model: string) => {
    if (model !== value) onValueChange(model)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setSearchText("")
      }}
      modal
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between font-mono font-normal", className)}
        >
          <span
            className={cn("truncate", value === "" && "text-muted-foreground")}
          >
            {value === "" ? "モデルを選ぶ" : value}
          </span>
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 min-w-(--radix-popover-trigger-width) p-0"
        align="start"
        onEscapeKeyDown={(event) => {
          // 変換を取り消す Esc で一覧まで閉じない
          if (event.isComposing) event.preventDefault()
        }}
      >
        <Command filter={filterByKeywords} defaultValue={value}>
          <CommandInput
            placeholder="名前か id で絞り込む・id を打つ"
            value={searchText}
            onValueChange={setSearchText}
          />
          <CommandList>
            {canUseTypedModelId && (
              <CommandItem
                forceMount
                value={`${CUSTOM_MODEL_ITEM_PREFIX}${typedModelId}`}
                onSelect={() => selectModel(typedModelId)}
              >
                <span className="truncate">
                  「<span className="font-mono">{typedModelId}</span>」を使う
                </span>
              </CommandItem>
            )}
            {searchableOptions.map(({ option, searchKeywords }) => (
              <CommandItem
                key={option.value}
                value={option.value}
                keywords={searchKeywords}
                onSelect={() => selectModel(option.value)}
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
