"use client"

import { Tag } from "lucide-react"
import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface BulkTagAssignButtonProps {
  /** 選択中の件数（0 のときは呼び出し側で非表示にする想定） */
  selectedCount: number
  /** 既存タグの候補一覧 */
  allTags: { id: string; name: string }[]
  /** タグ名を受け取り、選択中アイテムへ付与する（新規作成含む） */
  onAssign: (tagName: string) => Promise<void>
}

/**
 * 選択中アイテムへタグを一括付与するボタン＋Popover。
 * タグ名の直接入力（Enter で新規作成込み）と既存タグからの選択に対応する。
 */
export function BulkTagAssignButton({
  selectedCount,
  allTags,
  onAssign,
}: BulkTagAssignButtonProps) {
  const [open, setOpen] = useState(false)
  const [tagInput, setTagInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const handleAssign = async (tagName: string) => {
    if (!tagName.trim()) return
    await onAssign(tagName.trim())
    setTagInput("")
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="rounded-lg">
          <Tag className="mr-2 h-4 w-4" />
          タグを一括追加
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            選択中の{selectedCount}件にタグを追加
          </p>
          <Input
            ref={inputRef}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void handleAssign(tagInput)
              }
            }}
            placeholder="タグ名を入力してEnter"
            className="h-8 text-sm"
            autoFocus
          />
          {allTags.length > 0 && (
            <div className="max-h-28 overflow-y-auto">
              {allTags
                .filter(
                  (tag) =>
                    !tagInput.trim() ||
                    tag.name
                      .toLowerCase()
                      .includes(tagInput.trim().toLowerCase())
                )
                .map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm"
                    onClick={() => void handleAssign(tag.name)}
                  >
                    <Tag className="h-3 w-3 opacity-50" />
                    {tag.name}
                  </button>
                ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
