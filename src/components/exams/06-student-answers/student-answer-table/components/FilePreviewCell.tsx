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
 * imagePath）と表示値（altName・pageNumber・補正ステータス）は呼び出し側がエンティティ
 * ／未保存項目から導出して渡す（このコンポーネントは答案の同定・実体には依存しない）。
 */
export function FilePreviewCell({
  previewUrl,
  imagePath,
  altName,
  pageNumber,
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
  const [nameRegionPreview, setNameRegionPreview] = useState<string | null>(
    null
  )
  const [isNameRegionLoading, setIsNameRegionLoading] = useState(false)
  // 初期プレビューは previewUrl（未保存 blob）→ 読込済みキャッシュ（DB答案）の順で同期取得する。
  // これにより DragOverlay の複製セルも、グリッドで読込済みの画像を即座に表示できる。
  const [imagePreview, setImagePreview] = useState<string | null>(
    previewUrl ??
      (imagePath ? (getCachedStudentAnswerImage(imagePath) ?? null) : null)
  )
  const [isImageLoading, setIsImageLoading] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  /** 表示ソースが変わった時にプレビュー状態をリセット（キャッシュがあれば即座に反映） */
  useEffect(() => {
    setImagePreview(
      previewUrl ??
        (imagePath ? (getCachedStudentAnswerImage(imagePath) ?? null) : null)
    )
    setIsImageLoading(false)
  }, [previewUrl, imagePath])

  /**
   * 既存画像の遅延読み込み（DB保存済みの画像を Electron API 経由で取得）。
   */
  useEffect(() => {
    let mounted = true

    if (!imagePreview && imagePath) {
      setIsImageLoading(true)
      loadStudentAnswerImageSource(previewUrl, imagePath)
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
  }, [previewUrl, imagePath, imagePreview])

  /**
   * 氏名欄プレビューの生成（previewModeが"name-only"の場合）。
   */
  useEffect(() => {
    if (previewMode === "name-only" && nameRegionAvailable && imagePreview) {
      let cancelled = false
      const frame = requestAnimationFrame(() => {
        if (cancelled) return

        setIsNameRegionLoading(true)
        drawNameRegionCanvas(imagePreview, pageNumber)
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
    pageNumber,
    previewMode,
    nameRegionAvailable,
    drawNameRegionCanvas,
    imagePreview,
  ])

  /**
   * 画像プレビューをレンダリング
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
        {renderImagePreview()}
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
