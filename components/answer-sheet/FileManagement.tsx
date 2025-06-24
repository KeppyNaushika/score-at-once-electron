"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import SortableFileItem from './SortableFileItem'

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

interface FileManagementProps {
  files: ConvertedFile[]
  selectedFilesCount: number
  maxPages: number
  layoutRegions: LayoutRegion[]
  masterImages: MasterImage[]
  isUploading: boolean
  getStudentName: (studentId?: string) => string
  onToggleFileSelection: (id: string) => void
  onMoveFile: (id: string, direction: "up" | "down") => void
  onRemoveFile: (id: string) => void
  onDragEnd: (event: DragEndEvent) => void
}

export default function FileManagement({
  files,
  selectedFilesCount,
  maxPages,
  layoutRegions,
  masterImages,
  isUploading,
  getStudentName,
  onToggleFileSelection,
  onMoveFile,
  onRemoveFile,
  onDragEnd,
}: FileManagementProps) {
  // DnDセンサー設定
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>ファイル一覧 ({files.length}件)</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              選択: {selectedFilesCount}件
            </Badge>
            {maxPages > 1 && (
              <Badge variant="secondary">最大ページ: {maxPages}</Badge>
            )}
          </div>
        </CardTitle>
        <CardDescription>
          ファイルをドラッグ＆ドロップまたは上下ボタンで並び替え可能です。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 overflow-y-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={files.map(f => f.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {files.map((file, index) => (
                  <SortableFileItem
                    key={file.id}
                    file={file}
                    index={index}
                    files={files}
                    layoutRegions={layoutRegions}
                    masterImages={masterImages}
                    isUploading={isUploading}
                    getStudentName={getStudentName}
                    onToggleFileSelection={onToggleFileSelection}
                    onMoveFile={onMoveFile}
                    onRemoveFile={onRemoveFile}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </CardContent>
    </Card>
  )
}