"use client"

import { useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Ban, Trash2, Upload, X, FileImage, Users } from "lucide-react"

// 統一型定義
import type {
  UnifiedStudent,
  UnifiedFile,
  DisabledState,
  PlacementStrategy,
  UploadData,
  TableData,
  TableCell as TableCellData,
} from "@/types/answer-sheet.types"

// ============================================================================
// ソート可能なテーブルセル（table-dnd-kit-test準拠）
// ============================================================================

function SortableTableCell({
  id,
  children,
  onTogglePosition,
  onToggleFileDisabled,
  position,
  hasFile,
  isPositionDisabled,
  isFileDisabled,
}: {
  id: string
  children: React.ReactNode
  onTogglePosition: () => void
  onToggleFileDisabled: () => void
  position: number
  hasFile: boolean
  isPositionDisabled: boolean
  isFileDisabled?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: {
      type: "table-cell",
      position: position,
    },
  })

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `cell-${position}`,
    data: {
      type: "table-cell",
      position: position,
    },
  })

  // 両方のrefを設定
  const setNodeRef = useCallback((node: HTMLElement | null) => {
    setSortableRef(node)
    setDroppableRef(node)
  }, [setSortableRef, setDroppableRef])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableCell
          ref={setNodeRef}
          style={style}
          className={`
            relative h-24 w-32 border-2 transition-all duration-200
            ${isOver ? "border-blue-400 bg-blue-50" : "border-gray-200"}
            ${isPositionDisabled ? "bg-gray-100 opacity-50" : "bg-white hover:bg-gray-50"}
            ${hasFile && !isFileDisabled ? "bg-green-50 border-green-200" : ""}
            ${hasFile && isFileDisabled ? "bg-red-50 border-red-200" : ""}
          `}
          {...attributes}
          {...listeners}
        >
          {children}
        </TableCell>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onTogglePosition}>
          <Ban className="mr-2 h-4 w-4" />
          {isPositionDisabled ? "有効化" : "無効化"}
        </ContextMenuItem>
        {hasFile && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={onToggleFileDisabled}>
              <X className="mr-2 h-4 w-4" />
              {isFileDisabled ? "ファイル有効化" : "ファイル無効化"}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

// ============================================================================
// ソート可能なファイルアイテム（ゴミ箱用）
// ============================================================================

function SortableFileItem({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 150ms ease',
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-gray-200 rounded-lg p-4 mb-2 cursor-grab active:cursor-grabbing transition-all duration-300 ease-in-out hover:shadow-md hover:border-gray-300 hover:scale-[1.01] active:scale-[0.98]"
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}

// ============================================================================
// ドロップ可能なゴミ箱
// ============================================================================

function DroppableTrashButton({
  children,
  trashCount,
  onClick,
  droppableId = 'trash-popover-trigger'
}: {
  children: React.ReactNode
  trashCount: number
  onClick?: () => void
  droppableId?: string
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { type: 'trash' },
  })

  return (
    <Button
      ref={setNodeRef}
      variant="outline"
      className={`w-48 h-12 transition-all duration-300 ease-in-out cursor-pointer ${
        isOver
          ? 'shadow-lg ring-2 ring-blue-200 ring-opacity-50 scale-105 border-blue-400'
          : 'hover:bg-gray-50'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 text-xs">
        <Trash2 className="h-4 w-4" />
        <span className="leading-tight text-center">
          ここにドラッグして<br />ファイルを無効化
        </span>
        <span className="text-xs text-gray-500">({trashCount}件)</span>
      </div>
    </Button>
  )
}

function TrashArea({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'trash-area',
    data: { type: 'trash' },
  })

  return (
    <div
      ref={setNodeRef}
      className={`border-2 border-dashed rounded-lg p-4 transition-all duration-300 ease-in-out ${
        isOver
          ? 'border-red-400 bg-red-50 shadow-lg ring-2 ring-red-200 ring-opacity-50 scale-[1.02]'
          : 'border-red-300 bg-red-50/50 hover:bg-red-100/50'
      }`}
    >
      {children}
    </div>
  )
}

// ============================================================================
// Props定義
// ============================================================================

interface TableDndKitAnswerGridProps {
  projectId: string
  students: UnifiedStudent[]
  files: UnifiedFile[]
  masterImageCount: number
  fileOrder?: PlacementStrategy
  isUploading?: boolean
  onFileOrderChange?: (order: PlacementStrategy) => void
  onFilesChange: (files: UnifiedFile[]) => void
  onUpload: (data: UploadData[]) => void
}

// ============================================================================
// メインコンポーネント（table-dnd-kit-test準拠）
// ============================================================================

export default function TableDndKitAnswerGrid({
  projectId,
  students,
  files,
  masterImageCount,
  fileOrder = "page-first",
  isUploading = false,
  onFileOrderChange,
  onFilesChange,
  onUpload,
}: TableDndKitAnswerGridProps) {
  
  // ============================================================================
  // State管理（table-dnd-kit-test準拠のシンプル構造）
  // ============================================================================

  const [disabledState, setDisabledState] = useState<DisabledState>({
    rows: new Set<number>(),
    cols: new Set<number>(),
    positions: new Set<number>(),
  })
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const [activeFile, setActiveFile] = useState<UnifiedFile | null>(null)

  // ============================================================================
  // 計算済みプロパティ（table-dnd-kit-test準拠）
  // ============================================================================

  const maxPages = Math.max(masterImageCount, 1)
  
  // 生徒をcustomOrder順にソート
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      // customOrderが設定されている場合はそれを優先
      if (a.customOrder !== null && a.customOrder !== undefined &&
          b.customOrder !== null && b.customOrder !== undefined) {
        return a.customOrder - b.customOrder
      }
      if (a.customOrder !== null && a.customOrder !== undefined) return -1
      if (b.customOrder !== null && b.customOrder !== undefined) return 1

      // フォールバック: 出席番号順
      const aNumber = a.attendanceNumber
      const bNumber = b.attendanceNumber
      if (aNumber && bNumber) return aNumber - bNumber
      if (aNumber) return -1
      if (bNumber) return 1

      // 最終フォールバック: 名前順
      const aName = `${a.lastName}${a.firstName}`
      const bName = `${b.lastName}${b.firstName}`
      return aName.localeCompare(bName)
    })
  }, [students])

  // テーブルデータ生成（table-dnd-kit-test準拠の動的計算）
  const tableData = useMemo((): TableData => {
    const result: TableData = []
    
    for (let studentIndex = 0; studentIndex < sortedStudents.length; studentIndex++) {
      const student = sortedStudents[studentIndex]
      const row: TableCellData[] = []
      
      for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
        const position = studentIndex * maxPages + (pageNumber - 1)
        
        // この位置に配置されているファイルを検索
        const file = files.find(
          (f) => f.studentId === student.id && f.pageNumber === pageNumber
        ) || null

        // 無効化判定
        const isDisabled = 
          disabledState.rows.has(studentIndex) ||
          disabledState.cols.has(pageNumber - 1) ||
          disabledState.positions.has(position)

        const cell: TableCellData = {
          studentIndex,
          pageNumber,
          position,
          file,
          student,
          isDisabled,
        }

        row.push(cell)
      }
      
      result.push(row)
    }
    
    return result
  }, [sortedStudents, maxPages, files, disabledState])

  const trashFiles = useMemo(() => files.filter(f => !f.studentId), [files])

  // ============================================================================
  // dnd-kit設定
  // ============================================================================

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // ============================================================================
  // 無効化制御（table-dnd-kit-test準拠）
  // ============================================================================

  const toggleRowDisabled = (rowIndex: number) => {
    setDisabledState(prev => {
      const newRows = new Set(prev.rows)
      if (newRows.has(rowIndex)) {
        newRows.delete(rowIndex)
      } else {
        newRows.add(rowIndex)
      }
      return { ...prev, rows: newRows }
    })
  }

  const toggleColDisabled = (colIndex: number) => {
    setDisabledState(prev => {
      const newCols = new Set(prev.cols)
      if (newCols.has(colIndex)) {
        newCols.delete(colIndex)
      } else {
        newCols.add(colIndex)
      }
      return { ...prev, cols: newCols }
    })
  }

  const togglePositionDisabled = (position: number) => {
    setDisabledState(prev => {
      const newPositions = new Set(prev.positions)
      if (newPositions.has(position)) {
        newPositions.delete(position)
      } else {
        newPositions.add(position)
      }
      return { ...prev, positions: newPositions }
    })
  }

  // ============================================================================
  // dnd-kitイベントハンドラー（table-dnd-kit-test準拠）
  // ============================================================================

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string
    const foundFile = files.find((file) => file.id === activeId) || null
    setActiveFile(foundFile)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const overId = over.id.toString()

    // ゴミ箱ボタンにhoverした時にpopoverを開く
    if (overId === "trash-popover-trigger") {
      setIsPopoverOpen(true)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) {
      setActiveFile(null)
      return
    }

    const activeId = active.id.toString()
    const overId = over.id.toString()

    if (activeId === overId) {
      setActiveFile(null)
      return
    }

    // セルドロップの処理
    if (overId.startsWith('cell-')) {
      const position = parseInt(overId.replace('cell-', ''))
      const studentIndex = Math.floor(position / maxPages)
      const pageNumber = (position % maxPages) + 1
      const student = sortedStudents[studentIndex]

      // 無効化チェック
      const isDisabled = 
        disabledState.rows.has(studentIndex) ||
        disabledState.cols.has(pageNumber - 1) ||
        disabledState.positions.has(position)

      if (student && !isDisabled) {
        const newFiles = files.map(f => 
          f.id === activeId 
            ? { ...f, studentId: student.id, pageNumber, position }
            : f
        )
        onFilesChange(newFiles)
      }
    }

    // ゴミ箱ドロップの処理
    if (overId === 'trash-area' || overId === 'trash-popover-trigger') {
      const newFiles = files.map(f => 
        f.id === activeId 
          ? { ...f, studentId: undefined, pageNumber: f.pageNumber, position: undefined }
          : f
      )
      onFilesChange(newFiles)
    }

    setActiveFile(null)
  }

  // ============================================================================
  // アップロード処理
  // ============================================================================

  const handleUpload = () => {
    const uploadData: UploadData[] = []

    // 配置済みファイルからアップロードデータを生成
    tableData.forEach(row => {
      row.forEach(cell => {
        if (cell.file && cell.file.studentId && !cell.isDisabled) {
          uploadData.push({
            name: cell.file.name,
            fileName: cell.file.name,
            originalFileName: cell.file.originalFileName,
            type: cell.file.type,
            buffer: cell.file.buffer,
            studentId: cell.file.studentId,
            pageNumber: cell.pageNumber,
            overwrite: false,
          })
        }
      })
    })

    onUpload(uploadData)
  }

  // ============================================================================
  // レンダリング
  // ============================================================================

  // 模範解答が存在しない場合
  if (maxPages === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500 py-8">
            <FileImage className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg">模範解答が登録されていません</p>
            <p className="text-sm">まず模範解答をアップロードしてください</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <Card className="flex flex-col h-full">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>答案配置テーブル</span>
                <Badge variant="outline">{maxPages}ページ</Badge>
                <Badge variant="secondary">
                  {files.filter(f => f.studentId).length}/{sortedStudents.length * maxPages}
                </Badge>
              </div>
              <div className="flex gap-2">
                {/* 配置戦略選択 */}
                {onFileOrderChange && (
                  <>
                    <Button
                      onClick={() => onFileOrderChange("page-first")}
                      variant={fileOrder === "page-first" ? "default" : "outline"}
                      size="sm"
                    >
                      <FileImage className="h-4 w-4 mr-2" />
                      ページ優先
                    </Button>
                    <Button
                      onClick={() => onFileOrderChange("student-first")}
                      variant={fileOrder === "student-first" ? "default" : "outline"}
                      size="sm"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      生徒優先
                    </Button>
                  </>
                )}

                {/* ゴミ箱 */}
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <div>
                      <DroppableTrashButton
                        trashCount={trashFiles.length}
                        onClick={() => setIsPopoverOpen(!isPopoverOpen)}
                      >
                        ゴミ箱を開く
                      </DroppableTrashButton>
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 p-4" side="bottom" align="end">
                    <TrashArea>
                      <div className="min-h-48 max-h-64 overflow-y-auto">
                        <SortableContext
                          items={trashFiles.map(file => file.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-2">
                            {trashFiles.map((file) => (
                              <SortableFileItem key={file.id} id={file.id}>
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-red-600 line-through">{file.name}</span>
                                  <span className="text-sm text-red-400">ID: {file.id.slice(0, 8)}</span>
                                </div>
                              </SortableFileItem>
                            ))}

                            {trashFiles.length === 0 && (
                              <div className="text-center py-6 text-gray-500">
                                <Trash2 className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                <div className="text-sm">アイテムをここにドラッグ</div>
                              </div>
                            )}
                          </div>
                        </SortableContext>
                      </div>
                    </TrashArea>
                  </PopoverContent>
                </Popover>

                {/* アップロードボタン */}
                <Button 
                  onClick={handleUpload} 
                  disabled={isUploading || files.filter(f => f.studentId).length === 0}
                  className="ml-4"
                >
                  {isUploading ? "アップロード中..." : "アップロード実行"}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 overflow-auto">
            <SortableContext
              items={files.map(f => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">生徒</TableHead>
                    {Array.from({ length: maxPages }, (_, i) => (
                      <TableHead 
                        key={i}
                        className={`text-center cursor-pointer transition-colors ${
                          disabledState.cols.has(i) ? 'bg-gray-100 text-gray-500' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => toggleColDisabled(i)}
                      >
                        ページ {i + 1}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map((row, rowIndex) => (
                    <TableRow key={sortedStudents[rowIndex]?.id || rowIndex}>
                      <TableCell 
                        className={`font-medium cursor-pointer transition-colors ${
                          disabledState.rows.has(rowIndex) ? 'bg-gray-100 text-gray-500' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => toggleRowDisabled(rowIndex)}
                      >
                        <div>
                          <div className="font-semibold">
                            {row[0].student.lastName} {row[0].student.firstName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {row[0].student.studentId}
                          </div>
                        </div>
                      </TableCell>
                      {row.map((cell) => (
                        <SortableTableCell
                          key={cell.position}
                          id={cell.file?.id || `empty-${cell.position}`}
                          position={cell.position}
                          hasFile={!!cell.file}
                          isPositionDisabled={cell.isDisabled}
                          isFileDisabled={cell.file ? !cell.file.studentId : false}
                          onTogglePosition={() => togglePositionDisabled(cell.position)}
                          onToggleFileDisabled={() => {
                            if (cell.file) {
                              const newFiles = files.map(f => 
                                f.id === cell.file!.id
                                  ? { ...f, studentId: f.studentId ? undefined : cell.student.id }
                                  : f
                              )
                              onFilesChange(newFiles)
                            }
                          }}
                        >
                          {cell.file ? (
                            <div className="text-center">
                              <div className="text-xs font-medium truncate">
                                {cell.file.name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {(cell.file.size / 1024).toFixed(1)}KB
                              </div>
                            </div>
                          ) : (
                            <div className="text-center text-gray-400 text-xs">
                              空
                            </div>
                          )}
                        </SortableTableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SortableContext>
          </CardContent>
        </Card>

        <DragOverlay dropAnimation={null}>
          {activeFile ? (
            <div className="bg-white border-2 border-blue-400 rounded-lg p-4 shadow-2xl transform rotate-3 scale-110 ring-4 ring-blue-200 ring-opacity-30 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-800">{activeFile.name}</span>
                <span className="text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                  {(activeFile.size / 1024).toFixed(1)}KB
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}