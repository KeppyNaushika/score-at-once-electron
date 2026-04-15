"use client"

import { CheckCircle, FileImage, Loader2, XCircle } from "lucide-react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

import { loadStudentAnswerImage } from "@/components/exams/06-student-answers/student-answer-management/utils/convertStudentAnswersToFiles"
import type { FilePreviewCellProps } from "@/components/exams/06-student-answers/student-answer-table/types"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * ファイルプレビューセルコンポーネント
 *
 * 答案画像のサムネイルを表示するセル。
 * 既存画像の遅延読み込み、氏名欄プレビュー生成、各種状態オーバーレイ表示を行う。
 *
 * @remarks
 * fileオブジェクトへの参照はuseRefで保持し、依存配列にはfile.idとfile.imagePathのみを含める。
 * これにより親コンポーネントの再レンダリング時にuseEffectが不要に再実行されることを防ぐ。
 */
export function FilePreviewCell({
  file,
  pageNumber,
  previewMode,
  isFileDisabled,
  nameRegionAvailable,
  drawNameRegionCanvas,
  imageLoadState = "pending",
  isPendingChange = false,
  hasExistingAnswer = false,
  allowOverwrite = false,
  isCorrecting = false,
}: FilePreviewCellProps & {
  isPendingChange?: boolean
  hasExistingAnswer?: boolean
  allowOverwrite?: boolean
  isCorrecting?: boolean
}) {
  const [nameRegionPreview, setNameRegionPreview] = useState<string | null>(
    null
  )
  const [isNameRegionLoading, setIsNameRegionLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(
    file.preview || null
  )
  const [isImageLoading, setIsImageLoading] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  /** fileオブジェクトへの参照（useEffect内から最新の値にアクセスするため） */
  const fileRef = useRef(file)
  fileRef.current = file

  /** ファイルIDが変わった時にプレビュー状態をリセット */
  useEffect(() => {
    setImagePreview(file.preview || null)
    setIsImageLoading(false)
  }, [file.id, file.preview])

  /**
   * 既存画像の遅延読み込み
   *
   * DB保存済みの画像をElectron API経由でBase64として取得し表示する。
   * 依存配列にはfile.idとfile.imagePathのみを含め、fileオブジェクト全体は含めない。
   * isImageLoadingは依存配列に含めない（含めるとstate変更→cleanup→cancelled=trueで読み込みが完了しない）。
   */
  useEffect(() => {
    let mounted = true
    const currentFile = fileRef.current

    if (!imagePreview && currentFile.imagePath) {
      setIsImageLoading(true)
      loadStudentAnswerImage(currentFile)
        .then((dataUrl) => {
          if (!mounted) return
          setImagePreview(dataUrl)
        })
        .catch((error) => {
          if (!mounted) return
          console.error("画像読み込みエラー:", error)
        })
        .finally(() => {
          if (!mounted) return
          setIsImageLoading(false)
        })
    }

    return () => {
      mounted = false
    }
  }, [file.id, file.imagePath, imagePreview])

  /**
   * 氏名欄プレビューの生成
   *
   * previewModeが"name-only"の場合、画像から氏名欄領域を切り出して表示する。
   */
  useEffect(() => {
    const currentFile = fileRef.current
    if (previewMode === "name-only" && nameRegionAvailable && imagePreview) {
      let cancelled = false
      const frame = requestAnimationFrame(() => {
        if (cancelled) return

        setIsNameRegionLoading(true)
        const tempFile = { ...currentFile, preview: imagePreview }
        drawNameRegionCanvas(tempFile, pageNumber)
          .then((canvas) => {
            if (cancelled) return
            setNameRegionPreview(canvas)
            setIsNameRegionLoading(false)
          })
          .catch((error) => {
            if (cancelled) return
            console.error("氏名欄プレビュー生成エラー:", error)
            setIsNameRegionLoading(false)
          })
      })

      return () => {
        cancelled = true
        cancelAnimationFrame(frame)
      }
    }
  }, [
    file.id,
    pageNumber,
    previewMode,
    nameRegionAvailable,
    drawNameRegionCanvas,
    imagePreview,
  ])

  /**
   * 画像プレビューをレンダリング
   * @returns プレビューモードと読み込み状態に応じたJSX要素
   */
  const renderImagePreview = () => {
    if (previewMode === "name-only") {
      if (!nameRegionAvailable) {
        return (
          <div className="flex h-full items-center justify-center">
            <span className="text-sm text-gray-500">氏名欄なし</span>
          </div>
        )
      }

      if (isNameRegionLoading) {
        return (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )
      }

      if (nameRegionPreview) {
        return (
          <div className="relative h-full w-full">
            <Image
              src={nameRegionPreview}
              alt={`${file.name} - 氏名欄`}
              className="h-full w-full object-contain"
              width={200}
              height={200}
              unoptimized
            />
            {process.env.NODE_ENV === "development" && (
              <div className="bg-opacity-75 absolute top-0 left-0 bg-black p-1 font-mono text-xs text-white">
                <div>ID: {file.id.slice(0, 8)}</div>
                <div>SID: {file.studentId?.slice(0, 8) || "undefined"}</div>
                <div>P: {file.pageNumber}</div>
              </div>
            )}
          </div>
        )
      }
    }

    if (isImageLoading) {
      return (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )
    }

    if (imagePreview) {
      return (
        <div className="relative h-full w-full">
          <Image
            ref={imgRef}
            src={imagePreview}
            alt={file.name}
            className="h-full w-full object-contain"
            width={200}
            height={200}
            unoptimized
          />
        </div>
      )
    }

    return (
      <div className="flex h-full items-center justify-center">
        <FileImage className="h-8 w-8 text-gray-400" />
      </div>
    )
  }

  /**
   * 読み込み状態インジケーターをレンダリング
   * @returns imageLoadStateに応じたインジケーター要素
   */
  const renderLoadingState = () => {
    switch (imageLoadState) {
      case "loading":
        return (
          <div className="bg-opacity-75 absolute inset-0 flex items-center justify-center bg-white">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          </div>
        )
      case "loaded":
        return (
          <div className="absolute top-1 right-1">
            <CheckCircle className="h-3 w-3 text-green-500" />
          </div>
        )
      case "error":
        return (
          <div className="bg-opacity-75 absolute inset-0 flex items-center justify-center bg-white">
            <XCircle className="h-4 w-4 text-red-500" />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="relative h-full w-full">
      <div
        className={`h-full w-full ${isFileDisabled ? "opacity-50 grayscale" : ""}`}
      >
        {renderImagePreview()}
      </div>

      {isPendingChange && (
        <div className="pointer-events-none absolute inset-0 z-40 animate-pulse border-4 border-red-500 bg-red-500/30" />
      )}

      {hasExistingAnswer && allowOverwrite && (
        <div className="pointer-events-none absolute inset-0 z-30 border-2 border-orange-500 bg-orange-500/20" />
      )}

      {file.correctionStatus === "corrected" && (
        <div
          className={`pointer-events-none absolute z-20 border-2 border-blue-500 ${
            hasExistingAnswer && allowOverwrite ? "inset-[3px]" : "inset-0"
          }`}
        />
      )}
      {file.correctionStatus === "skipped" && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`absolute z-20 border-2 border-amber-500 ${
                  hasExistingAnswer && allowOverwrite
                    ? "inset-[3px]"
                    : "inset-0"
                }`}
              />
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <p className="font-medium">マーカー補正スキップ</p>
              {file.correctionError && (
                <p className="mt-1 text-xs text-gray-300">
                  {file.correctionError}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {renderLoadingState()}

      {isCorrecting && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-white/60">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      )}
    </div>
  )
}
