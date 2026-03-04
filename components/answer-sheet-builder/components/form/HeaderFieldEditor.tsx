"use client"

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  HeaderFieldDefinition,
  HeaderFieldType,
  LineStyle,
} from "@/types/answerSheetDefinition.types"

import { HEADER_FIELD_PRESETS } from "../../constants"
import { SliderWithInput } from "./SliderWithInput"

interface HeaderFieldEditorProps {
  fields: HeaderFieldDefinition[]
  onAdd: (defaults?: Partial<HeaderFieldDefinition>) => void
  onUpdate: (fieldId: string, data: Partial<HeaderFieldDefinition>) => void
  onDelete: (fieldId: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
}

const TYPE_LABELS: Record<HeaderFieldType, string> = {
  field: "記入欄",
  hfill: "可変スペース",
  label: "ラベル",
}

export function HeaderFieldEditor({
  fields,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
}: HeaderFieldEditorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">ヘッダー記入欄</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <Plus className="mr-1 h-3 w-3" />
              追加
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {HEADER_FIELD_PRESETS.map((preset) => (
              <DropdownMenuItem
                key={preset.label}
                onClick={() => onAdd(preset.defaults)}
              >
                {preset.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => onAdd()}>
              カスタム
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {fields.length === 0 && (
        <p className="text-muted-foreground text-xs">
          フィールドがありません。追加ボタンからプリセットを選択できます。
        </p>
      )}

      {fields.map((field, index) => {
        const fieldType = field.type ?? "field"
        return (
          <div key={field.id} className="space-y-2 rounded border p-2">
            <div className="flex items-center gap-1">
              {/* hfill はラベル不要なのでタイプ表示のみ */}
              {fieldType === "hfill" ? (
                <span className="text-muted-foreground flex-1 text-xs italic">
                  可変スペース
                </span>
              ) : (
                <Input
                  value={field.label}
                  onChange={(e) =>
                    onUpdate(field.id, { label: e.target.value })
                  }
                  className="h-7 flex-1 text-xs"
                  placeholder="ラベル"
                />
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onReorder(index, index - 1)}
                disabled={index === 0}
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onReorder(index, index + 1)}
                disabled={index === fields.length - 1}
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive h-6 w-6"
                onClick={() => onDelete(field.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>

            {/* タイプ切替 */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">タイプ</Label>
                <Select
                  value={fieldType}
                  onValueChange={(v) =>
                    onUpdate(field.id, { type: v as HeaderFieldType })
                  }
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* label タイプ: フォントサイズ */}
              {fieldType === "label" && (
                <SliderWithInput
                  label="文字サイズ"
                  value={field.fontSize ?? 5}
                  min={2}
                  max={15}
                  step={0.5}
                  onChange={(v) => onUpdate(field.id, { fontSize: v })}
                />
              )}
            </div>

            {/* field / label: 幅・高さ */}
            {fieldType !== "hfill" && (
              <div className="grid grid-cols-2 gap-2">
                <SliderWithInput
                  label="幅"
                  value={field.widthMm}
                  min={10}
                  max={100}
                  step={1}
                  onChange={(v) => onUpdate(field.id, { widthMm: v })}
                />
                <SliderWithInput
                  label="高さ"
                  value={field.heightMm}
                  min={4}
                  max={20}
                  step={1}
                  onChange={(v) => onUpdate(field.id, { heightMm: v })}
                />
              </div>
            )}

            {/* field タイプのみ: マス数・罫線 */}
            {fieldType === "field" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">マス数</Label>
                  <Input
                    type="number"
                    value={field.gridCount}
                    onChange={(e) =>
                      onUpdate(field.id, {
                        gridCount: Math.max(0, parseInt(e.target.value) || 0),
                      })
                    }
                    className="h-7 text-xs"
                    min={0}
                    max={20}
                  />
                </div>
                <div>
                  <Label className="text-[10px]">罫線</Label>
                  <Select
                    value={field.lineStyle}
                    onValueChange={(v) =>
                      onUpdate(field.id, { lineStyle: v as LineStyle })
                    }
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solid">実線</SelectItem>
                      <SelectItem value="dashed">破線</SelectItem>
                      <SelectItem value="dotted">点線</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
