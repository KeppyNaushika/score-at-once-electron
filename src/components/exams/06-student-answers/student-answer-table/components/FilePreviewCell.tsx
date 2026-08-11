"use client"

import { CheckCircle, FileImage, Loader2, XCircle } from "lucide-react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

import type { FilePreviewCellProps } from "@/components/exams/06-student-answers/student-answer-table/types"
import {
  getCachedStudentAnswerImage,
  loadStudentAnswerImageSource,
} from "@/components/exams/06-student-answers/student-answer-table/utils/studentAnswerImageCache"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * ファイルプレビューセルコンポーネント
 *
 * 答案画像のサムネイルを表示するセル。表示ソース（未保存 blob = previewUrl / DB答案の
 * imagePath）と表示値（altName・補正ステータス）は呼び出し側がエンティティ／未保存項目から
 * 導出して渡す（このコンポーネントは答案の同定・実体には依存しない）。氏名欄クリップの
 * 対象ページだけは id（examPageId）で受ける（序数 pageNumber では引かない）。
 */
/**
 * サムネイルの中身（画像の読み込みと描画）。
 *
 * 呼び出し側で表示ソースを `key` にして作り直す。ソースが変われば読み込み結果も
 * 失敗の記録も état ごと捨てられるので、「いつ印を消すか」を考えなくてよい
 * （一度失敗したパスが同じセルで二度と読み直されない、という状態を作らない）。
 */
function AnswerThumbnail({
  previewUrl,
  imagePath,
  altName,
  examPageId,
  previewMode,
  nameRegionAvailable,
  drawNameRegionCanvas,
}: Pick<
  FilePreviewCellProps,
  | "previewUrl"
  | "imagePath"
  | "altName"
  | "examPageId"
  | "previewMode"
  | "nameRegionAvailable"
  | "drawNameRegionCanvas"
>) {
  const [nameRegionPreview, setNameRegionPreview] = useState<string | null>(
    null
  )
  const [isNameRegionLoading, setIsNameRegionLoading] = useState(false)
  const [loadedDataUrl, setLoadedDataUrl] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  // プレビューは previewUrl（未保存 blob）→ 読込済みキャッシュ（DB答案）の順で同期に解決する。
  // これにより DragOverlay の複製セルも、グリッドで読込済みの画像を即座に表示できる。
  const imagePreview =
    previewUrl ??
    (imagePath
      ? (getCachedStudentAnswerImage(imagePath) ?? loadedDataUrl)
      : null)
  // 表示ソースがあるのにプレビューが無い間が読み込み中（失敗したものは除く）
  const isImageLoading = imagePreview === null && !!imagePath && !loadFailed

  /**
   * 既存画像の遅延読み込み（DB保存済みの画像を Electron API 経由で取得）。
   */
  useEffect(() => {
    if (!isImageLoading || !imagePath) return

    let mounted = true

    loadStudentAnswerImageSource(previewUrl, imagePath)
      .then((dataUrl) => {
        if (!mounted) return
        setLoadedDataUrl(dataUrl)
      })
      .catch((error) => {
        if (!mounted) return
        console.error("画像読み込みエラー:", error)
        setLoadFailed(true)
      })

    return () => {
      mounted = false
    }
  }, [previewUrl, imagePath, isImageLoading])

  /**
   * 氏名欄プレビューの生成（previewModeが"name-only"の場合）。
   */
  useEffect(() => {
    if (previewMode === "name-only" && nameRegionAvailable && imagePreview) {
      let cancelled = false
      const frame = requestAnimationFrame(() => {
        if (cancelled) return

        setIsNameRegionLoading(true)
        drawNameRegionCanvas(imagePreview, examPageId)
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
    examPageId,
    previewMode,
    nameRegionAvailable,
    drawNameRegionCanvas,
    imagePreview,
  ])

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
            alt={`${altName} - 氏名欄`}
            className="h-full w-full object-contain"
            width={200}
            height={200}
            unoptimized
          />
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
          alt={altName}
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

export function FilePreviewCell({
  previewUrl,
  imagePath,
  altName,
  examPageId,
  previewMode,
  isFileDisabled,
  nameRegionAvailable,
  drawNameRegionCanvas,
  imageLoadState = "pending",
  correctionStatus,
  correctionError,
  isPendingChange = false,
  hasExistingAnswer = false,
  allowOverwrite = false,
  isCorrecting = false,
}: FilePreviewCellProps) {
  /**
   * 読み込み状態インジケーターをレンダリング
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
        <AnswerThumbnail
          key={previewUrl ?? imagePath ?? ""}
          previewUrl={previewUrl}
          imagePath={imagePath}
          altName={altName}
          examPageId={examPageId}
          previewMode={previewMode}
          nameRegionAvailable={nameRegionAvailable}
          drawNameRegionCanvas={drawNameRegionCanvas}
        />
      </div>

      {isPendingChange && (
        <div className="pointer-events-none absolute inset-0 z-40 animate-pulse border-4 border-red-500 bg-red-500/30" />
      )}

      {hasExistingAnswer && allowOverwrite && (
        <div className="pointer-events-none absolute inset-0 z-30 border-2 border-orange-500 bg-orange-500/20" />
      )}

      {correctionStatus === "corrected" && (
        <div
          className={`pointer-events-none absolute z-20 border-2 border-blue-500 ${
            hasExistingAnswer && allowOverwrite ? "inset-[3px]" : "inset-0"
          }`}
        />
      )}
      {correctionStatus === "skipped" && (
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
              {correctionError && (
                <p className="mt-1 text-xs text-gray-300">{correctionError}</p>
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
