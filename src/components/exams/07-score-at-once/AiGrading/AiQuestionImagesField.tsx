"use client"

import { arrayMove } from "@dnd-kit/sortable"
import { useQueries } from "@tanstack/react-query"
import { ClipboardPaste, ImagePlus } from "lucide-react"
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { PasswordDialog } from "@/components/ui/password-dialog"
import { Spinner } from "@/components/ui/spinner"
import { AI_QUESTION_IMAGE_ACCEPTED_TYPES } from "@/lib/shared/aiGrading/questionImageLimits"
import { fileProtocolPathQuery } from "@/queries/misc"

import { AiQuestionImageCropDialog } from "./AiQuestionImageCropDialog"
import {
  AiQuestionImageThumbnail,
  type QuestionImageAction,
} from "./AiQuestionImageThumbnail"
import { AiQuestionImageZoomDialog } from "./AiQuestionImageZoomDialog"
import { AiQuestionPdfPageDialog } from "./AiQuestionPdfPageDialog"
import { useQuestionImageIntake } from "./hooks/useQuestionImageIntake"

interface AiQuestionImagesFieldProps {
  cropRegionId: string
  /** 問題の画像（data ディレクトリからの相対パス）を送る順に */
  imagePaths: readonly string[]
  onImagePathsChange: (imagePaths: string[]) => void
}

/** クリップボード・選んだファイルのうち、画像として取り込むもの */
const imageFilesOf = (files: readonly File[]) =>
  files.filter((file) => file.type.startsWith("image/"))

/**
 * プロンプトの問題の画像（何枚でも。docs/vlm-grading-design.md §3-1）。1段目で、この並び順に
 * 全部送る。ファイル（画像・PDF）を選ぶか、画像を貼り付け（Ctrl/⌘+V）て、範囲を切り出して取り込む
 */
export function AiQuestionImagesField({
  cropRegionId,
  imagePaths,
  onImagePathsChange,
}: AiQuestionImagesFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const thumbnailRefs = useRef(new Map<string, HTMLButtonElement>())
  const [zoomIndex, setZoomIndex] = useState<number | null>(null)

  const imageUrls = useQueries({
    queries: imagePaths.map((imagePath) => fileProtocolPathQuery(imagePath)),
    combine: useCallback(
      (results: { data?: string }[]) =>
        results.map((result) => result.data ?? ""),
      []
    ),
  })

  const handleImported = useCallback(
    (imagePath: string, replaceIndex: number | null) => {
      onImagePathsChange(
        replaceIndex === null
          ? [...imagePaths, imagePath]
          : imagePaths.with(replaceIndex, imagePath)
      )
    },
    [imagePaths, onImagePathsChange]
  )
  const intake = useQuestionImageIntake({
    cropRegionId,
    onImported: handleImported,
  })
  const { addFiles, pdfConversion } = intake

  // 貼り付けた画像を取り込む（文字の貼り付けはそのまま欄へ入る）
  const handlePaste = useEffectEvent((event: ClipboardEvent) => {
    const pastedImages = imageFilesOf([...(event.clipboardData?.files ?? [])])
    if (pastedImages.length === 0) return
    event.preventDefault()
    void addFiles(pastedImages)
  })
  useEffect(() => {
    const listener = (event: ClipboardEvent) => handlePaste(event)
    document.addEventListener("paste", listener)
    return () => document.removeEventListener("paste", listener)
  }, [])

  const pasteFromClipboard = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read()
      const pastedImages: File[] = []
      for (const clipboardItem of clipboardItems) {
        const imageType = clipboardItem.types.find((type) =>
          type.startsWith("image/")
        )
        if (!imageType) continue
        const blob = await clipboardItem.getType(imageType)
        pastedImages.push(
          new File([blob], "貼り付けた画像", { type: imageType })
        )
      }
      if (pastedImages.length === 0) {
        toast.info("クリップボードに画像がありません")
        return
      }
      await addFiles(pastedImages)
    } catch {
      toast.error("クリップボードを読めませんでした")
    }
  }

  /** 並べ替えたあとも、動かした画像に焦点を残す */
  const focusImage = (imagePath: string | undefined) => {
    if (imagePath === undefined) return
    requestAnimationFrame(() => thumbnailRefs.current.get(imagePath)?.focus())
  }

  const handleAction = (index: number, action: QuestionImageAction) => {
    const imagePath = imagePaths[index]
    switch (action) {
      case "zoom":
        setZoomIndex(index)
        return
      case "moveEarlier":
      case "moveLater": {
        const targetIndex = action === "moveEarlier" ? index - 1 : index + 1
        if (targetIndex < 0 || targetIndex >= imagePaths.length) return
        onImagePathsChange(arrayMove([...imagePaths], index, targetIndex))
        focusImage(imagePath)
        return
      }
      case "remove":
        onImagePathsChange(
          imagePaths.filter((_, position) => position !== index)
        )
        focusImage(imagePaths[index + 1] ?? imagePaths[index - 1])
        return
      case "recrop": {
        const imageUrl = imageUrls[index]
        if (imageUrl) intake.recropImage(imageUrl, index)
        return
      }
      case "focusPrevious":
        focusImage(imagePaths[index - 1])
        return
      case "focusNext":
        focusImage(imagePaths[index + 1])
        return
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>問題の画像</Label>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={intake.isBusy}
          >
            <ImagePlus className="h-4 w-4" />
            ファイルから追加
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void pasteFromClipboard()}
            disabled={intake.isBusy}
          >
            <ClipboardPaste className="h-4 w-4" />
            貼り付け
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={AI_QUESTION_IMAGE_ACCEPTED_TYPES.join(",")}
          className="hidden"
          data-testid="ai-question-image-file-input"
          onChange={(event) => {
            const files = [...(event.target.files ?? [])]
            // 同じファイルをもう一度選べるように空にする
            event.target.value = ""
            void addFiles(files)
          }}
        />
      </div>

      {imagePaths.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          問題用紙の一部や図など、問題文の代わり・補いになる画像を付けられます（何枚でも）。画像・PDF
          を選ぶか、Ctrl/⌘+V で貼り付けてください。
        </p>
      ) : (
        <ol className="flex flex-wrap gap-2" aria-label="問題の画像（送る順）">
          {imagePaths.map((imagePath, index) => (
            <AiQuestionImageThumbnail
              key={imagePath}
              index={index}
              count={imagePaths.length}
              imageUrl={imageUrls[index] ?? ""}
              buttonRef={(element) => {
                if (element) thumbnailRefs.current.set(imagePath, element)
                else thumbnailRefs.current.delete(imagePath)
              }}
              onAction={(action) => handleAction(index, action)}
            />
          ))}
        </ol>
      )}
      {intake.isBusy && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner />
          画像を用意しています…
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        この順に、答案ごとに毎回送ります（前置きに入るのでキャッシュが効きます）。枚数が増えると費用も増えます。
      </p>

      <AiQuestionPdfPageDialog
        choice={intake.pdfPageChoice}
        onChoose={intake.choosePdfPages}
      />
      <AiQuestionImageCropDialog
        source={intake.currentSource}
        remainingCount={intake.remainingCount}
        isSaving={intake.isSaving}
        onConfirm={intake.confirmCrop}
        onSkip={intake.skipCrop}
      />
      <AiQuestionImageZoomDialog
        imageUrls={imageUrls}
        index={zoomIndex}
        onIndexChange={setZoomIndex}
      />
      {pdfConversion.passwordDialog.isOpen && (
        <PasswordDialog
          isOpen={pdfConversion.passwordDialog.isOpen}
          onClose={pdfConversion.handlePasswordCancel}
          onSubmit={pdfConversion.handlePasswordSubmit}
          fileName={pdfConversion.passwordDialog.fileName}
          error={
            pdfConversion.passwordDialog.hasError
              ? "パスワードが正しくありません"
              : undefined
          }
          isLoading={pdfConversion.passwordDialog.isLoading}
          isFirstAttempt={!pdfConversion.passwordDialog.hasError}
        />
      )}
    </div>
  )
}
