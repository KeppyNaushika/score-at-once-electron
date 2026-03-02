"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  AlertTriangle,
  CheckCircle2,
  FileImage,
  SkipForward,
  Upload,
  X,
} from "lucide-react"
import Image from "next/image"
import { useState } from "react"

import type { AnswerCellProps } from "@/components/exams/06-student-answers/student-answer-management/types"
import { Button } from "@/components/ui/button"
import { TableCell } from "@/components/ui/table"

export function AnswerCell({
  student,
  pageNumber,
  file,
  isStudentDisabled,
  isPageDisabled,
  isFileDisabled,
  onToggleFile,
  onRemoveFile,
  onCellClick,
  className = "",
}: AnswerCellProps) {
  const [imageError, setImageError] = useState(false)

  const cellId = `${student?.id || "unknown"}-${pageNumber}`
  const isDisabled = isStudentDisabled || isPageDisabled

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: file?.id || cellId,
    disabled: !file || isFileDisabled || isDisabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // セルの状態を取得
  const getCellStatus = () => {
    if (isDisabled) return "disabled"
    if (!file) return "empty"
    if (isFileDisabled) return "file-disabled"
    return "active"
  }

  const cellStatus = getCellStatus()

  // セルスタイルを取得
  const getCellStyle = () => {
    switch (cellStatus) {
      case "disabled":
        return "bg-muted/80 text-muted-foreground"
      case "file-disabled":
        return "bg-red-50 border-red-200"
      case "active":
        return "bg-background hover:bg-muted/50"
      case "empty":
      default:
        return "bg-background hover:bg-blue-50 border-dashed"
    }
  }

  // ステータスアイコンを取得
  const getStatusIcon = () => {
    switch (cellStatus) {
      case "disabled":
        return <SkipForward className="text-muted-foreground h-4 w-4" />
      case "file-disabled":
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case "active":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "empty":
      default:
        return <Upload className="h-4 w-4 text-blue-500" />
    }
  }

  return (
    <TableCell
      ref={setNodeRef}
      style={style}
      className={`border-border relative h-32 min-w-32 cursor-pointer border-r p-1 transition-all ${getCellStyle()} ${file && !isFileDisabled && !isDisabled ? "cursor-grab active:cursor-grabbing" : ""} ${className} `}
      onClick={() => onCellClick?.()}
      {...attributes}
      {...listeners}
    >
      {/* ファイルプレビュー */}
      {file && (
        <div className="relative h-full w-full">
          {/* 画像プレビュー */}
          {file.preview && !imageError ? (
            <Image
              src={file.preview}
              alt={file.name}
              className="h-full w-full rounded object-contain"
              onError={() => setImageError(true)}
              width={200}
              height={200}
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FileImage className="h-8 w-8 text-gray-400" />
            </div>
          )}

          {/* ファイル情報オーバーレイ */}
          <div className="absolute right-0 bottom-0 left-0 bg-black/70 p-1 text-white">
            <div className="truncate text-xs" title={file.name}>
              {file.name.split(" - ページ")[0] || file.name}
            </div>
          </div>

          {/* ステータスバッジ */}
          <div className="absolute top-1 right-1">{getStatusIcon()}</div>

          {/* ファイル操作ボタン */}
          {cellStatus === "active" && (
            <div className="absolute top-1 left-1 flex gap-1">
              {onToggleFile && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 bg-white/80 p-0 hover:bg-white"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleFile()
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              {onRemoveFile && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 bg-white/80 p-0 hover:bg-white"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveFile()
                  }}
                >
                  <AlertTriangle className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 空セル表示 */}
      {!file && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2">
          {getStatusIcon()}
          <div className="text-center">
            <div className="text-xs font-medium">
              {cellStatus === "disabled" ? "除外" : "空"}
            </div>
            <div className="text-muted-foreground text-xs">
              {student?.lastName} {student?.firstName}
            </div>
            <div className="text-muted-foreground text-xs">P{pageNumber}</div>
          </div>
        </div>
      )}

      {/* セル操作ツールチップ */}
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-transparent opacity-0 transition-opacity hover:opacity-100">
        <div className="rounded bg-white/90 px-2 py-1 text-xs font-medium text-slate-800">
          {cellStatus === "disabled"
            ? "クリックしてセルを有効化"
            : "クリックしてセルを無効化"}
        </div>
      </div>
    </TableCell>
  )
}
