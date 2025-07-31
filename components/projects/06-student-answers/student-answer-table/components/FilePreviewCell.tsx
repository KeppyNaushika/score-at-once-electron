"use client"

import { loadAnswerSheetImage } from "@/components/projects/06-student-answers/student-answer-management/utils/convertAnswerSheetsToFiles"
import type { FilePreviewCellProps } from "@/components/projects/06-student-answers/student-answer-table/types"
import { CheckCircle, FileImage, Loader2, XCircle } from "lucide-react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

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
}: FilePreviewCellProps & {
  isPendingChange?: boolean
  hasExistingAnswer?: boolean
  allowOverwrite?: boolean
}) {
  const [nameRegionPreview, setNameRegionPreview] = useState<string | null>(
    null,
  )
  const [isNameRegionLoading, setIsNameRegionLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(
    file.preview || null,
  )
  const [isImageLoading, setIsImageLoading] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  // 既存画像の遅延読み込み
  useEffect(() => {
    if (!imagePreview && file.imagePath && !isImageLoading) {
      setIsImageLoading(true)
      loadAnswerSheetImage(file)
        .then((dataUrl) => {
          setImagePreview(dataUrl)
          setIsImageLoading(false)
        })
        .catch((error) => {
          console.error("画像読み込みエラー:", error)
          setIsImageLoading(false)
        })
    }
  }, [file, imagePreview, isImageLoading])

  // 氏名欄プレビューの生成
  useEffect(() => {
    if (previewMode === "name-only" && nameRegionAvailable && imagePreview) {
      setIsNameRegionLoading(true)
      // imagePreviewを使用して氏名欄を描画
      const tempFile = { ...file, preview: imagePreview }
      drawNameRegionCanvas(tempFile, pageNumber)
        .then((canvas) => {
          setNameRegionPreview(canvas)
          setIsNameRegionLoading(false)
        })
        .catch((error) => {
          console.error("氏名欄プレビュー生成エラー:", error)
          setIsNameRegionLoading(false)
        })
    }
  }, [
    file,
    pageNumber,
    previewMode,
    nameRegionAvailable,
    drawNameRegionCanvas,
    imagePreview,
  ])

  // 画像プレビューの表示
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
            {/* デバッグ用オーバーレイ（開発環境のみ） */}
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

    // フルプレビューまたは氏名欄が利用できない場合
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

  // 読み込み状態インジケーター
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
      {/* 画像プレビュー */}
      <div
        className={`h-full w-full ${isFileDisabled ? "opacity-50 grayscale" : ""}`}
      >
        {renderImagePreview()}
      </div>

      {/* 変更予定オーバーレイ（赤色） */}
      {isPendingChange && (
        <div className="pointer-events-none absolute inset-0 z-40 animate-pulse border-4 border-red-500 bg-red-500/30" />
      )}

      {/* 既存答案警告オーバーレイ（上書きオン時のみ表示） */}
      {hasExistingAnswer && allowOverwrite && (
        <div className="pointer-events-none absolute inset-0 z-30 border-2 border-orange-500 bg-orange-500/20" />
      )}

      {/* 読み込み状態表示 */}
      {renderLoadingState()}
    </div>
  )
}
