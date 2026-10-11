"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import type { KeyboardEvent } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface AiQuestionImageZoomDialogProps {
  /** 並び順の画像の URL（読めていないものは ""） */
  imageUrls: readonly string[]
  /** 見ている画像の位置。null なら閉じている */
  index: number | null
  onIndexChange: (index: number | null) => void
}

/** 問題の画像を大きく見る。← → で前後の画像へ、Esc で閉じる */
export function AiQuestionImageZoomDialog({
  imageUrls,
  index,
  onIndexChange,
}: AiQuestionImageZoomDialogProps) {
  const imageUrl = index === null ? undefined : imageUrls[index]
  const canGoPrevious = index !== null && index > 0
  const canGoNext = index !== null && index < imageUrls.length - 1

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (index === null) return
    if (event.key === "ArrowLeft" && canGoPrevious) {
      event.preventDefault()
      onIndexChange(index - 1)
    }
    if (event.key === "ArrowRight" && canGoNext) {
      event.preventDefault()
      onIndexChange(index + 1)
    }
  }

  return (
    <Dialog
      open={index !== null}
      onOpenChange={(open) => {
        if (!open) onIndexChange(null)
      }}
    >
      <DialogContent
        className="max-h-[95vh] max-w-5xl overflow-y-auto"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle>
            問題の画像（{index === null ? "" : index + 1} / {imageUrls.length}）
          </DialogTitle>
          <DialogDescription>
            ← → で前後の画像へ移ります。Esc で閉じます。
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="前の画像"
            disabled={!canGoPrevious}
            onClick={() => index !== null && onIndexChange(index - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-1 justify-center">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={`問題の画像 ${index === null ? "" : index + 1}枚目`}
                width={1200}
                height={1600}
                unoptimized
                className="h-auto max-h-[75vh] w-auto max-w-full object-contain"
              />
            ) : (
              <p className="text-sm text-muted-foreground">読み込み中…</p>
            )}
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label="次の画像"
            disabled={!canGoNext}
            onClick={() => index !== null && onIndexChange(index + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
