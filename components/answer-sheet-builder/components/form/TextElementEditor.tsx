"use client"

import { Plus, Trash2 } from "lucide-react"

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
  CellTextElement,
  HorizontalAlign,
  VerticalAlign,
} from "@/types/answerSheetBuilder.types"

import { generateId } from "../../constants"

interface TextElementEditorProps {
  textElements: CellTextElement[]
  onUpdate: (elements: CellTextElement[]) => void
}

function createDefaultTextElement(): CellTextElement {
  return {
    id: generateId(),
    text: "",
    fontSize: 10,
    fontWeight: "normal",
    horizontalAlign: "center",
    verticalAlign: "middle",
  }
}

export function TextElementEditor({
  textElements,
  onUpdate,
}: TextElementEditorProps) {
  const handleAdd = () => {
    onUpdate([...textElements, createDefaultTextElement()])
  }

  const handleRemove = (index: number) => {
    onUpdate(textElements.filter((_, i) => i !== index))
  }

  const handleChange = (index: number, data: Partial<CellTextElement>) => {
    const updated = textElements.map((el, i) =>
      i === index ? { ...el, ...data } : el
    )
    onUpdate(updated)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">テキスト要素</Label>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={handleAdd}
        >
          <Plus className="mr-1 h-3 w-3" />
          追加
        </Button>
      </div>

      {textElements.map((el, i) => (
        <div key={el.id} className="space-y-1.5 rounded border p-2">
          {/* テキスト入力 */}
          <div className="flex items-center gap-1">
            <Input
              className="h-7 flex-1 text-xs"
              value={el.text}
              onChange={(e) => handleChange(i, { text: e.target.value })}
              placeholder="テキスト（LaTeX可: $x^2$）"
            />
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive h-6 w-6 flex-shrink-0"
              onClick={() => handleRemove(i)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>

          {/* スタイル設定 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-muted-foreground text-[10px] whitespace-nowrap">
                サイズ
              </Label>
              <Input
                type="number"
                className="h-6 w-12 text-xs"
                value={el.fontSize}
                min={6}
                max={24}
                step={0.5}
                onChange={(e) =>
                  handleChange(i, { fontSize: Number(e.target.value) })
                }
              />
            </div>
            <Select
              value={el.fontWeight}
              onValueChange={(v) =>
                handleChange(i, {
                  fontWeight: v as "normal" | "bold",
                })
              }
            >
              <SelectTrigger className="h-6 w-16 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">通常</SelectItem>
                <SelectItem value="bold">太字</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={el.horizontalAlign}
              onValueChange={(v) =>
                handleChange(i, { horizontalAlign: v as HorizontalAlign })
              }
            >
              <SelectTrigger className="h-6 w-14 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">左</SelectItem>
                <SelectItem value="center">中央</SelectItem>
                <SelectItem value="right">右</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={el.verticalAlign}
              onValueChange={(v) =>
                handleChange(i, { verticalAlign: v as VerticalAlign })
              }
            >
              <SelectTrigger className="h-6 w-14 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top">上</SelectItem>
                <SelectItem value="middle">中</SelectItem>
                <SelectItem value="bottom">下</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}

      {textElements.length === 0 && (
        <p className="text-muted-foreground text-[10px]">
          テキスト要素はありません
        </p>
      )}
    </div>
  )
}
