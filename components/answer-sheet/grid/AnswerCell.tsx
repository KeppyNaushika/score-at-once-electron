"use client"

import { TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  FileImage, 
  Upload, 
  X, 
  Eye, 
  SkipForward,
  AlertTriangle,
  CheckCircle2
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
  pageNumber: number
  studentId: string
  file?: ConvertedFile
  isEnabled: boolean
  isSkipped: boolean
  isFileDisabled: boolean
  isStudentDisabled: boolean
  isPageDisabled: boolean
  onToggle: () => void
  onToggleFileDisabled: () => void
  onRemoveFile: () => void
}

export default function AnswerCell({
  pageNumber,
  studentId,
  file,
  isEnabled,
  isSkipped,
  isFileDisabled,
  isStudentDisabled,
  isPageDisabled,
  onToggle,
  onToggleFileDisabled,
  onRemoveFile
}: AnswerCellProps) {
  
  // セルの状態を判定
  const getCellStatus = () => {
    if (isStudentDisabled) return 'student-disabled'
    if (isPageDisabled) return 'page-disabled'
    if (isSkipped) return 'skipped'
    if (!isEnabled) return 'disabled'
    if (file && isFileDisabled) return 'file-disabled'
    if (file) return 'filled'
    return 'empty'
  }
  
  const cellStatus = getCellStatus()
  
  // セルの背景色とスタイル
  const getCellStyle = () => {
    switch (cellStatus) {
      case 'student-disabled':
        return 'bg-red-50 border border-red-200'
      case 'page-disabled':
        return 'bg-orange-50 border border-orange-200'
      case 'skipped':
        return 'bg-gray-100 border border-gray-300'
      case 'disabled':
        return 'bg-muted border border-muted-foreground/20'
      case 'file-disabled':
        return 'bg-yellow-50 border border-yellow-300'
      case 'filled':
        return 'bg-green-50 border border-green-200'
      case 'empty':
      default:
        return 'bg-background border border-border hover:bg-muted/50'
    }
  }
  
  // セルの状態アイコン
  const getStatusIcon = () => {
    switch (cellStatus) {
      case 'student-disabled':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'page-disabled':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      case 'skipped':
        return <SkipForward className="h-4 w-4 text-gray-500" />
      case 'file-disabled':
        return <X className="h-4 w-4 text-yellow-600" />
      case 'filled':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'empty':
      default:
        return <Upload className="h-4 w-4 text-muted-foreground" />
    }
  }
  
  // セルの状態テキスト
  const getStatusText = () => {
    switch (cellStatus) {
      case 'student-disabled':
        return '生徒無効'
      case 'page-disabled':
        return 'ページ無効'
      case 'skipped':
        return 'スキップ'
      case 'file-disabled':
        return 'ファイル無効'
      case 'filled':
        return '配置済み'
      case 'empty':
      default:
        return '空き'
    }
  }

  return (
    <TableCell className={`
      text-center min-w-32 border-r border-border p-1
      ${getCellStyle()}
      transition-colors
    `}>
      <div className="flex flex-col items-center gap-1 min-h-20">
        {/* 配置チェックボックス */}
        {!isStudentDisabled && !isPageDisabled && (
          <div className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={isEnabled && !isSkipped}
              onChange={onToggle}
              className="h-3 w-3"
            />
            <span className="text-xs">配置</span>
          </div>
        )}
        
        {/* 答案画像表示 */}
        {file && (
          <div className="flex flex-col items-center gap-1">
            {/* 画像プレビュー */}
            <div className="relative">
              {file.preview ? (
                <img 
                  src={file.preview} 
                  alt={`${pageNumber}ページ目`}
                  className="w-16 h-20 object-cover rounded border"
                />
              ) : (
                <div className="w-16 h-20 bg-gray-100 rounded border flex items-center justify-center">
                  <FileImage className="h-6 w-6 text-gray-400" />
                </div>
              )}
              <Button
                size="icon"
                variant="secondary"
                className="absolute -top-1 -right-1 h-4 w-4"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveFile()
                }}
              >
                <X className="h-2 w-2" />
              </Button>
            </div>
            
            {/* ファイル名 */}
            <div className="text-xs text-center max-w-20">
              <div className="font-medium truncate">
                {file.originalFileName}
              </div>
            </div>
            
            {/* ファイル無効化チェック */}
            {!isStudentDisabled && !isPageDisabled && (
              <div className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={!isFileDisabled}
                  onChange={onToggleFileDisabled}
                  className="h-3 w-3"
                />
                <span className="text-xs">有効</span>
              </div>
            )}
          </div>
        )}
        
        {/* ファイルがない場合の表示 */}
        {!file && (
          <div className="flex flex-col items-center gap-1">
            {getStatusIcon()}
            <span className="text-xs text-muted-foreground">
              {getStatusText()}
            </span>
          </div>
        )}
      </div>
    </TableCell>
  )
}