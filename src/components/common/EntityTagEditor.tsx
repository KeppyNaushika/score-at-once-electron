"use client"

import type { Tag } from "@prisma/client"
import { useMutation, useQuery } from "@tanstack/react-query"
import { PencilIcon, TagIcon, XIcon } from "lucide-react"
import type React from "react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { findOrCreateTagMutation, tagListQuery } from "@/queries/tag"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_TAGS: Tag[] = []

interface EntityTagEditorProps {
  /**
   * いま付いているタグ。**結合行の `tag` をそのまま渡す**
   * （`examTag.tag` / `courseworkTag.tag` / `gradeTag.tag` / `definitionTag.tag`）。
   */
  tags: Tag[]
  /**
   * いま `tags` を取り直している最中か（取得の `isFetching` をそのまま）。
   *
   * **書き込みの後は必ず true になる。** 取り直しは待たれない（`invalidateQueries`
   * は `void`）ので、`onReplace` が解決した時点の `tags` はまだ1往復ぶん古い。
   */
  isReloading: boolean
  /**
   * 付け替える。渡すのは**置き換え後のタグ id ひとそろい**で、4実体とも
   * `setTags(entityId, tagIds)` という同じ形の書き込みを持っている。
   */
  onReplace: (tagIds: string[]) => Promise<void>
  /** 触れないとき（解答用紙で担当でない、など） */
  disabled?: boolean
  /** 触れない理由。`disabled` のときだけ出す */
  disabledReason?: string
  /** 置かれる側が左端を揃えるために渡す */
  className?: string
}

/**
 * 概要ページのタグ欄。
 *
 * **下書きを持たない。** 押した瞬間に書き、表示は取り直した結果に従う
 * （このリポジトリの決めた形＝直で書いて読み直す。楽観更新はしない）。
 * タグには「打っている途中」が無い ——「追加」を押すか候補を選ぶかの1回で
 * 意図が確定する —— ので、名前・日付・説明のように離したときに書く必要がない。
 *
 * **タグそのものの一覧と作成はここが持つ。** どの実体に付けるかで変わらない
 * （`tagListQuery` / `findOrCreateTagMutation`）ので、4画面が同じものを
 * 引き回さずに済む。呼び手が渡すのは「いま付いているタグ」と「付け替え方」だけ。
 */
export function EntityTagEditor({
  tags,
  isReloading,
  onReplace,
  disabled = false,
  disabledReason,
  className,
}: EntityTagEditorProps) {
  const { data: allTags = EMPTY_TAGS } = useQuery(tagListQuery())
  const findOrCreateTag = useMutation(findOrCreateTagMutation())
  const [tagInput, setTagInput] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  /** 書き込みが飛んでいる間か */
  const [isSending, setIsSending] = useState(false)

  /**
   * まだ押させないか。
   *
   * 付け替えは**いま付いているタグを読んで組み立てる**（`setTags` は置き換え）ので、
   * 読んだ側が古いまま次を押されると、付けた／外したが消える。したがって塞ぐのは
   * 書き込みが飛んでいる間**だけでは足りない** —— `mutateAsync` は取り直しを
   * 待たずに解決するので、そこで解くと `tags` は1往復ぶん古い。続けて2つ付けると
   * 2つ目が `[…1往復前のタグ, 2つ目]` になり、1つ目が消えていた。
   *
   * 同じ古い `tags` から候補一覧と重複判定も作っているので、着地まで塞ぐことで
   * 「付けたばかりのタグが候補に残り、押すと id が重複する」も止まる。
   */
  const isBlocked = isSending || isReloading

  const handleAdd = async (tagName?: string) => {
    const name = (tagName ?? tagInput).trim()
    // 塞がっている間は受け取らない。**打った文字は消さない**（消すと、付かないまま
    // 消えたように見える）
    if (!name || isBlocked) return
    if (tags.some((tag) => tag.name === name)) return
    // 足す分は受け取ったので入力を空にする。続けて足せるよう、popover は開いたまま
    // にする（1つ付けるたびに開き直させない）
    setTagInput("")
    setIsSending(true)
    try {
      const added = await findOrCreateTag.mutateAsync(name)
      await onReplace([...tags.map((tag) => tag.id), added.id])
    } catch {
      // 失敗の通知は MutationCache が出す
    } finally {
      setIsSending(false)
    }
  }

  const handleRemove = async (tagId: string) => {
    if (isBlocked) return
    setIsSending(true)
    try {
      await onReplace(
        tags.filter((tag) => tag.id !== tagId).map((tag) => tag.id)
      )
    } catch {
      // 失敗の通知は MutationCache が出す
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void handleAdd()
    }
    if (e.key === "Escape") {
      e.preventDefault()
      setTagInput("")
      setIsOpen(false)
    }
  }

  const suggestions = allTags.filter(
    (tag) =>
      !tags.some((attached) => attached.id === tag.id) &&
      (tagInput.trim() === "" ||
        tag.name.toLowerCase().includes(tagInput.trim().toLowerCase()))
  )

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {tags.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className="text-xs font-normal"
          style={
            tag.color ? { borderColor: tag.color, color: tag.color } : undefined
          }
        >
          {tag.name}
          {!disabled && (
            <button
              type="button"
              onClick={() => void handleRemove(tag.id)}
              disabled={isBlocked}
              className="ml-1.5 cursor-pointer appearance-none border-none bg-transparent p-0 hover:text-destructive"
              aria-label={`${tag.name} を外す`}
            >
              <XIcon size={14} />
            </button>
          )}
        </Badge>
      ))}
      {tags.length === 0 && (
        <span className="text-xs text-muted-foreground">タグなし</span>
      )}

      {disabled
        ? disabledReason && (
            <p className="text-xs text-muted-foreground">{disabledReason}</p>
          )
        : null}

      {/*
        付けるための入力は**畳んでおく。** 概要を開く用のほとんどはタグを読むだけ
        なので、入力欄と候補の一覧が常に出ていると、読むだけの人にも編集の画面を
        見せることになる。鉛筆を押した人にだけ開く。
      */}
      {!disabled && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              id="entity-overview-tag"
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label="タグを編集"
              title="タグを編集"
            >
              <PencilIcon className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 space-y-2 p-2">
            <div className="flex items-center gap-2">
              <Input
                value={tagInput}
                autoFocus
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="タグを追加..."
                className="h-8 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBlocked}
                onClick={() => void handleAdd()}
              >
                追加
              </Button>
            </div>
            {suggestions.length > 0 && (
              <div className="max-h-40 overflow-y-auto">
                {suggestions.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                    disabled={isBlocked}
                    onClick={() => void handleAdd(tag.name)}
                  >
                    <TagIcon className="h-3.5 w-3.5 opacity-50" />
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
