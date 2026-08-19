"use client"

import type { LucideIcon } from "lucide-react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Plus,
  Trash2,
  UnfoldVertical,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type {
  AsbTextElementAttributes,
  CellTextElement,
  HorizontalAlign,
  VerticalAlign,
} from "@/types/answerSheetDefinition.types"

const H_ALIGNS: HorizontalAlign[] = ["left", "center", "right"]
const V_ALIGNS: VerticalAlign[] = ["top", "middle", "bottom"]

const H_ALIGN_ICON: Record<HorizontalAlign, LucideIcon> = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
}
const H_ALIGN_TITLE: Record<HorizontalAlign, string> = {
  left: "左揃え",
  center: "中央揃え",
  right: "右揃え",
}

const V_ALIGN_ICON: Record<VerticalAlign, LucideIcon> = {
  top: ArrowUpToLine,
  middle: UnfoldVertical,
  bottom: ArrowDownToLine,
}
const V_ALIGN_TITLE: Record<VerticalAlign, string> = {
  top: "上揃え",
  middle: "中央",
  bottom: "下揃え",
}

// 縦書き時のタイトル（軸が入れ替わるため表示文言も入れ替える。内部の編集対象プロパティは不変）
const H_ALIGN_TITLE_VERTICAL: Record<HorizontalAlign, string> = {
  left: "上揃え",
  center: "中央",
  right: "下揃え",
}
const V_ALIGN_TITLE_VERTICAL: Record<VerticalAlign, string> = {
  top: "右揃え",
  middle: "中央",
  bottom: "左揃え",
}

interface TextElementEditorProps {
  textElements: CellTextElement[]
  /** 1件足す（実体を作るのは呼び出し側） */
  onAdd: () => void
  onUpdate: (
    textElementId: string,
    data: Partial<AsbTextElementAttributes>
  ) => void
  onDelete: (textElementId: string) => void
  /** 縦書きレイアウトか（揃えコントロールの左右↔上下を入れ替え、アイコンを90°回転） */
  vertical?: boolean
}

/**
 * セル内テキスト要素の追加・編集・削除エディタ。
 * インラインマークアップ（太字・斜体・模範解答等）に対応する。
 */
export function TextElementEditor({
  textElements,
  onAdd,
  onUpdate,
  onDelete,
  vertical = false,
}: TextElementEditorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs">テキスト要素</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={onAdd}
        >
          <Plus className="mr-1 h-3 w-3" />
          追加
        </Button>
      </div>

      {textElements.map((textElement) => (
        <div key={textElement.id} className="space-y-1 rounded border p-1.5">
          {/* Row 1: テキスト + 削除 */}
          <div className="flex items-start gap-1">
            <Textarea
              className="min-h-7 min-w-0 flex-1 resize-none text-xs"
              rows={2}
              value={textElement.text}
              onChange={(e) =>
                onUpdate(textElement.id, { text: e.target.value })
              }
              placeholder="テキスト（**太字** *斜体* __下線__ ~~打消~~ $数式$ ||模範解答||）"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(textElement.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>

          {/* Row 2: フォントサイズ + 配置 */}
          <div className="flex items-center gap-1">
            <input
              type="number"
              className="h-7 w-14 shrink-0 rounded border text-center text-xs"
              value={textElement.fontSize}
              min={2}
              max={24}
              step={0.5}
              onChange={(e) =>
                onUpdate(textElement.id, { fontSize: Number(e.target.value) })
              }
              onBlur={(e) => {
                e.target.value = String(Number(e.target.value))
              }}
              title="フォントサイズ"
            />

            <CycleButton
              values={H_ALIGNS}
              current={textElement.horizontalAlign}
              icons={H_ALIGN_ICON}
              titles={vertical ? H_ALIGN_TITLE_VERTICAL : H_ALIGN_TITLE}
              rotate={vertical}
              onChange={(horizontalAlign) =>
                onUpdate(textElement.id, { horizontalAlign })
              }
            />

            <CycleButton
              values={V_ALIGNS}
              current={textElement.verticalAlign}
              icons={V_ALIGN_ICON}
              titles={vertical ? V_ALIGN_TITLE_VERTICAL : V_ALIGN_TITLE}
              rotate={vertical}
              onChange={(verticalAlign) =>
                onUpdate(textElement.id, { verticalAlign })
              }
            />
          </div>
        </div>
      ))}

      {textElements.length === 0 && (
        <p className="text-[10px] text-muted-foreground">
          テキスト要素はありません
        </p>
      )}
    </div>
  )
}

/** クリックで次の値にサイクルするボタン */
function CycleButton<T extends string>({
  values,
  current,
  icons,
  titles,
  rotate = false,
  onChange,
}: {
  values: T[]
  current: T
  icons: Record<T, LucideIcon>
  titles: Record<T, string>
  /** 縦書き時にアイコンを90°回転する */
  rotate?: boolean
  onChange: (v: T) => void
}) {
  const idx = values.indexOf(current)
  const Icon: LucideIcon = icons[current]

  const handleClick = () => {
    const next = values[(idx + 1) % values.length]
    onChange(next)
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className="h-7 w-7 min-w-0 p-0"
      onClick={handleClick}
      title={titles[current]}
    >
      <Icon className={rotate ? "h-3.5 w-3.5 rotate-90" : "h-3.5 w-3.5"} />
    </Button>
  )
}
