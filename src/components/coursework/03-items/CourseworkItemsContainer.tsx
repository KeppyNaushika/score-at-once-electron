"use client"

import type { DragEndEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

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
import { cn } from "@/lib/utils"
import {
  courseworkDetailQuery,
  courseworkScoresQuery,
  createCourseworkItemMutation,
  createCourseworkLetterScaleMutation,
  deleteCourseworkItemMutation,
  reorderCourseworkItemsMutation,
  updateCourseworkItemMutation,
} from "@/queries/coursework"
import type {
  CourseworkItemWithLetterScales,
  CourseworkWithRelations,
  InputMode,
} from "@/types/coursework.types"
import { toInputMode } from "@/types/coursework.types"

import {
  collectUnknownLetterValues,
  type UnknownLetterValues,
} from "../courseworkLetterValues"
import { LetterScaleEditor } from "./LetterScaleEditor"

/** 文字評価へ切り替えたときに作る既定の変換表 */
const DEFAULT_LETTER_SCALES = [
  { label: "A", score: 100 },
  { label: "B", score: 80 },
  { label: "C", score: 60 },
]

interface CourseworkItemsContainerProps {
  courseworkId: string
}

/** 入力中の文字を引くための鍵（DB の鍵ではなく、この画面だけの覚え） */
const editingKey = (courseworkItemId: string, field: "name" | "maxScore") =>
  `${courseworkItemId}:${field}`

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_ITEMS: CourseworkItemWithLetterScales[] = []

/**
 * 試験外成績資料の評価項目管理コンテナ
 *
 * 評価項目の追加・編集（満点・数値/文字モード・文字評価変換表）・並べ替え・削除を行う。
 * 各項目は常時インライン編集で、**変更は1打鍵ごとに即座に保存する**。
 *
 * 以前は項目ごとに 500ms のデバウンスを持ち、期限が来るとドラフト全体（名前・満点・
 * 入力方式・刻みの配列）を1本の IPC で送っていた。そのため項目名を1文字直すだけで
 * 文字評価の刻みが全行 delete → create され、id が振り直されていた。
 *
 * 並べ替えはドラッグ&ドロップ。成績算出から参照中の項目は削除をブロックし、
 * 参照元をトーストで通知する。
 */
export function CourseworkItemsContainer({
  courseworkId,
}: CourseworkItemsContainerProps) {
  const queryClient = useQueryClient()

  // 評価項目は資料の子なので、資料そのもののキャッシュから取り出す。
  // 別キーに項目だけを複製すると、同じ資料が2つの形でキャッシュに載る
  const selectItems = useCallback(
    (coursework: CourseworkWithRelations) =>
      coursework.items
        .slice()
        .sort((itemA, itemB) => itemA.order - itemB.order),
    []
  )
  const { data: items = EMPTY_ITEMS, isPending: loading } = useQuery({
    ...courseworkDetailQuery(courseworkId),
    select: selectItems,
  })

  // 文字評価の項目だけ、入力された評語を見に行く（数値の項目には変換表が無い）。
  // 点数入力ページと同じキーなので取得は共有される
  const letterItems = useMemo(
    () => items.filter((item) => item.inputMode === "letter"),
    [items]
  )
  const scoreQueries = useQueries({
    queries: letterItems.map((item) => courseworkScoresQuery(item.id)),
  })
  /**
   * 評価項目 id → 入力されたが変換表に無い評語。
   *
   * **基準を決めるこの画面で気づく。** 点数入力は自由に受け付けるので、変換表に
   * 無い評語は保存される。それが何であって何人分あるのかを、変換表のすぐ下に出す。
   * 集計は renderer 側で行う（main は点数の行を返すだけ）。
   */
  const unknownLetterValuesByItem = useMemo(
    () =>
      new Map(
        letterItems.map((item, index) => [
          item.id,
          collectUnknownLetterValues(item, scoreQueries[index]?.data ?? []),
        ])
      ),
    [letterItems, scoreQueries]
  )

  const createItem = useMutation(createCourseworkItemMutation(courseworkId))
  const updateItem = useMutation(updateCourseworkItemMutation(courseworkId))
  const deleteItem = useMutation(deleteCourseworkItemMutation(courseworkId))
  const reorderItems = useMutation(reorderCourseworkItemsMutation(courseworkId))
  const createLetterScale = useMutation(
    createCourseworkLetterScaleMutation(courseworkId)
  )

  const [newItemName, setNewItemName] = useState("")
  const [editingText, setEditingText] = useState<ReadonlyMap<string, string>>(
    new Map()
  )

  const textOf = (
    item: CourseworkItemWithLetterScales,
    field: "name" | "maxScore"
  ) => editingText.get(editingKey(item.id, field)) ?? String(item[field])

  const rememberText = (
    item: CourseworkItemWithLetterScales,
    field: "name" | "maxScore",
    text: string
  ) => {
    setEditingText((previous) =>
      new Map(previous).set(editingKey(item.id, field), text)
    )
  }

  const forgetText = (item: CourseworkItemWithLetterScales) => {
    setEditingText((previous) => {
      const next = new Map(previous)
      next.delete(editingKey(item.id, "name"))
      next.delete(editingKey(item.id, "maxScore"))
      return next
    })
  }

  const changeName = (item: CourseworkItemWithLetterScales, text: string) => {
    rememberText(item, "name", text)
    // 名前の無い項目は作れない。入力途中の空は書かず、次の打鍵で確定する
    if (text.trim() === "") return
    updateItem.mutate({ id: item.id, name: text.trim() })
  }

  const changeMaxScore = (
    item: CourseworkItemWithLetterScales,
    text: string
  ) => {
    rememberText(item, "maxScore", text)
    const maxScore = Number(text)
    if (text.trim() === "" || Number.isNaN(maxScore) || maxScore <= 0) return
    updateItem.mutate({ id: item.id, maxScore })
  }

  /**
   * 入力方式を切り替える。
   *
   * 文字評価は変換表が無いと点数入力(04)で1件も受け付けないので、刻みを持って
   * いない項目にはその場で既定の刻みを作る。以前は下書きの既定値がこれを担って
   * いて、行ごとの保存へ割ったときに落ちていた（R1 #4）。
   *
   * **既にあるかどうかは取り直してから見る。** 手元の `item` は切り替える前の姿
   * なので、続けて2回切り替えると同じラベルを2度作りに行き、一意制約
   * （`@@unique([courseworkItemId, label])`）で落ちる。
   */
  const changeInputMode = async (
    item: CourseworkItemWithLetterScales,
    inputMode: InputMode
  ) => {
    await updateItem.mutateAsync({ id: item.id, inputMode })
    if (inputMode !== "letter") return

    const coursework = await queryClient.fetchQuery(
      courseworkDetailQuery(courseworkId)
    )
    const stored = coursework.items.find(
      (candidate) => candidate.id === item.id
    )
    if (!stored || stored.letterScales.length > 0) return

    for (const [order, letterScale] of DEFAULT_LETTER_SCALES.entries()) {
      await createLetterScale.mutateAsync({
        courseworkItemId: item.id,
        label: letterScale.label,
        score: letterScale.score,
        order,
      })
    }
  }

  /**
   * `Select` は待てないので、切り替えの後始末をここで受け切る。
   *
   * 失敗の通知は `MutationCache` が出す。受けずに投げっぱなしにすると、
   * 未処理の拒否になって握り潰される。
   */
  const handleInputModeChange = (
    item: CourseworkItemWithLetterScales,
    inputMode: InputMode
  ) => {
    changeInputMode(item, inputMode).catch(() => undefined)
  }

  const handleAddItem = async () => {
    if (!newItemName.trim()) return
    await createItem.mutateAsync({
      name: newItemName.trim(),
      maxScore: 100,
      inputMode: "numeric",
    })
    setNewItemName("")
  }

  const handleDelete = async (item: CourseworkItemWithLetterScales) => {
    const result = await deleteItem.mutateAsync(item.id)
    if (!result.deleted) {
      toast.error("削除できません", {
        description: `次の成績算出で参照されています: ${result.usedBy.join("、")}`,
      })
      return
    }
    forgetText(item)
    toast.success("評価項目を削除しました", { description: item.name })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((item) => item.id === active.id)
    const newIndex = items.findIndex((item) => item.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    reorderItems.mutate(
      arrayMove(items, oldIndex, newIndex).map((item, order) => ({
        id: item.id,
        order,
      }))
    )
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
            {items.map((item) => (
              <SortableItemRow
                key={item.id}
                courseworkId={courseworkId}
                item={item}
                unknownLetterValues={unknownLetterValuesByItem.get(item.id)}
                name={textOf(item, "name")}
                maxScore={textOf(item, "maxScore")}
                onChangeName={changeName}
                onChangeMaxScore={changeMaxScore}
                onChangeInputMode={handleInputModeChange}
                onBlur={forgetText}
                onDelete={handleDelete}
              />
            ))}
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

interface SortableItemRowProps {
  courseworkId: string
  item: CourseworkItemWithLetterScales
  /** 入力されたが変換表に無い評語（文字評価の項目のみ） */
  unknownLetterValues: UnknownLetterValues | undefined
  name: string
  maxScore: string
  onChangeName: (item: CourseworkItemWithLetterScales, text: string) => void
  onChangeMaxScore: (item: CourseworkItemWithLetterScales, text: string) => void
  onChangeInputMode: (
    item: CourseworkItemWithLetterScales,
    inputMode: InputMode
  ) => void
  onBlur: (item: CourseworkItemWithLetterScales) => void
  onDelete: (item: CourseworkItemWithLetterScales) => void
}

/** ドラッグ&ドロップで並べ替え可能な、常時インライン編集の評価項目1行 */
function SortableItemRow({
  courseworkId,
  item,
  unknownLetterValues,
  name,
  maxScore,
  onChangeName,
  onChangeMaxScore,
  onChangeInputMode,
  onBlur,
  onDelete,
}: SortableItemRowProps) {
  const { setNodeRef, style, dragHandleProps } = useSortableRow(item.id)
  const maxScoreNumber = Number(maxScore)
  const maxScoreInvalid =
    maxScore.trim() === "" || isNaN(maxScoreNumber) || maxScoreNumber <= 0

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <DragHandle dragHandleProps={dragHandleProps} className="mt-5" />

        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">項目名</Label>
              <Input
                value={name}
                onChange={(e) => onChangeName(item, e.target.value)}
                onBlur={() => onBlur(item)}
                className="h-8 w-48"
                placeholder="項目名"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">満点</Label>
              <Input
                value={maxScore}
                onChange={(e) => onChangeMaxScore(item, e.target.value)}
                onBlur={() => onBlur(item)}
                type="number"
                step="any"
                className={cn(
                  "h-8 w-24",
                  maxScoreInvalid && "border-red-400 bg-red-50 text-red-700"
                )}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">入力方式</Label>
              <Select
                value={item.inputMode}
                onValueChange={(value) =>
                  onChangeInputMode(item, toInputMode(value))
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

          {item.inputMode === "letter" && (
            <>
              <LetterScaleEditor courseworkId={courseworkId} item={item} />
              {unknownLetterValues !== undefined &&
                unknownLetterValues.count > 0 && (
                  <p className="text-xs text-amber-700">
                    変換表にない評価が入力されています:{" "}
                    {unknownLetterValues.values.join("、")}（
                    {unknownLetterValues.count}件）
                  </p>
                )}
            </>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="mt-5 h-7 w-7 text-destructive"
          onClick={() => void onDelete(item)}
          title="削除"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
