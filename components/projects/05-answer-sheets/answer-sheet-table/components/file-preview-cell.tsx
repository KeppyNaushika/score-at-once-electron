"use client"

import type { FilePreviewCellProps } from "@/components/projects/05-answer-sheets/answer-sheet-table/types"
import { loadAnswerSheetImage } from "@/components/projects/05-answer-sheets/answer-sheet-management/utils/convertAnswerSheetsToFiles"
import { CheckCircle, FileImage, Loader2, XCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"

export function FilePreviewCell({
  file,
  pageNumber,
  previewMode,
  isFileDisabled,
  nameRegionAvailable,
  getFileColor,
  drawNameRegionCanvas,
  imageLoadState = "pending",
  isPendingChange = false,
}: FilePreviewCellProps & {
  isPendingChange?: boolean
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
    if (previewMode === "name-only" && nameRegionAvailable) {
      if (isNameRegionLoading) {
        return (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )
      }

      if (nameRegionPreview) {
        return (
          <img
            src={nameRegionPreview}
            alt={`${file.name} - 氏名欄`}
            className="h-full w-full object-contain"
            loading="lazy"
          />
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
        <img
          ref={imgRef}
          src={imagePreview}
          alt={file.name}
          className="h-full w-full object-contain"
          loading="lazy"
        />
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

      {/* 変更予定オーバーレイ */}
      {isPendingChange && (
        <div className="absolute inset-0 bg-red-500 opacity-10 pointer-events-none" />
      )}

      {/* 読み込み状態表示 */}
      {renderLoadingState()}
    </div>
  )
}
