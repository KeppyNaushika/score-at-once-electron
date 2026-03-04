"use client"

import { ImagePlus, Trash2 } from "lucide-react"
import { useCallback } from "react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import type {
  CellImageElement,
  ImageObjectFit,
} from "@/types/answerSheetBuilder.types"

import { generateId } from "../../constants"

const OBJECT_FIT_OPTIONS: { value: ImageObjectFit; label: string }[] = [
  { value: "contain", label: "収める" },
  { value: "cover", label: "覆う" },
  { value: "fill", label: "引き伸ばす" },
]

interface ImageElementEditorProps {
  imageElements: CellImageElement[]
  onUpdate: (elements: CellImageElement[]) => void
  definitionId: string
}

export function ImageElementEditor({
  imageElements,
  onUpdate,
  definitionId,
}: ImageElementEditorProps) {
  const handleAdd = useCallback(async () => {
    const api = window.electronAPI
    if (!api?.answerSheetBuilder) return

    // ファイル選択ダイアログ
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml"

    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return

      // Electron の webUtils.getPathForFile でローカルパスを取得
      const filePath = window.electronAPI?.pdfTools?.getPathForFile(file)
      if (!filePath) return
      const result = await api.answerSheetBuilder.uploadImage({
        definitionId,
        filePath,
        originalName: file.name,
      })

      if (result.success && result.imagePath) {
        const newElement: CellImageElement = {
          id: generateId(),
          imagePath: result.imagePath,
          originalName: file.name,
          objectFit: "contain",
          horizontalAlign: "center",
          verticalAlign: "middle",
          opacity: 1,
        }
        onUpdate([...imageElements, newElement])
      }
    }
    input.click()
  }, [definitionId, imageElements, onUpdate])

  const handleRemove = useCallback(
    async (index: number) => {
      const element = imageElements[index]
      const api = window.electronAPI
      if (api?.answerSheetBuilder) {
        await api.answerSheetBuilder.deleteImage({
          imagePath: element.imagePath,
        })
      }
      onUpdate(imageElements.filter((_, i) => i !== index))
    },
    [imageElements, onUpdate]
  )

  const handleChange = useCallback(
    (index: number, data: Partial<CellImageElement>) => {
      const updated = imageElements.map((el, i) =>
        i === index ? { ...el, ...data } : el
      )
      onUpdate(updated)
    },
    [imageElements, onUpdate]
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs">画像要素</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={handleAdd}
        >
          <ImagePlus className="mr-1 h-3 w-3" />
          追加
        </Button>
      </div>

      {imageElements.map((el, i) => (
        <div key={el.id} className="space-y-1.5 rounded border p-1.5">
          {/* Row 1: サムネイル + ファイル名 + 削除 */}
          <div className="flex items-center gap-1.5">
            <img
              src={`appimg:///${el.imagePath}`}
              alt={el.originalName}
              className="h-8 w-8 shrink-0 rounded border object-contain"
            />
            <span className="min-w-0 flex-1 truncate text-xs">
              {el.originalName}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive h-7 w-7 shrink-0"
              onClick={() => handleRemove(i)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>

          {/* Row 2: objectFit + 不透明度 */}
          <div className="flex items-center gap-2">
            <Select
              value={el.objectFit}
              onValueChange={(v) =>
                handleChange(i, { objectFit: v as ImageObjectFit })
              }
            >
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OBJECT_FIT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-1 items-center gap-1.5">
              <span className="text-muted-foreground shrink-0 text-[10px]">
                透明度
              </span>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[Math.round(el.opacity * 100)]}
                onValueChange={([v]) => handleChange(i, { opacity: v / 100 })}
                className="flex-1"
              />
              <span className="w-8 shrink-0 text-right text-[10px]">
                {Math.round(el.opacity * 100)}%
              </span>
            </div>
          </div>
        </div>
      ))}

      {imageElements.length === 0 && (
        <p className="text-muted-foreground text-[10px]">
          画像要素はありません
        </p>
      )}
    </div>
  )
}
