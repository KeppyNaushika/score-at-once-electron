"use client"

import { useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
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
  rectSortingStrategy,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Ban, Trash2, Upload, X, Grid3X3 } from "lucide-react"

// 型定義のインポート
import type {
  UnifiedStudent,
  UnifiedFile,
  DisabledState,
  PlacementStrategy,
  TableData,
  TableCell as TableCellData,
} from "@/types/answer-sheet.types"

// ユーティリティのインポート
import {
  getTableData,
  convertToUploadData,
  createInitialDisabledState,
  isPositionDisabled,
} from "@/utils/answerSheetConverter"
import {
  sortStudentsForTable,
  calculatePosition,
  parsePosition,
  formatStudentInfo,
} from "@/utils/studentOrderUtils"

// ============================================================================
// ソート可能なテーブルセルコンポーネント
// ============================================================================

function SortableTableCell({
  id,
  children,
  onTogglePosition,
  onToggleFileDisabled,
  onUploadToCell,
  position,
  hasFile,
  isPositionDisabled,
  isFileDisabled,
}: {
  id: string
  children: React.ReactNode
  onTogglePosition: () => void
  onToggleFileDisabled: () => void
  onUploadToCell: () => void
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

  // 両方のrefを設定する関数
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
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onUploadToCell}>
          <Upload className="mr-2 h-4 w-4" />
          ここにアップロード
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

// ============================================================================
// ソート可能なリストアイテム（Popover内用）
// ============================================================================

function SortableListItem({ id, children }: { id: string; children: React.ReactNode }) {
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
      className="bg-white border border-gray-200 rounded-lg p-4 mb-2 cursor-grab active:cursor-grabbing transition-all duration-300 ease-in-out hover:shadow-md hover:border-gray-300 hover:scale-[1.01] active:scale-[0.98] group"
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}

// ============================================================================
// ドロップ可能なトラッシュボタン
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

  const handleClick = (e: React.MouseEvent) => {
    if (!isOver && onClick) {
      onClick()
    }
  }

  return (
    <Button
      ref={setNodeRef}
      variant="outline"
      className={`w-48 h-12 transition-all duration-300 ease-in-out cursor-pointer ${
        isOver
          ? 'shadow-lg ring-2 ring-blue-200 ring-opacity-50 scale-105 border-blue-400'
          : 'hover:bg-gray-50'
      }`}
      onClick={handleClick}
    >
      <div className="flex items-center gap-2 text-xs">
        <Trash2 className="h-4 w-4" />
        <span className="leading-tight text-center">
          ここにドラッグして<br />答案を無効化
        </span>
        <span className="text-xs text-gray-500">({trashCount}件)</span>
      </div>
    </Button>
  )
}

// ============================================================================
// ドロップ可能なトラッシュエリア
// ============================================================================

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
// メインコンポーネントのProps
// ============================================================================

interface AnswerSheetTableGridProps {
  projectId: string
  students: UnifiedStudent[]
  files: UnifiedFile[]
  masterImageCount: number  // 🚨 模範解答のページ数
  onFilesChange: (files: UnifiedFile[]) => void
  onUpload: (files: UnifiedFile[]) => void
  isUploading?: boolean
}

// ============================================================================
// メインコンポーネント
// ============================================================================

export default function AnswerSheetTableGrid({
  projectId,
  students,
  files,
  masterImageCount,
  onFilesChange,
  onUpload,
  isUploading = false,
}: AnswerSheetTableGridProps) {
  // ============================================================================
  // State管理
  // ============================================================================

  const [disabledState, setDisabledState] = useState<DisabledState>(createInitialDisabledState())
  const [placementStrategy, setPlacementStrategy] = useState<PlacementStrategy>("page-first")
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const [activeFile, setActiveFile] = useState<UnifiedFile | null>(null)

  // ============================================================================
  // 計算済みプロパティ
  // ============================================================================

  const sortedStudents = useMemo(() => sortStudentsForTable(students), [students])
  // 🚨 修正: ファイルではなく模範解答のページ数を使用
  const maxPages = useMemo(() => {
    // 模範解答のページ数を優先、フォールバックとして最低1ページ
    return Math.max(masterImageCount, 1)
  }, [masterImageCount])
  const tableData = useMemo(
    () => getTableData(files, sortedStudents, disabledState, placementStrategy, maxPages),
    [files, sortedStudents, disabledState, placementStrategy, maxPages]
  )

  const trashFiles = useMemo(() => files.filter(f => !f.studentId), [files])

  // ============================================================================
  // dnd-kit センサー設定
  // ============================================================================

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // ============================================================================
  // イベントハンドラー
  // ============================================================================

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string
    const foundFile = files.find((file) => file.id === activeId) || null
    setActiveFile(foundFile)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id.toString()
    const overId = over.id.toString()

    // ボタンにhoverした時にpopoverを開く
    if (overId === "trash-popover-trigger") {
      setIsPopoverOpen(true)
    }

    // 他のドラッグオーバー処理
    // ... (必要に応じて追加)
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
      const { studentIndex, pageNumber } = parsePosition(position, maxPages)
      const student = sortedStudents[studentIndex]

      if (student && !isPositionDisabled(position, studentIndex, pageNumber - 1, disabledState)) {
        const newFiles = files.map(f => 
          f.id === activeId 
            ? { ...f, studentId: student.id, pageNumber, position }
            : f
        )
        onFilesChange(newFiles)
      }
    }

    // トラッシュドロップの処理
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
  // 無効化制御
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
  // アップロード
  // ============================================================================

  const handleUpload = () => {
    const placedFiles = files.filter(f => f.studentId)
    onUpload(placedFiles)
  }

  // ============================================================================
  // レンダリング
  // ============================================================================

  // 🚨 模範解答が存在しない場合はグリッド操作を無効化
  if (masterImageCount === 0) {
    return (
      <div className="flex flex-col gap-4 h-full">
        <div className="text-center text-gray-500 py-8">
          <Grid3X3 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg">模範解答が登録されていません</p>
          <p className="text-sm">まず模範解答をアップロードしてください</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* コントロールパネル */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button
            onClick={() => setPlacementStrategy("page-first")}
            variant={placementStrategy === "page-first" ? "default" : "outline"}
            size="sm"
          >
            ページ優先
          </Button>
          <Button
            onClick={() => setPlacementStrategy("student-first")}
            variant={placementStrategy === "student-first" ? "default" : "outline"}
            size="sm"
          >
            生徒優先
          </Button>
        </div>

        <div className="flex gap-2 items-center">
          {/* ゴミ箱ボタン（Popover） */}
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <div>
                <DroppableTrashButton
                  trashCount={trashFiles.length}
                  onClick={() => setIsPopoverOpen(!isPopoverOpen)}
                >
                  <div>ゴミ箱を開く</div>
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
                        <SortableListItem key={file.id} id={file.id}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-red-600 line-through">{file.name}</span>
                            <span className="text-sm text-red-400">ID: {file.id}</span>
                          </div>
                        </SortableListItem>
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

          <Button 
            onClick={handleUpload} 
            disabled={isUploading || files.filter(f => f.studentId).length === 0}
            className="ml-4"
          >
            {isUploading ? "アップロード中..." : "アップロード実行"}
          </Button>
        </div>
      </div>

      {/* テーブルグリッド */}
      <div className="flex-1 overflow-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
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
                        {formatStudentInfo(row[0].student).displayName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatStudentInfo(row[0].student).studentId}
                      </div>
                    </div>
                  </TableCell>
                  {row.map((cell, colIndex) => (
                    <SortableTableCell
                      key={cell.position}
                      id={cell.file?.id || `empty-${cell.position}`}
                      position={cell.position}
                      hasFile={!!cell.file}
                      isPositionDisabled={cell.isDisabled}
                      isFileDisabled={cell.file ? !cell.file.studentId : false}
                      onTogglePosition={() => togglePositionDisabled(cell.position)}
                      onToggleFileDisabled={() => {
                        // ファイル無効化の実装
                        if (cell.file) {
                          const fileId = cell.file.id
                          const newFiles = files.map(f => 
                            f.id === fileId
                              ? { ...f, studentId: f.studentId ? undefined : cell.student.id }
                              : f
                          )
                          onFilesChange(newFiles)
                        }
                      }}
                      onUploadToCell={() => {
                        // セル指定アップロードの実装（将来的な拡張）
                        if (process.env.NODE_ENV === "development") {
                          console.log(`Upload to position ${cell.position}`)
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
    </div>
  )
}