"use client"

import { Badge } from "@/components/ui/badge"
import { User } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { FilePreviewCellProps } from "../types"

export function FilePreviewCell({
  file,
  pageNumber,
  previewMode,
  isFileDisabled,
  nameRegionAvailable,
  getFileColor,
  drawNameRegionCanvas,
  imageLoadState,
}: FilePreviewCellProps) {
  const [nameClipUrl, setNameClipUrl] = useState<string | null>(null)
  const [isImageLoading, setIsImageLoading] = useState(false)

  // 氏名欄クリッピング画像の生成
  useEffect(() => {
    const generateNameClip = async () => {
      if (
        previewMode === "name" &&
        nameRegionAvailable &&
        file.preview &&
        !nameClipUrl
      ) {
        try {
          const clipUrl = await drawNameRegionCanvas(file, pageNumber)
          setNameClipUrl(clipUrl)
        } catch (error) {
          console.error("氏名欄クリッピングエラー:", error)
        }
      }
    }

    generateNameClip()
  }, [
    previewMode,
    nameRegionAvailable,
    file.preview,
    nameClipUrl,
    drawNameRegionCanvas,
    file,
    pageNumber,
  ])

  // 表示用プレビューURLの決定
  const displayPreviewUrl = useMemo(() => {
    if (previewMode === "name" && nameRegionAvailable && nameClipUrl) {
      return nameClipUrl
    }
    return file.preview
  }, [previewMode, nameRegionAvailable, nameClipUrl, file.preview])

  // ローディング状態の表示
  if (imageLoadState === "loading" || isImageLoading) {
    return (
      <div className="flex h-24 w-full items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
          <span className="text-xs text-gray-500">読み込み中...</span>
        </div>
      </div>
    )
  }

  // エラー状態の表示
  if (imageLoadState === "error") {
    return (
      <div className="flex h-24 w-full items-center justify-center bg-red-50">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-red-600">読み込みエラー</span>
          <span className="text-xs text-gray-500">{file.name}</span>
        </div>
      </div>
    )
  }

  // プレビュー画像がない場合
  if (!displayPreviewUrl) {
    return (
      <div className="flex h-24 w-full items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-gray-500">画像なし</span>
          <span className="text-xs text-gray-400">{file.name}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`group relative flex flex-col gap-2 p-2 transition-opacity ${
        isFileDisabled ? "opacity-50" : ""
      }`}
    >
      {/* ファイル情報バッジ */}
      <div className="flex items-center justify-between">
        <div
          className={`h-4 w-4 rounded ${getFileColor(file)} flex-shrink-0`}
        />
        <Badge variant="secondary" className="text-xs">
          P{pageNumber}
        </Badge>
      </div>

      {/* プレビュー画像 */}
      <div className="relative">
        <img
          src={displayPreviewUrl}
          alt={file.name}
          className="h-20 w-full rounded object-contain"
          onLoadStart={() => setIsImageLoading(true)}
          onLoad={() => setIsImageLoading(false)}
          onError={() => setIsImageLoading(false)}
        />

        {/* プレビューモード表示 */}
        {previewMode === "name" && nameRegionAvailable && (
          <div className="absolute right-1 bottom-1">
            <User className="h-3 w-3 text-blue-500" />
          </div>
        )}
      </div>

      {/* ファイル名 */}
      <div className="text-center">
        <div className="truncate text-xs font-medium">
          {file.name.split(" - ページ")[0] || file.name}
        </div>
        <div className="text-xs text-gray-500">
          {(file.size / 1024).toFixed(1)}KB
        </div>
      </div>

      {/* 無効化状態のオーバーレイ */}
      {isFileDisabled && (
        <div className="absolute inset-0 flex items-center justify-center rounded bg-red-500/20">
          <span className="text-xs font-medium text-red-600">無効</span>
        </div>
      )}
    </div>
  )
}
