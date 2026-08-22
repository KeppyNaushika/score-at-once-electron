"use client"

import { Tag } from "lucide-react"
import type { RefObject } from "react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useDialogAutoFocus } from "@/hooks/useDialogAutoFocus"

interface BulkTagAssignPanelProps {
  /** 選択中の件数（0 のときは呼び出し側で非表示にする想定） */
  selectedCount: number
  /** 既存タグの候補一覧 */
  allTags: { id: string; name: string }[]
  /** タグ名を受け取り、選択中アイテムへ付与する（新規作成含む） */
  onAssign: (tagName: string) => Promise<void>
}

/**
 * 選択中アイテムへタグを一括付与する中身（入力欄と既存タグの一覧）。
 *
 * ボタン（popover）と別に中身だけを出せるのは、ヘッダーの並びが溢れたとき
 * `OverflowToolbar` の「…」の中へそのまま置くため（popover の入れ子を作らない）。
 */
export function BulkTagAssignPanel({
  selectedCount,
  allTags,
  onAssign,
  inputRef,
  onAssigned,
}: BulkTagAssignPanelProps & {
  /**
   * 入力欄への参照。popover で開くときは開いた側が `useDialogAutoFocus` の ref を
   * 渡す（フォーカスの当て直しは開閉を知っている側にしか書けない）
   */
  inputRef?: RefObject<HTMLInputElement | null>
  /** 付与し終えたことを外へ伝える（ボタンの姿は popover を閉じる） */
  onAssigned?: () => void
}) {
  const [tagInput, setTagInput] = useState("")
  const [isAssigning, setIsAssigning] = useState(false)

  const handleAssign = async (tagName: string) => {
    // onAssign は選択中の全件へ付与するため、Enter 連打や連続クリックで
    // 二重に走らせると付与が二巡し、選択解除後の空振りと重複エラーになる。
    if (!tagName.trim() || isAssigning) return
    setIsAssigning(true)
    try {
      await onAssign(tagName.trim())
    } finally {
      setIsAssigning(false)
    }
    setTagInput("")
    onAssigned?.()
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        選択中の{selectedCount}件にタグを追加
      </p>
      <Input
        ref={inputRef}
        value={tagInput}
        onChange={(event) => setTagInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault()
            void handleAssign(tagInput)
          }
        }}
        placeholder="タグ名を入力してEnter"
        aria-label="追加するタグ名"
        className="h-8 text-sm"
      />
      {allTags.length > 0 && (
        <div className="max-h-28 overflow-y-auto">
          {allTags
            .filter(
              (tag) =>
                !tagInput.trim() ||
                tag.name.toLowerCase().includes(tagInput.trim().toLowerCase())
            )
            .map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent"
                onClick={() => void handleAssign(tag.name)}
              >
                <Tag className="h-3 w-3 opacity-50" />
                {tag.name}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

/**
 * 選択中アイテムへタグを一括付与するボタン＋Popover。
 * タグ名の直接入力（Enter で新規作成込み）と既存タグからの選択に対応する。
 */
export function BulkTagAssignButton(props: BulkTagAssignPanelProps) {
  const [open, setOpen] = useState(false)
  const { inputRef, onOpenAutoFocus } = useDialogAutoFocus(open)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-lg">
          <Tag className="mr-2 h-4 w-4" />
          タグを一括追加
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3"
        align="start"
        onOpenAutoFocus={onOpenAutoFocus}
      >
        <BulkTagAssignPanel
          {...props}
          inputRef={inputRef}
          onAssigned={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}
