"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Trash } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { SubtotalMarkColorPicker } from "./SubtotalMarkColorPicker"

/** 編集中の小計項目1つ（小計点グループの作成・編集のフォーム） */
export interface SubtotalFormData {
  /**
   * 並べ替えと React の key に使う、この画面の中だけの値。
   *
   * **DB の行を指す id ではない。** まだ作られていない項目にも要るので、
   * 既にある項目では `subtotalId` と同じ値を、新しい項目では uuid を入れる。
   */
  key: string
  /** DB にある行の id。まだ作られていない項目は null */
  subtotalId: string | null
  name: string
  order: number
  /** 採点マークの色（HEX）。null は未設定＝試験全体の色で描く */
  markColor: string | null
}

/** ドラッグで並べ替えられる小計項目1行。項目はこの画面の中の key で同定する */
export function SortableSubtotalItem({
  subtotal,
  position,
  onRename,
  onMarkColorChange,
  onDelete,
}: {
  subtotal: SubtotalFormData
  /** 何番目か（表示用。1始まりで見せる） */
  position: number
  onRename: (key: string, name: string) => void
  onMarkColorChange: (key: string, markColor: string | null) => void
  onDelete: (key: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtotal.key })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-background p-3"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab hover:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <Badge variant="outline" className="w-8 text-center">
        {position + 1}
      </Badge>
      <div className="flex-1">
        <Input
          placeholder="小計項目名"
          value={subtotal.name}
          onChange={(e) => onRename(subtotal.key, e.target.value)}
        />
      </div>
      <SubtotalMarkColorPicker
        markColor={subtotal.markColor}
        onChange={(markColor) => onMarkColorChange(subtotal.key, markColor)}
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(subtotal.key)}
        className="text-destructive hover:text-destructive"
      >
        <Trash className="h-4 w-4" />
      </Button>
    </div>
  )
}
