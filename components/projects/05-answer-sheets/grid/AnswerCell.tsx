"use client"

import { useState, useEffect } from "react"
import { TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  FileImage,
  Upload,
  X,
  SkipForward,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"

interface ConvertedFile {
  id: string
  name: string
  type: string
  size: number
  preview?: string
  studentId?: string
  pageNumber: number
  isSelected: boolean
  pageLabel?: string
  buffer: ArrayBuffer
  originalFileName: string
}

interface AnswerCellProps {
  cellId: string
  pageNumber: number
  studentId: string
  file?: ConvertedFile
  isEnabled: boolean
  isSkipped: boolean
  isFileDisabled: boolean
  isStudentDisabled: boolean
  isPageDisabled: boolean
  nameRegion?: { x: number; y: number; width: number; height: number } | null
  globalPreviewMode?: "full" | "name"
  onToggle: () => void
  onToggleFileDisabled: () => void
  onRemoveFile: () => void
}

export default function AnswerCell({
  cellId,
  pageNumber,
  studentId,
  file,
  isEnabled,
  isSkipped,
  isFileDisabled,
  isStudentDisabled,
  isPageDisabled,
  nameRegion,
  globalPreviewMode = "full",
  onToggle,
  onToggleFileDisabled,
  onRemoveFile,
}: AnswerCellProps) {
  // useSortable フック
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: cellId,
    disabled:
      isStudentDisabled || isPageDisabled || isSkipped || !isEnabled || !file, // ファイルがない場合や無効な場合はドラッグ無効
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // 氏名欄クロップ画像の生成
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null)
  const [isImageLoading, setIsImageLoading] = useState(false)
  const [isCroppedImageLoading, setIsCroppedImageLoading] = useState(false)

  useEffect(() => {
    if (!file?.preview || !nameRegion || globalPreviewMode !== "name") {
      setCroppedImageUrl(null)
      return
    }

    const createCroppedImage = async () => {
      setIsCroppedImageLoading(true)
      try {
        const img = new Image()
        img.crossOrigin = "anonymous"

        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = file.preview!
        })

        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        // クロップ領域のサイズ計算
        const cropX = nameRegion.x * img.naturalWidth
        const cropY = nameRegion.y * img.naturalHeight
        const cropWidth = nameRegion.width * img.naturalWidth
        const cropHeight = nameRegion.height * img.naturalHeight

        canvas.width = cropWidth
        canvas.height = cropHeight

        // クロップ部分を描画
        ctx.drawImage(
          img,
          cropX,
          cropY,
          cropWidth,
          cropHeight, // ソース
          0,
          0,
          cropWidth,
          cropHeight, // ターゲット
        )

        const croppedUrl = canvas.toDataURL("image/png")
        setCroppedImageUrl(croppedUrl)
      } catch (error) {
        setCroppedImageUrl(null)
      } finally {
        setIsCroppedImageLoading(false)
      }
    }

    createCroppedImage()
  }, [file?.preview, nameRegion, globalPreviewMode])

  // セルの状態を判定
  const getCellStatus = () => {
    if (isStudentDisabled) return "student-disabled"
    if (isPageDisabled) return "page-disabled"
    if (isSkipped) return "skipped"
    if (!isEnabled) return "disabled"
    if (file && isFileDisabled) return "file-disabled"
    if (file) return "filled"
    return "empty"
  }

  const cellStatus = getCellStatus()

  // セルの背景色とスタイル
  const getCellStyle = () => {
    switch (cellStatus) {
      case "student-disabled":
        return "bg-red-50 border border-red-200"
      case "page-disabled":
        return "bg-orange-50 border border-orange-200"
      case "skipped":
        return "bg-gray-100 border border-gray-300"
      case "disabled":
        return "bg-muted border border-muted-foreground/20"
      case "file-disabled":
        return "bg-yellow-50 border border-yellow-300"
      case "filled":
        return "bg-green-50 border border-green-200"
      case "empty":
      default:
        return "bg-background border border-border hover:bg-muted/50"
    }
  }

  // セルの状態アイコン
  const getStatusIcon = () => {
    switch (cellStatus) {
      case "student-disabled":
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case "page-disabled":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      case "skipped":
        return <SkipForward className="h-4 w-4 text-gray-500" />
      case "file-disabled":
        return <X className="h-4 w-4 text-yellow-600" />
      case "filled":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "empty":
      default:
        return <Upload className="text-muted-foreground h-4 w-4" />
    }
  }

  // セルの状態テキスト
  const getStatusText = () => {
    switch (cellStatus) {
      case "student-disabled":
        return "生徒無効"
      case "page-disabled":
        return "ページ無効"
      case "skipped":
        return "スキップ"
      case "file-disabled":
        return "ファイル無効"
      case "filled":
        return "配置済み"
      case "empty":
      default:
        return "空き"
    }
  }

  // オーバーレイメッセージを取得（セルのみ「答案を読み込みません」を表示）
  const getOverlayMessage = () => {
    if (isStudentDisabled || isPageDisabled) return null // 生徒・ページ無効時はオーバーレイなし
    if (isSkipped || !isEnabled) return "答案を読み込みません"
    return null
  }

  const overlayMessage = getOverlayMessage()

  // Alt+クリック処理
  const handleClick = (e: React.MouseEvent) => {
    if (e.altKey && !isStudentDisabled && !isPageDisabled) {
      onToggle()
    }
  }

  return (
    <TableCell
      ref={setNodeRef}
      style={style}
      className={`border-border relative min-w-32 border-r text-center ${getCellStyle()} hover:bg-muted/50 transition-colors ${file && !isStudentDisabled && !isPageDisabled ? "cursor-grab" : "cursor-default"} `}
      onClick={handleClick}
      {...attributes}
    >
      <div className={`flex flex-col items-center ${globalPreviewMode === "name" ? "h-full p-0" : "h-32 gap-1"}`}>
        {/* ホバー時のツールチップ */}
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-transparent opacity-0 transition-opacity hover:opacity-100">
          <div className="text-center text-xs font-medium text-slate-800">
            {isStudentDisabled
              ? "生徒が無効です"
              : isPageDisabled
                ? "ページが無効です"
                : overlayMessage
                  ? "Alt+クリックして表示"
                  : "ドラッグして移動、Alt+クリックで除外"}
          </div>
        </div>

        {/* オーバーレイ表示（セルのみ） */}
        {overlayMessage && (
          <div className="bg-opacity-50 absolute inset-0 z-10 flex items-center justify-center bg-black">
            <div className="text-xs font-medium text-slate-800">
              {overlayMessage}
            </div>
          </div>
        )}

        {/* 答案画像表示 */}
        {file && (
          <div className="flex flex-col items-center gap-1">
            {/* デバッグ: ファイルID表示 */}
            {globalPreviewMode !== "name" && (
              <div className="rounded bg-blue-50 px-1 font-mono text-xs text-blue-600">
                {file.id.split("-")[0].slice(0, 8)}
              </div>
            )}

            {/* 画像プレビュー */}
            <div className="relative w-full h-full">
              {file.preview ? (
                <div
                  className={`relative z-30 w-full overflow-hidden bg-gray-50 ${
                    globalPreviewMode === "name" ? "h-full rounded-none border-0" : "h-24 rounded border"
                  }`}
                  {...listeners}
                >
                  {/* ローディング表示 */}
                  {(isImageLoading || isCroppedImageLoading) && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500"></div>
                        <div className="text-xs text-gray-500">
                          {isCroppedImageLoading ? "氏名欄生成中..." : "読み込み中..."}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {globalPreviewMode === "name" &&
                  nameRegion &&
                  croppedImageUrl ? (
                    <img
                      src={croppedImageUrl}
                      alt="氏名欄"
                      className="h-full w-full object-cover"
                    />
                  ) : file.preview ? (
                    <img
                      src={file.preview}
                      alt={`${pageNumber}ページ目`}
                      className="h-full w-full object-contain"
                      onLoad={() => setIsImageLoading(false)}
                      onLoadStart={() => setIsImageLoading(true)}
                      onError={() => setIsImageLoading(false)}
                    />
                  ) : (
                    <div className="text-center text-gray-500">
                      <div className="flex flex-col items-center gap-1">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500"></div>
                        <div className="text-xs">読み込み中...</div>
                      </div>
                    </div>
                  )}
                  {globalPreviewMode === "name" && !nameRegion && (
                    <div className="bg-opacity-70 absolute inset-0 flex items-center justify-center bg-black">
                      <div className="text-center text-white">
                        <AlertTriangle className="mx-auto mb-1 h-4 w-4" />
                        <p className="text-xs">氏名欄なし</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-24 w-full items-center justify-center rounded border bg-gray-100">
                  <FileImage className="h-6 w-6 text-gray-400" />
                </div>
              )}
              {file.preview && (
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute top-1 right-1 z-10 h-4 w-4"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveFile()
                  }}
                >
                  <X className="h-2 w-2" />
                </Button>
              )}
            </div>

            {/* ファイル名 */}
            {globalPreviewMode !== "name" && (
              <div className="w-full px-1 text-center text-xs">
                <div className="truncate font-medium">
                  {file.originalFileName}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ファイルがない場合の表示 */}
        {!file && (
          <div className="flex flex-col items-center gap-1">
            {getStatusIcon()}
            <span className="text-muted-foreground text-xs">
              {getStatusText()}
            </span>
          </div>
        )}
      </div>
    </TableCell>
  )
}
