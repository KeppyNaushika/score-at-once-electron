"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ChevronDown,
  ChevronUp,
  FileText,
  GripVertical,
  Image as ImageIcon,
  X,
} from "lucide-react"
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
}

interface LayoutRegion {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  label: string
  masterImageId?: string | null
}

interface MasterImage {
  id: string
  pageNumber: number
  path: string
}

interface SortableFileItemProps {
  file: ConvertedFile
  index: number
  files: ConvertedFile[]
  layoutRegions: LayoutRegion[]
  masterImages: MasterImage[]
  isUploading: boolean
  getStudentName: (studentId?: string) => string
  onToggleFileSelection: (id: string) => void
  onMoveFile: (id: string, direction: "up" | "down") => void
  onRemoveFile: (id: string) => void
}

export default function SortableFileItem({
  file,
  index,
  files,
  layoutRegions,
  masterImages,
  isUploading,
  getStudentName,
  onToggleFileSelection,
  onMoveFile,
  onRemoveFile,
}: SortableFileItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const targetMasterImage = masterImages.find(
    img => img.pageNumber === file.pageNumber
  )

  const nameRegionsForPage = layoutRegions.filter(region =>
    region.type === 'STUDENT_NAME' &&
    region.masterImageId === targetMasterImage?.id
  )

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
        file.isSelected
          ? "bg-primary/5 border-primary/20"
          : "hover:bg-muted/50"
      } ${isDragging ? "shadow-lg" : ""}`}
    >
      {/* ドラッグハンドル */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* 選択チェックボックス */}
      <Checkbox
        checked={file.isSelected}
        onCheckedChange={() => onToggleFileSelection(file.id)}
        disabled={isUploading}
      />

      {/* プレビュー画像（氏名枠表示付き） */}
      <div className="flex-shrink-0 relative">
        {file.preview ? (
          <div className="relative">
            <img
              src={file.preview}
              alt={file.name}
              className="h-16 w-16 rounded border object-cover"
            />
            {/* 氏名枠オーバーレイ */}
            {nameRegionsForPage.length > 0 ? (
              nameRegionsForPage.map(region => (
                <div
                  key={region.id}
                  className="absolute border-2 border-green-500 bg-green-500/20"
                  style={{
                    left: `${region.x * 100}%`,
                    top: `${region.y * 100}%`,
                    width: `${region.width * 100}%`,
                    height: `${region.height * 100}%`,
                  }}
                  title={`ページ${file.pageNumber}: ${region.label}`}
                >
                  <div className="absolute -top-4 left-0 text-xs bg-green-500 text-white px-1 rounded text-[8px]">
                    {region.label}
                  </div>
                </div>
              ))
            ) : (
              <div
                className="absolute inset-0 border border-gray-400 bg-gray-400/5"
                title={`ページ${file.pageNumber}: 氏名領域未設定`}
              >
                <div className="absolute -top-4 left-0 text-xs bg-gray-500 text-white px-1 rounded text-[8px]">
                  氏名枠なし
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded border">
            {file.type.startsWith("image/") ? (
              <ImageIcon className="text-muted-foreground h-8 w-8" />
            ) : (
              <FileText className="text-muted-foreground h-8 w-8" />
            )}
          </div>
        )}
      </div>

      {/* ファイル情報 */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {file.pageLabel || file.name}
        </p>
        <p className="text-muted-foreground text-xs">
          {(file.size / 1024 / 1024).toFixed(2)} MB ・ ページ{file.pageNumber}
        </p>
        {file.studentId && (
          <p className="text-sm text-blue-600 font-medium">
            → {getStudentName(file.studentId)}
          </p>
        )}
      </div>

      {/* 上下移動ボタン */}
      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => onMoveFile(file.id, "up")}
          disabled={isUploading || index === 0}
          title="上に移動"
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => onMoveFile(file.id, "down")}
          disabled={isUploading || index === files.length - 1}
          title="下に移動"
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>

      {/* 削除ボタン */}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={() => onRemoveFile(file.id)}
        disabled={isUploading}
        title="削除"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}