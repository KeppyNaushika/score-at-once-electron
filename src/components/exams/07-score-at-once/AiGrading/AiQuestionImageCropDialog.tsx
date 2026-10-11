"use client"

import Image from "next/image"
import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import type { QuestionImageSource } from "./hooks/useQuestionImageIntake"
import {
  cropImageToPng,
  type CropSelection,
  isWholeImage,
  moveSelection,
  resizeSelection,
  selectionFromDrag,
  WHOLE_IMAGE_SELECTION,
} from "./utils/questionImageCrop"

interface AiQuestionImageCropDialogProps {
  /** 切り出す画像。null なら閉じている */
  source: QuestionImageSource | null
  /** この画像のあとに待っている枚数 */
  remainingCount: number
  isSaving: boolean
  /** 切り出した画像（全体なら元のバイト列）を渡す */
  onConfirm: (imageBytes: Uint8Array) => void
  /** この画像を取り込まずに飛ばす */
  onSkip: () => void
}

/** 矢印キー1回で動かす量（画像に対する比）。Shift で大きく */
const KEY_STEP = 0.01
const KEY_STEP_LARGE = 0.05

const ARROW_DELTAS: Record<string, { dx: number; dy: number }> = {
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
}

/**
 * 問題の画像の範囲を切り出す。ドラッグで範囲を選ぶ（はじめは全体）。
 * キーでは、矢印で範囲を動かし、Alt＋矢印で右下を広げ・狭める（Shift で大きく）。Enter で取り込む
 */
export function AiQuestionImageCropDialog(
  props: AiQuestionImageCropDialogProps
) {
  return (
    <Dialog
      open={props.source !== null}
      onOpenChange={(open) => {
        if (!open && !props.isSaving) props.onSkip()
      }}
    >
      <DialogContent className="max-h-[95vh] max-w-4xl overflow-y-auto">
        {props.source && (
          // 画像が替わるたびに範囲を全体へ戻す
          <CropForm key={props.source.key} {...props} source={props.source} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function CropForm({
  source,
  remainingCount,
  isSaving,
  onConfirm,
  onSkip,
}: AiQuestionImageCropDialogProps & { source: QuestionImageSource }) {
  const [selection, setSelection] = useState<CropSelection>(
    WHOLE_IMAGE_SELECTION
  )
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  )
  const [isLoaded, setIsLoaded] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)

  const ratioOf = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0,
      y: rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0,
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragStart(ratioOf(event))
  }
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStart) return
    const dragged = selectionFromDrag(dragStart, ratioOf(event))
    if (dragged) setSelection(dragged)
  }
  const handlePointerUp = () => setDragStart(null)

  const keepsOriginal = isWholeImage(selection) && source.originalBytes !== null
  const canConfirm = !isSaving && (keepsOriginal || isLoaded)

  const handleConfirm = async () => {
    if (!canConfirm) return
    if (keepsOriginal && source.originalBytes) {
      onConfirm(source.originalBytes)
      return
    }
    const image = imageRef.current
    if (!image) return
    try {
      onConfirm(await cropImageToPng(image, selection))
    } catch (error) {
      toast.error("画像を切り出せませんでした", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      void handleConfirm()
      return
    }
    const delta = ARROW_DELTAS[event.key]
    if (!delta) return
    event.preventDefault()
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP
    setSelection((prev) =>
      event.altKey
        ? resizeSelection(prev, delta.dx * step, delta.dy * step)
        : moveSelection(prev, delta.dx * step, delta.dy * step)
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>問題の画像を切り出す（{source.label}）</DialogTitle>
        <DialogDescription>
          ドラッグで送る範囲を選びます（はじめは全体）。矢印キーで範囲を動かし、Alt＋矢印で広げ・狭めます（Shift
          で大きく）。Enter で取り込みます。
          {remainingCount > 0 && `このあと ${remainingCount} 枚あります。`}
        </DialogDescription>
      </DialogHeader>

      <div
        role="application"
        aria-label="切り出す範囲"
        tabIndex={0}
        autoFocus
        onKeyDown={handleKeyDown}
        className="flex justify-center rounded border bg-muted/40 p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div
          className="relative cursor-crosshair touch-none select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* 切り出しは、この画像要素から canvas へ描いて行う（appimg は CORS を許している） */}
          <Image
            ref={imageRef}
            src={source.url}
            alt={source.label}
            width={800}
            height={1000}
            unoptimized
            crossOrigin="anonymous"
            draggable={false}
            onLoad={() => setIsLoaded(true)}
            className="block h-auto max-h-[60vh] w-auto max-w-full"
          />
          <div
            data-testid="ai-question-image-crop-selection"
            className="pointer-events-none absolute border-2 border-blue-600 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
            style={{
              left: `${selection.x * 100}%`,
              top: `${selection.y * 100}%`,
              width: `${selection.width * 100}%`,
              height: `${selection.height * 100}%`,
            }}
          />
        </div>
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        <Button
          variant="outline"
          onClick={() => setSelection(WHOLE_IMAGE_SELECTION)}
          disabled={isWholeImage(selection)}
        >
          全体を選ぶ
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSkip} disabled={isSaving}>
            {remainingCount > 0 ? "この画像を飛ばす" : "やめる"}
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={!canConfirm}>
            {source.replaceIndex === null ? "取り込む" : "切り出して置き換える"}
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}
