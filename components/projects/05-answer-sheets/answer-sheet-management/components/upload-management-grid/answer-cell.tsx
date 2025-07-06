"use client"

import { useState } from "react"
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

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TableCell } from "@/components/ui/table"
import type { AnswerCellProps } from "@/components/projects/05-answer-sheets/answer-sheet-management/types"

export function AnswerCell({
  student,
  pageNumber,
  file,
  isStudentDisabled,
  isPageDisabled,
  isCellDisabled,
  isFileDisabled,
  onToggleCell,
  onToggleFile,
  onRemoveFile,
  onCellClick,
  className = "",
}: AnswerCellProps) {
  const [imageError, setImageError] = useState(false)
  
  const cellId = `${student?.id || 'unknown'}-${pageNumber}`
  const isDisabled = isStudentDisabled || isPageDisabled || isCellDisabled

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
        return <SkipForward className="h-4 w-4 text-muted-foreground" />
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
      className={`
        relative min-w-32 h-32 border-r border-border p-1 transition-all cursor-pointer
        ${getCellStyle()}
        ${file && !isFileDisabled && !isDisabled ? "cursor-grab active:cursor-grabbing" : ""}
        ${className}
      `}
      onClick={() => onCellClick?.()} 
      {...attributes}
      {...listeners}
    >
      {/* ファイルプレビュー */}
      {file && (
        <div className="relative h-full w-full">
          {/* 画像プレビュー */}
          {file.preview && !imageError ? (
            <img
              src={file.preview}
              alt={file.name}
              className="h-full w-full object-contain rounded"
              onError={() => setImageError(true)}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FileImage className="h-8 w-8 text-gray-400" />
            </div>
          )}

          {/* ファイル情報オーバーレイ */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-1">
            <div className="text-xs truncate" title={file.name}>
              {file.name.split(' - ページ')[0] || file.name}
            </div>
          </div>

          {/* ステータスバッジ */}
          <div className="absolute top-1 right-1">
            {getStatusIcon()}
          </div>

          {/* ファイル操作ボタン */}
          {cellStatus === "active" && (
            <div className="absolute top-1 left-1 flex gap-1">
              {onToggleFile && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 bg-white/80 hover:bg-white"
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
                  className="h-6 w-6 p-0 bg-white/80 hover:bg-white"
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
            <div className="text-xs text-muted-foreground">
              {student?.lastName} {student?.firstName}
            </div>
            <div className="text-xs text-muted-foreground">
              P{pageNumber}
            </div>
          </div>
        </div>
      )}

      {/* セル操作ツールチップ */}
      <div className="absolute inset-0 bg-transparent opacity-0 hover:opacity-100 transition-opacity z-20 flex items-center justify-center">
        <div className="text-slate-800 text-xs font-medium bg-white/90 px-2 py-1 rounded">
          {cellStatus === "disabled" ? "クリックしてセルを有効化" : "クリックしてセルを無効化"}
        </div>
      </div>
    </TableCell>
  )
}