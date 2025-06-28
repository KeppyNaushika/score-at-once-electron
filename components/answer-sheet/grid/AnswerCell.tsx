"use client"

import { useState, useEffect } from "react"
import { TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { 
  FileImage, 
  Upload, 
  X, 
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
  cellId: string
  pageNumber: number
  studentId: string
  file?: ConvertedFile
  isEnabled: boolean
  isSkipped: boolean
  isFileDisabled: boolean
  isStudentDisabled: boolean
  isPageDisabled: boolean
  nameRegion?: { x: number, y: number, width: number, height: number } | null
  globalPreviewMode?: 'full' | 'name'
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
  globalPreviewMode = 'full',
  onToggle,
  onToggleFileDisabled,
  onRemoveFile
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
    disabled: isStudentDisabled || isPageDisabled || isSkipped || !isEnabled || !file // ファイルがない場合や無効な場合はドラッグ無効
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  
  // 氏名欄クロップ画像の生成
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null)
  
  useEffect(() => {
    if (!file?.preview || !nameRegion || globalPreviewMode !== 'name') {
      setCroppedImageUrl(null)
      return
    }
    
    const createCroppedImage = async () => {
      try {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = file.preview!
        })
        
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
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
          cropX, cropY, cropWidth, cropHeight,  // ソース
          0, 0, cropWidth, cropHeight           // ターゲット
        )
        
        const croppedUrl = canvas.toDataURL('image/png')
        setCroppedImageUrl(croppedUrl)
      } catch (error) {
        console.error('Failed to create cropped image:', error)
        setCroppedImageUrl(null)
      }
    }
    
    createCroppedImage()
  }, [file?.preview, nameRegion, globalPreviewMode])
  
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

  // オーバーレイメッセージを取得（セルのみ「答案を読み込みません」を表示）
  const getOverlayMessage = () => {
    if (isStudentDisabled || isPageDisabled) return null // 生徒・ページ無効時はオーバーレイなし
    if (isSkipped || !isEnabled) return '答案を読み込みません'
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
      className={`
        text-center min-w-32 border-r border-border p-1 relative
        ${getCellStyle()}
        transition-colors hover:bg-muted/50
        ${file && !isStudentDisabled && !isPageDisabled ? 'cursor-grab' : 'cursor-default'}
      `}
      onClick={handleClick}
      {...attributes}
    >
      <div className="flex flex-col items-center gap-1 min-h-20">
        {/* ホバー時のツールチップ */}
        <div className="absolute inset-0 bg-transparent opacity-0 hover:opacity-100 transition-opacity z-20 flex items-center justify-center pointer-events-none">
          <div className="text-slate-800 text-xs font-medium text-center">
            {isStudentDisabled ? '生徒が無効です' : 
             isPageDisabled ? 'ページが無効です' : 
             (overlayMessage ? 'Alt+クリックして表示' : 'ドラッグして移動、Alt+クリックで除外')}
          </div>
        </div>

        {/* オーバーレイ表示（セルのみ） */}
        {overlayMessage && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
            <div className="text-slate-800 text-xs font-medium">
              {overlayMessage}
            </div>
          </div>
        )}
        
        {/* 答案画像表示 */}
        {file && (
          <div className="flex flex-col items-center gap-1">
            {/* デバッグ: ファイルID表示 */}
            <div className="text-xs font-mono text-blue-600 bg-blue-50 px-1 rounded">
              {file.id.split('-')[0].slice(0, 8)}
            </div>
            
            {/* 画像プレビュー */}
            <div className="relative w-full">
              {file.preview ? (
                <div 
                  className="relative w-full h-24 rounded border overflow-hidden bg-gray-50 z-30"
                  {...listeners}
                >
                  {globalPreviewMode === 'name' && nameRegion && croppedImageUrl ? (
                    <img 
                      src={croppedImageUrl} 
                      alt="氏名欄"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <img 
                      src={file.preview} 
                      alt={`${pageNumber}ページ目`}
                      className="w-full h-full object-contain"
                    />
                  )}
                  {globalPreviewMode === 'name' && !nameRegion && (
                    <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
                      <div className="text-white text-center">
                        <AlertTriangle className="h-4 w-4 mx-auto mb-1" />
                        <p className="text-xs">氏名欄なし</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-24 bg-gray-100 rounded border flex items-center justify-center">
                  <FileImage className="h-6 w-6 text-gray-400" />
                </div>
              )}
              {file.preview && (
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute top-1 right-1 h-4 w-4 z-10"
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
            <div className="text-xs text-center w-full px-1">
              <div className="font-medium truncate">
                {file.originalFileName}
              </div>
            </div>
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