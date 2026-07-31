"use client"

import type { DragEndEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import {
  createDefaultLetterScales,
  draftsToLetterScales,
  type LetterScaleDraft,
  LetterScaleEditor,
} from "@/components/common/letter-scale-editor/LetterScaleEditor"
import {
  DragHandle,
  SortableTableProvider,
  useSortableRow,
} from "@/components/common/sortable-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  CourseworkItemWithLetterScales,
  InputMode,
} from "@/types/coursework.types"

interface CourseworkItemsContainerProps {
  courseworkId: string
}

interface ItemDraft {
  name: string
  maxScore: string
  inputMode: InputMode
  letterScales: LetterScaleDraft[]
}

function toDraft(item: CourseworkItemWithLetterScales): ItemDraft {
  return {
    name: item.name,
    maxScore: String(item.maxScore),
    inputMode: item.inputMode,
    letterScales:
      item.letterScales.length > 0
        ? item.letterScales
            .slice()
            .sort(
              (letterScaleA, letterScaleB) =>
                letterScaleA.order - letterScaleB.order
            )
            .map((letterScale) => ({
              // 既存行は DB の安定 id をそのまま UI の key に使う
              id: letterScale.id,
              label: letterScale.label,
              score: String(letterScale.score),
            }))
        : createDefaultLetterScales(),
  }
}

/** ドラフトが保存可能（=有効）かを判定する */
function isDraftValid(draft: ItemDraft): boolean {
  if (!draft.name.trim()) return false
  const maxScore = Number(draft.maxScore)
  if (isNaN(maxScore) || maxScore <= 0) return false
  if (
    draft.inputMode === "letter" &&
    draftsToLetterScales(draft.letterScales).length === 0
  ) {
    return false
  }
  return true
}

interface SortableItemRowProps {
  item: CourseworkItemWithLetterScales
  draft: ItemDraft
  onUpdate: (itemId: string, patch: Partial<ItemDraft>) => void
  onDelete: (item: CourseworkItemWithLetterScales) => void
}

/** ドラッグ&ドロップで並べ替え可能な、常時インライン編集の評価項目1行 */
function SortableItemRow({
  item,
  draft,
  onUpdate,
  onDelete,
}: SortableItemRowProps) {
  const { setNodeRef, style, dragHandleProps } = useSortableRow(item.id)
  const maxScoreNum = Number(draft.maxScore)
  const maxScoreInvalid =
    draft.maxScore.trim() === "" || isNaN(maxScoreNum) || maxScoreNum <= 0

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <DragHandle dragHandleProps={dragHandleProps} className="mt-5" />

        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">項目名</Label>
              <Input
                value={draft.name}
                onChange={(e) => onUpdate(item.id, { name: e.target.value })}
                className="h-8 w-48"
                placeholder="項目名"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">満点</Label>
              <Input
                value={draft.maxScore}
                onChange={(e) =>
                  onUpdate(item.id, { maxScore: e.target.value })
                }
                type="number"
                step="any"
                className={`h-8 w-24 ${
                  maxScoreInvalid ? "border-red-400 bg-red-50 text-red-700" : ""
                }`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">入力方式</Label>
              <Select
                value={draft.inputMode}
                onValueChange={(value) =>
                  onUpdate(item.id, { inputMode: value as InputMode })
                }
              >
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="numeric">数値</SelectItem>
                  <SelectItem value="letter">文字評価</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {draft.inputMode === "letter" && (
            <LetterScaleEditor
              scales={draft.letterScales}
              onChange={(scales) => onUpdate(item.id, { letterScales: scales })}
            />
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="mt-5 h-7 w-7 text-destructive"
          onClick={() => onDelete(item)}
          title="削除"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

/**
 * 試験外成績資料の評価項目管理コンテナ
 *
 * 評価項目の追加・編集（満点・数値/文字モード・文字評価変換表）・並べ替え・削除を行う。
 * 各項目は常時インライン編集で、変更はデバウンスで自動保存される。
 * 並べ替えはドラッグ&ドロップ。
 * 成績算出から参照中の項目は削除をブロックし、参照元をトーストで通知する。
 */
export function CourseworkItemsContainer({
  courseworkId,
}: CourseworkItemsContainerProps) {
  const [items, setItems] = useState<CourseworkItemWithLetterScales[]>([])
  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>({})
  const [loading, setLoading] = useState(true)
  const [newItemName, setNewItemName] = useState("")

  // 自動保存用：最新ドラフトの参照と項目ごとのデバウンスタイマー
  const draftsRef = useRef<Record<string, ItemDraft>>({})
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  )

  const setDraftsSynced = useCallback((next: Record<string, ItemDraft>) => {
    draftsRef.current = next
    setDrafts(next)
  }, [])

  const loadItems = useCallback(async () => {
    try {
      const result = await window.electronAPI.coursework.getById(courseworkId)
      if (result.success && result.coursework) {
        const sorted = result.coursework.items
          .slice()
          .sort((itemA, itemB) => itemA.order - itemB.order)
        setItems(sorted)
        setDraftsSynced(
          Object.fromEntries(sorted.map((item) => [item.id, toDraft(item)]))
        )
      }
    } catch (error) {
      console.error("Error loading coursework items:", error)
    } finally {
      setLoading(false)
    }
  }, [courseworkId, setDraftsSynced])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  /** 指定項目の最新ドラフトをDBへ保存する（無効なドラフトはスキップ） */
  const saveItem = useCallback(async (itemId: string) => {
    const draft = draftsRef.current[itemId]
    if (!draft || !isDraftValid(draft)) return
    const result = await window.electronAPI.coursework.updateItem(itemId, {
      name: draft.name.trim(),
      maxScore: Number(draft.maxScore),
      inputMode: draft.inputMode,
      letterScales: draftsToLetterScales(draft.letterScales),
    })
    if (!result.success) {
      toast.error("保存に失敗しました", { description: result.error })
    }
  }, [])

  /** 保留中の全保存を即座に実行する（並べ替え/追加/削除/離脱前のフラッシュ） */
  const flushAll = useCallback(async () => {
    const ids = Array.from(saveTimers.current.keys())
    for (const id of ids) {
      const timer = saveTimers.current.get(id)
      if (timer) clearTimeout(timer)
      saveTimers.current.delete(id)
      await saveItem(id)
    }
  }, [saveItem])

  // アンマウント時に未保存分をフラッシュ
  useEffect(() => {
    const timers = saveTimers.current
    return () => {
      for (const [id, timer] of timers) {
        clearTimeout(timer)
        void saveItem(id)
      }
      timers.clear()
    }
  }, [saveItem])

  /** ドラフトを部分更新し、その項目の保存をデバウンス予約する */
  const updateDraft = useCallback(
    (itemId: string, patch: Partial<ItemDraft>) => {
      const current = draftsRef.current[itemId]
      if (!current) return
      setDraftsSynced({
        ...draftsRef.current,
        [itemId]: { ...current, ...patch },
      })

      const existing = saveTimers.current.get(itemId)
      if (existing) clearTimeout(existing)
      saveTimers.current.set(
        itemId,
        setTimeout(() => {
          saveTimers.current.delete(itemId)
          void saveItem(itemId)
        }, 500)
      )
    },
    [saveItem, setDraftsSynced]
  )

  const handleAddItem = async () => {
    if (!newItemName.trim()) return
    await flushAll()
    const result = await window.electronAPI.coursework.createItem({
      courseworkId,
      name: newItemName.trim(),
      maxScore: 100,
      inputMode: "numeric",
    })
    if (result.success) {
      setNewItemName("")
      await loadItems()
    } else {
      toast.error("評価項目の追加に失敗しました", { description: result.error })
    }
  }

  const handleDelete = async (item: CourseworkItemWithLetterScales) => {
    await flushAll()
    const result = await window.electronAPI.coursework.deleteItem(item.id)
    if (result.success) {
      await loadItems()
      toast.success("評価項目を削除しました", { description: item.name })
    } else if (result.usedBy && result.usedBy.length > 0) {
      toast.error("削除できません", {
        description: `次の成績算出で参照されています: ${result.usedBy.join("、")}`,
      })
    } else {
      toast.error("削除に失敗しました", { description: result.error })
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((item) => item.id === active.id)
    const newIndex = items.findIndex((item) => item.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(items, oldIndex, newIndex)
    setItems(reordered)
    const result = await window.electronAPI.coursework.reorderItems(
      reordered.map((item, i) => ({ id: item.id, order: i }))
    )
    if (!result.success) {
      toast.error("並べ替えに失敗しました", { description: result.error })
      await loadItems()
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">評価項目</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          点数を入力する評価項目を作成してください。満点・入力方式（数値／文字評価）を設定できます。変更は自動保存されます。
        </p>
      </div>

      {/* 評価項目追加 */}
      <div className="mb-6 flex items-center gap-2">
        <Input
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder="評価項目名（例: 提出物、小テスト）"
          className="max-w-xs"
          onKeyDown={(e) =>
            e.key === "Enter" && !e.nativeEvent.isComposing && handleAddItem()
          }
        />
        <Button
          variant="outline"
          onClick={handleAddItem}
          disabled={!newItemName.trim()}
        >
          <Plus className="mr-2 h-4 w-4" />
          評価項目追加
        </Button>
      </div>

      {/* 評価項目リスト（常時インライン編集・DnD並べ替え） */}
      {items.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          評価項目がありません。上のフォームから追加してください。
        </div>
      ) : (
        <div className="space-y-3">
          <SortableTableProvider
            items={items.map((item) => item.id)}
            onDragEnd={handleDragEnd}
          >
            {items.map((item) => {
              const draft = drafts[item.id]
              if (!draft) return null
              return (
                <SortableItemRow
                  key={item.id}
                  item={item}
                  draft={draft}
                  onUpdate={updateDraft}
                  onDelete={handleDelete}
                />
              )
            })}
          </SortableTableProvider>
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <Button asChild>
          <Link href={`/coursework/${courseworkId}/04-scores`}>
            次へ: 点数入力
          </Link>
        </Button>
      </div>
    </div>
  )
}
