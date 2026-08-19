"use client"

import { useMutation } from "@tanstack/react-query"
import { ImagePlus, Trash2 } from "lucide-react"
import Image from "next/image"
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
import {
  deleteAnswerSheetImageMutation,
  uploadAnswerSheetImageMutation,
} from "@/queries/answerSheetBuilder"
import { pathForFile } from "@/queries/pdfTools"
import type {
  AsbImageElementAttributes,
  CellImageElement,
  ImageObjectFit,
  ImageVisibility,
} from "@/types/answerSheetDefinition.types"

import { useAsbGesture } from "../../AsbGestureContext"
import { generateId } from "../../constants"

const OBJECT_FIT_OPTIONS: { value: ImageObjectFit; label: string }[] = [
  { value: "contain", label: "収める" },
  { value: "cover", label: "覆う" },
  { value: "fill", label: "引き伸ばす" },
]

const VISIBILITY_OPTIONS: { value: ImageVisibility; label: string }[] = [
  { value: "both", label: "常に表示" },
  { value: "answer-sheet-only", label: "解答用紙のみ" },
  { value: "model-answer-only", label: "模範解答のみ" },
]

interface ImageElementEditorProps {
  imageElements: CellImageElement[]
  /** 取り込んだ画像を1件足す（実体はここで作る。取り込み先の相対パスが要るため） */
  onAdd: (imageElement: CellImageElement) => void
  onUpdate: (
    imageElementId: string,
    data: Partial<AsbImageElementAttributes>
  ) => void
  onDelete: (imageElementId: string) => void
  definitionId: string
}

/**
 * セル内画像要素の追加・編集・削除エディタ。
 * 画像ファイルのアップロードと表示設定（objectFit・配置・透過度）を管理する。
 */
export function ImageElementEditor({
  imageElements,
  onAdd,
  onUpdate,
  onDelete,
  definitionId,
}: ImageElementEditorProps) {
  const gesture = useAsbGesture()
  const { mutateAsync: uploadImage } = useMutation(
    uploadAnswerSheetImageMutation()
  )
  const { mutateAsync: deleteImage } = useMutation(
    deleteAnswerSheetImageMutation()
  )

  const handleAdd = useCallback(async () => {
    // ファイル選択ダイアログ
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml"

    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return

      // Electron の webUtils.getPathForFile でローカルパスを取得
      const filePath = pathForFile(file)
      if (!filePath) return
      const uploadedPath = await uploadImage({
        definitionId,
        filePath,
        originalName: file.name,
      })

      onAdd({
        id: generateId(),
        imagePath: uploadedPath,
        originalName: file.name,
        objectFit: "contain",
        horizontalAlign: "center",
        verticalAlign: "middle",
        opacity: 1,
      })
    }
    input.click()
  }, [definitionId, onAdd, uploadImage])

  const handleRemove = useCallback(
    async (imageElement: CellImageElement) => {
      await deleteImage({ imagePath: imageElement.imagePath })
      onDelete(imageElement.id)
    },
    [onDelete, deleteImage]
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

      {imageElements.map((imageElement) => (
        <div key={imageElement.id} className="space-y-1.5 rounded border p-1.5">
          {/* Row 1: サムネイル + ファイル名 + 削除 */}
          <div className="flex items-center gap-1.5">
            <Image
              src={`appimg:///${imageElement.imagePath}`}
              alt={imageElement.originalName}
              width={32}
              height={32}
              unoptimized
              className="h-8 w-8 shrink-0 rounded border object-contain"
            />
            <span className="min-w-0 flex-1 truncate text-xs">
              {imageElement.originalName}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => handleRemove(imageElement)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>

          {/* Row 2: objectFit + 表示モード */}
          <div className="flex items-center gap-2">
            <Select
              value={imageElement.objectFit}
              onValueChange={(value) =>
                onUpdate(imageElement.id, {
                  objectFit: value as ImageObjectFit,
                })
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

            <Select
              value={imageElement.visibility ?? "both"}
              onValueChange={(value) =>
                onUpdate(imageElement.id, {
                  visibility: value as ImageVisibility,
                })
              }
            >
              <SelectTrigger className="h-7 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Row 3: 不透明度 */}
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-[10px] text-muted-foreground">
              透明度
            </span>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[Math.round(imageElement.opacity * 100)]}
              onValueChange={([percent]) => {
                gesture.begin()
                onUpdate(imageElement.id, { opacity: percent / 100 })
              }}
              onValueCommit={gesture.end}
              className="flex-1"
            />
            <span className="w-8 shrink-0 text-right text-[10px]">
              {Math.round(imageElement.opacity * 100)}%
            </span>
          </div>
        </div>
      ))}

      {imageElements.length === 0 && (
        <p className="text-[10px] text-muted-foreground">
          画像要素はありません
        </p>
      )}
    </div>
  )
}
