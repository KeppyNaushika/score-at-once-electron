"use client"

import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import {
  DEFAULT_LETTER_SCALES,
  draftsToLetterScales,
  type LetterScaleDraft,
  LetterScaleEditor,
} from "@/components/common/letter-scale-editor/LetterScaleEditor"
import { Badge } from "@/components/ui/badge"
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
  CourseworkItemWithDetails,
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

function toDraft(item: CourseworkItemWithDetails): ItemDraft {
  return {
    name: item.name,
    maxScore: String(item.maxScore),
    inputMode: item.inputMode,
    letterScales:
      item.letterScales.length > 0
        ? item.letterScales
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((ls) => ({ label: ls.label, score: String(ls.score) }))
        : DEFAULT_LETTER_SCALES,
  }
}

/**
 * 試験外成績資料の評価項目管理コンテナ
 *
 * 評価項目の追加・編集（満点・数値/文字モード・文字評価変換表）・並べ替え・削除を行う。
 * 成績算出から参照中の項目は削除をブロックし、参照元をトーストで通知する。
 */
export function CourseworkItemsContainer({
  courseworkId,
}: CourseworkItemsContainerProps) {
  const [items, setItems] = useState<CourseworkItemWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  const [newItemName, setNewItemName] = useState("")
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ItemDraft | null>(null)

  const loadItems = useCallback(async () => {
    try {
      const result = await window.electronAPI.coursework.getById(courseworkId)
      if (result.success && result.coursework) {
        setItems(
          result.coursework.items.slice().sort((a, b) => a.order - b.order)
        )
      }
    } catch (error) {
      console.error("Error loading coursework items:", error)
    } finally {
      setLoading(false)
    }
  }, [courseworkId])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const handleAddItem = async () => {
    if (!newItemName.trim()) return
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

  const handleStartEdit = (item: CourseworkItemWithDetails) => {
    setEditingItemId(item.id)
    setDraft(toDraft(item))
  }

  const handleCancelEdit = () => {
    setEditingItemId(null)
    setDraft(null)
  }

  const handleSaveEdit = async () => {
    if (!editingItemId || !draft) return
    if (!draft.name.trim()) return
    const maxScore = Number(draft.maxScore)
    if (isNaN(maxScore) || maxScore <= 0) {
      toast.error("満点は正の数で入力してください")
      return
    }
    const letterScales = draftsToLetterScales(draft.letterScales)
    if (draft.inputMode === "letter" && letterScales.length === 0) {
      toast.error("文字評価モードでは変換表を1件以上設定してください")
      return
    }
    const result = await window.electronAPI.coursework.updateItem(
      editingItemId,
      {
        name: draft.name.trim(),
        maxScore,
        inputMode: draft.inputMode,
        letterScales,
      }
    )
    if (result.success) {
      handleCancelEdit()
      await loadItems()
    } else {
      toast.error("保存に失敗しました", { description: result.error })
    }
  }

  const handleDelete = async (item: CourseworkItemWithDetails) => {
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

  const handleMove = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const reordered = items.slice()
    const [moved] = reordered.splice(index, 1)
    reordered.splice(target, 0, moved)
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
        <p className="text-muted-foreground mt-1 text-sm">
          点数を入力する評価項目を作成してください。満点・入力方式（数値／文字評価）を設定できます。
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

      {/* 評価項目リスト */}
      {items.length === 0 ? (
        <div className="text-muted-foreground py-8 text-center text-sm">
          評価項目がありません。上のフォームから追加してください。
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => {
            const isEditing = editingItemId === item.id && draft

            return (
              <div key={item.id} className="rounded-lg border p-4">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">項目名</Label>
                        <Input
                          value={draft.name}
                          onChange={(e) =>
                            setDraft({ ...draft, name: e.target.value })
                          }
                          className="h-8 w-48"
                          autoFocus
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">満点</Label>
                        <Input
                          value={draft.maxScore}
                          onChange={(e) =>
                            setDraft({ ...draft, maxScore: e.target.value })
                          }
                          type="number"
                          className="h-8 w-24"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">入力方式</Label>
                        <Select
                          value={draft.inputMode}
                          onValueChange={(v) =>
                            setDraft({ ...draft, inputMode: v as InputMode })
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
                        onChange={(scales) =>
                          setDraft({ ...draft, letterScales: scales })
                        }
                      />
                    )}

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelEdit}
                      >
                        <X className="mr-1 h-4 w-4" />
                        取消
                      </Button>
                      <Button size="sm" onClick={handleSaveEdit}>
                        <Save className="mr-1 h-4 w-4" />
                        保存
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-6"
                          disabled={index === 0}
                          onClick={() => handleMove(index, -1)}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-6"
                          disabled={index === items.length - 1}
                          onClick={() => handleMove(index, 1)}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-blue-600">
                            {item.name}
                          </span>
                          {item.inputMode === "letter" ? (
                            <Badge variant="outline" className="text-xs">
                              文字評価
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              満点 {item.maxScore}
                            </Badge>
                          )}
                        </div>
                        {item.inputMode === "letter" &&
                          item.letterScales.length > 0 && (
                            <div className="text-muted-foreground mt-1 text-xs">
                              {item.letterScales
                                .slice()
                                .sort((a, b) => a.order - b.order)
                                .map((ls) => `${ls.label}=${ls.score}`)
                                .join(" / ")}
                            </div>
                          )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleStartEdit(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive h-7 w-7"
                        onClick={() => handleDelete(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
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
