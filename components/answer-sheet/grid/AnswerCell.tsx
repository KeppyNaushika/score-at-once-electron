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
      text-center min-w-32 border-r border-border p-2
      ${getCellStyle()}
      transition-colors
    `}>
      <div className="flex flex-col items-center gap-2 min-h-24">
        {/* 答案画像または状態表示 */}
        {file ? (
          <div className="flex flex-col items-center gap-2">
            {/* 画像プレビューまたはファイル情報 */}
            {file.preview ? (
              <div className="relative">
                <img 
                  src={file.preview} 
                  alt={`${pageNumber}ページ目`}
                  className="w-16 h-20 object-cover rounded border"
                />
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute -top-1 -right-1 h-5 w-5"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveFile()
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <FileImage className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground truncate max-w-20">
                  {file.name}
                </span>
              </div>
            )}
            
            {/* ファイル情報 */}
            <div className="text-xs text-center">
              <div className="font-medium truncate max-w-24">
                {file.originalFileName}
              </div>
              <div className="text-muted-foreground">
                {Math.round(file.size / 1024)}KB
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {getStatusIcon()}
            <span className="text-xs text-muted-foreground">
              {getStatusText()}
            </span>
          </div>
        )}
        
        {/* セル制御ボタン */}
        <div className="flex flex-wrap items-center gap-1 justify-center">
          {/* セル有効/無効切り替え */}
          {!isStudentDisabled && !isPageDisabled && (
            <Button
              size="sm"
              variant={isEnabled && !isSkipped ? "default" : "outline"}
              onClick={onToggle}
              className="h-6 px-2 text-xs"
            >
              {isEnabled && !isSkipped ? "有効" : "無効"}
            </Button>
          )}
          
          {/* ファイル無効化切り替え */}
          {file && !isStudentDisabled && !isPageDisabled && (
            <Button
              size="sm"
              variant={isFileDisabled ? "destructive" : "outline"}
              onClick={onToggleFileDisabled}
              className="h-6 px-2 text-xs"
            >
              {isFileDisabled ? "無効" : "有効"}
            </Button>
          )}
          
          {/* プレビューボタン */}
          {file && (
            <Button
              size="icon"
              variant="outline"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation()
                // TODO: プレビュー表示
                console.log('Preview file:', file.name)
              }}
            >
              <Eye className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {/* 状態バッジ */}
        <div className="flex flex-wrap gap-1 justify-center">
          {cellStatus === 'skipped' && (
            <Badge variant="secondary" className="text-xs px-1 py-0">
              スキップ
            </Badge>
          )}
          {cellStatus === 'file-disabled' && (
            <Badge variant="destructive" className="text-xs px-1 py-0">
              ファイル無効
            </Badge>
          )}
          {isStudentDisabled && (
            <Badge variant="destructive" className="text-xs px-1 py-0">
              生徒無効
            </Badge>
          )}
          {isPageDisabled && (
            <Badge variant="secondary" className="text-xs px-1 py-0">
              ページ無効
            </Badge>
          )}
        </div>
      </div>
    </TableCell>
  )
}