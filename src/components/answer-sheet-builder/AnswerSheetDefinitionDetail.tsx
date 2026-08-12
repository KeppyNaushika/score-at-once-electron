"use client"

import { useQuery } from "@tanstack/react-query"
import { ArrowRight, Download, Pencil, TagIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import React, { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTags } from "@/hooks/useTags"
import { queryKeys } from "@/lib/queryKeys"

import { countAsbQuestions } from "./answerSheetStats"

interface AnswerSheetDefinitionDetailProps {
  definitionId: string
}

const ORIENTATION_LABELS: Record<string, string> = {
  portrait: "縦",
  landscape: "横",
}

/**
 * 解答用紙定義の概要ページ。
 * メタ情報の表示・個別タグ設定・作成/書き出しへの導線を提供する。
 */
export function AnswerSheetDefinitionDetail({
  definitionId,
}: AnswerSheetDefinitionDetailProps) {
  const router = useRouter()
  const [tagNames, setTagNames] = useState<string[]>([])
  const [currentTagInput, setCurrentTagInput] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const { tags: allTags, refresh: refreshTags } = useTags()

  const {
    data: definition = null,
    isPending,
    error: loadError,
  } = useQuery({
    queryKey: queryKeys.answerSheetDefinition.detail(definitionId),
    queryFn: () =>
      window.electronAPI.answerSheetBuilder.loadDefinition(definitionId),
  })
  const { data: definitionTags } = useQuery({
    queryKey: queryKeys.answerSheetDefinition.tags(definitionId),
    queryFn: () =>
      window.electronAPI.asbDefinitionTagGetByDefinitionId(definitionId),
  })

  // 読み込みの失敗は通知する（取得ではないので effect でよい）
  useEffect(() => {
    if (loadError) toast.error(loadError.message)
  }, [loadError])

  // 取得したタグ名を編集状態の種にする（以後は利用者の編集が正）
  const [seededDefinitionId, setSeededDefinitionId] = useState<string | null>(
    null
  )
  if (definitionTags && seededDefinitionId !== definitionId) {
    setSeededDefinitionId(definitionId)
    setTagNames(definitionTags.map((definitionTag) => definitionTag.tag.name))
  }

  // タグ変更を即時保存する
  const persistTags = useCallback(
    async (nextTagNames: string[]) => {
      try {
        const tagIds: string[] = []
        for (const name of nextTagNames) {
          const tag = await window.electronAPI.tagFindOrCreate(name)
          tagIds.push(tag.id)
        }
        await window.electronAPI.asbDefinitionTagSetDefinitionTags(
          definitionId,
          tagIds
        )
        await refreshTags()
      } catch (error) {
        console.error("Failed to save tags:", error)
        toast.error("タグの保存に失敗しました")
      }
    },
    [definitionId, refreshTags]
  )

  const handleAddTag = useCallback(
    (tagName?: string) => {
      const name = (tagName ?? currentTagInput).trim()
      setCurrentTagInput("")
      setShowSuggestions(false)
      if (!name || tagNames.includes(name)) return
      const next = [...tagNames, name]
      setTagNames(next)
      void persistTags(next)
    },
    [currentTagInput, tagNames, persistTags]
  )

  const handleRemoveTag = (tagToRemove: string) => {
    const next = tagNames.filter((tagName) => tagName !== tagToRemove)
    setTagNames(next)
    void persistTags(next)
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleAddTag()
    }
  }

  const suggestions = allTags.filter(
    (tag) =>
      !tagNames.includes(tag.name) &&
      (currentTagInput.trim() === "" ||
        tag.name.toLowerCase().includes(currentTagInput.trim().toLowerCase()))
  )

  if (isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (!definition) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          定義が見つかりませんでした
        </p>
      </div>
    )
  }

  const { questionCount, totalPoints } = countAsbQuestions(
    definition.majorQuestions
  )
  const base = `/answer-sheet-builder/${definitionId}`

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{definition.name}</h1>
          <p className="text-sm text-muted-foreground">解答用紙の概要</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => router.push(`${base}/01-edit`)}>
            <Pencil className="mr-1 h-4 w-4" />
            作成
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`${base}/02-export`)}
          >
            <Download className="mr-1 h-4 w-4" />
            書き出し
          </Button>
        </div>
      </div>

      {/* メタ情報 */}
      <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm">
        <div>
          <dt className="text-muted-foreground">用紙サイズ</dt>
          <dd className="font-medium">{definition.settings.paperSize}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">向き</dt>
          <dd className="font-medium">
            {ORIENTATION_LABELS[definition.settings.orientation] ??
              definition.settings.orientation}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">設問数</dt>
          <dd className="font-medium">{questionCount}問</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">合計配点</dt>
          <dd className="font-medium">{totalPoints}点</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">レンダーモード</dt>
          <dd className="font-medium">{definition.renderMode}</dd>
        </div>
        {definition.updatedAt && (
          <div>
            <dt className="text-muted-foreground">更新日時</dt>
            <dd className="font-medium">
              {new Date(definition.updatedAt).toLocaleString("ja-JP")}
            </dd>
          </div>
        )}
      </dl>

      {/* タグ設定 */}
      <div className="space-y-2 rounded-lg border p-4">
        <Label className="text-sm font-medium">タグ</Label>
        <div className="relative">
          <div className="flex gap-2">
            <Input
              value={currentTagInput}
              onChange={(e) => {
                setCurrentTagInput(e.target.value)
                setShowSuggestions(true)
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onKeyDown={handleTagInputKeyDown}
              placeholder="タグを追加..."
              className="text-sm"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => handleAddTag()}
            >
              追加
            </Button>
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
              {suggestions.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleAddTag(tag.name)
                  }}
                >
                  <TagIcon className="h-3.5 w-3.5" />
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {tagNames.length === 0 && (
            <span className="text-xs text-muted-foreground">
              タグはありません
            </span>
          )}
          {tagNames.map((name) => (
            <Badge key={name} variant="secondary">
              {name}
              <button
                type="button"
                onClick={() => handleRemoveTag(name)}
                className="ml-1.5 cursor-pointer"
                aria-label={`${name} を削除`}
              >
                <XIcon size={14} />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`${base}/01-edit`)}
        >
          作成へ進む
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
