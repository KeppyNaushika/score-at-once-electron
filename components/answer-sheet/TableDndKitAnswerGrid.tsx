"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
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
import { Ban, Trash2, Upload, X, FileImage, Users, Eye, User } from "lucide-react"

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

// 画像プレビュー用の型定義
type PreviewMode = "full" | "name"

// table-dnd-kit-test準拠のファイル拡張
interface EnhancedUnifiedFile extends UnifiedFile {
  column?: string  // dnd-kitのコンテナ管理用
}

// table-dnd-kit-test準拠の拡張型定義
interface ExtendedDisabledState extends DisabledState {
  cells: Set<string>  // ファイルID単位の無効化
  files: Set<string>  // ファイル答案無効化（コンテキストメニュー用）
}

// テーブルセルのデータ型定義（table-dnd-kit-test準拠）
interface CellData {
  type: "disabled" | "file" | "empty"
  position: number
  file?: UnifiedFile
  student?: UnifiedStudent
  pageNumber?: number
}

// ============================================================================
// ファイルプレビューセルコンポーネント
// ============================================================================

function FilePreviewCell({
  file,
  pageNumber,
  previewMode,
  isFileDisabled,
  nameRegionAvailable,
  getFileColor,
  drawNameRegionCanvas,
}: {
  file: UnifiedFile
  pageNumber: number
  previewMode: PreviewMode
  isFileDisabled: boolean
  nameRegionAvailable?: boolean
  getFileColor: (file: UnifiedFile) => string
  drawNameRegionCanvas: (file: UnifiedFile, pageNumber: number) => Promise<string | null>
}) {
  const [nameClipUrl, setNameClipUrl] = useState<string | null>(null)

  // 氏名欄モードの場合、氏名欄画像を生成
  useEffect(() => {
    if (previewMode === "name") {
      if (nameRegionAvailable) {
        drawNameRegionCanvas(file, pageNumber).then(setNameClipUrl)
      } else {
        setNameClipUrl(null)
      }
    }
  }, [previewMode, nameRegionAvailable, file, pageNumber, drawNameRegionCanvas])

  if (previewMode === "full") {
    // 全体画像モード
    return (
      <div
        className={`relative flex h-full w-full items-center justify-center ${
          isFileDisabled ? "opacity-30" : ""
        }`}
      >
        <Image
          src={file.preview || ''}
          alt={file.name}
          width={100}
          height={60}
          className="object-contain max-w-full max-h-full"
        />
        {isFileDisabled && (
          <div className="absolute inset-0 bg-red-100 bg-opacity-50 flex items-center justify-center">
            <span className="text-red-600 text-xs font-bold">無効</span>
          </div>
        )}
      </div>
    )
  } else {
    // 氏名欄モード
    if (!nameRegionAvailable) {
      // 氏名欄が存在しない場合
      return (
        <div
          className={`relative flex h-full w-full items-center justify-center bg-gray-100 ${
            isFileDisabled ? "opacity-30" : ""
          }`}
        >
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">氏名欄なし</div>
            <div
              className={`h-6 w-6 mx-auto rounded ${getFileColor(file)}`}
            />
          </div>
          {isFileDisabled && (
            <div className="absolute inset-0 bg-red-100 bg-opacity-50 flex items-center justify-center">
              <span className="text-red-600 text-xs font-bold">無効</span>
            </div>
          )}
        </div>
      )
    } else if (nameClipUrl) {
      // 氏名欄画像を表示
      return (
        <div
          className={`relative flex h-full w-full items-center justify-center ${
            isFileDisabled ? "opacity-30" : ""
          }`}
        >
          <Image
            src={nameClipUrl}
            alt={`氏名欄 - ${file.name}`}
            width={100}
            height={60}
            className="object-contain max-w-full max-h-full"
          />
          {isFileDisabled && (
            <div className="absolute inset-0 bg-red-100 bg-opacity-50 flex items-center justify-center">
              <span className="text-red-600 text-xs font-bold">無効</span>
            </div>
          )}
        </div>
      )
    } else {
      // 読み込み中
      return (
        <div
          className={`relative flex h-full w-full items-center justify-center ${
            isFileDisabled ? "opacity-30" : ""
          }`}
        >
          <div className="text-center">
            <div className="text-xs text-gray-500">読み込み中...</div>
            <div
              className={`h-6 w-6 mx-auto rounded ${getFileColor(file)} animate-pulse`}
            />
          </div>
        </div>
      )
    }
  }
}

// ============================================================================
// ソート可能なテーブルセル（table-dnd-kit-test準拠）
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
    <TableCell
      ref={setNodeRef}
      style={style}
      className={`h-16 w-32 cursor-grab border text-center transition-all duration-200 active:cursor-grabbing ${
        isOver ? "scale-105 border-2 border-green-400 bg-green-100" : ""
      }`}
      {...attributes}
      {...listeners}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex h-full w-full items-center justify-center">
            {children}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onClick={onTogglePosition}
            className="flex items-center gap-2"
          >
            {isPositionDisabled ? (
              <>
                <X className="h-4 w-4" />
                セルを有効化
              </>
            ) : (
              <>
                <Ban className="h-4 w-4" />
                セルを無効化
              </>
            )}
          </ContextMenuItem>

          {hasFile && (
            <ContextMenuItem
              onClick={onToggleFileDisabled}
              className="flex items-center gap-2"
              disabled={isPositionDisabled}
            >
              {isFileDisabled ? (
                <>
                  <X className="h-4 w-4" />
                  答案画像を有効化
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4" />
                  答案画像を無効化
                </>
              )}
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={onUploadToCell}
            className="flex items-center gap-2"
            disabled={isPositionDisabled}
          >
            <Upload className="h-4 w-4" />
            このセルに答案画像をアップロード
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </TableCell>
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

  const [disabledState, setDisabledState] = useState<ExtendedDisabledState>({
    rows: new Set<number>(),
    cols: new Set<number>(),
    positions: new Set<number>(),
    cells: new Set<string>(),  // ファイルID単位の無効化（既存、現在未使用）
    files: new Set<string>(),  // ファイル答案無効化（コンテキストメニュー用）
  })
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const [activeFile, setActiveFile] = useState<UnifiedFile | null>(null)
  const [isDraggingFromTrash, setIsDraggingFromTrash] = useState(false)
  
  // 画像プレビューの状態管理
  const [previewMode, setPreviewMode] = useState<PreviewMode>("full")
  const [nameRegionAvailable, setNameRegionAvailable] = useState<Record<number, boolean>>({})
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 氏名欄領域の存在確認
  const checkNameRegionAvailability = useCallback(async () => {
    try {
      const layoutRegions = await window.electronAPI.getLayoutRegionsByProjectId(projectId)
      const masterImages = await window.electronAPI.getMasterImagesByProjectId(projectId)
      
      const availability: Record<number, boolean> = {}
      
      for (const masterImage of masterImages) {
        const nameRegion = layoutRegions.find(
          region => region.type === "STUDENT_NAME" && region.masterImageId === masterImage.id
        )
        availability[masterImage.pageNumber] = !!nameRegion
      }
      
      setNameRegionAvailable(availability)
    } catch (error) {
      console.error("氏名欄領域確認エラー:", error)
    }
  }, [projectId])

  // 氏名欄クリッピング用のcanvas描画
  const drawNameRegionCanvas = useCallback(async (file: UnifiedFile, pageNumber: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    try {
      // LayoutRegionからSTUDENT_NAME領域を取得
      const layoutRegions = await window.electronAPI.getLayoutRegionsByProjectId(projectId)
      
      // ページ番号に基づいてmasterImageIdを取得
      const masterImages = await window.electronAPI.getMasterImagesByProjectId(projectId)
      const masterImage = masterImages.find(img => img.pageNumber === pageNumber)
      
      if (!masterImage) {
        return null
      }

      const nameRegion = layoutRegions.find(
        region => region.type === "STUDENT_NAME" && region.masterImageId === masterImage.id
      )

      if (!nameRegion) {
        return null
      }

      // 画像を読み込み
      const img = new window.Image()
      img.crossOrigin = "anonymous"
      
      return new Promise<string | null>((resolve) => {
        img.onload = () => {
          // キャンバスサイズを設定
          const clipWidth = img.width * nameRegion.width
          const clipHeight = img.height * nameRegion.height
          canvas.width = clipWidth
          canvas.height = clipHeight

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(null)
            return
          }

          // 氏名欄をクリッピングして描画
          ctx.drawImage(
            img,
            img.width * nameRegion.x,  // sx
            img.height * nameRegion.y, // sy
            clipWidth,                 // sWidth
            clipHeight,                // sHeight
            0, 0,                      // dx, dy
            clipWidth,                 // dWidth
            clipHeight                 // dHeight
          )

          // Canvas内容をDataURLとして返す
          resolve(canvas.toDataURL('image/png'))
        }
        
        img.onerror = () => resolve(null)
        img.src = file.preview || ''
      })
    } catch (error) {
      console.error("氏名欄クリッピングエラー:", error)
      return null
    }
  }, [projectId])

  // プレビューモード変更時に氏名欄領域の存在確認
  useEffect(() => {
    if (previewMode === "name") {
      checkNameRegionAvailability()
    }
  }, [previewMode, checkNameRegionAvailability])

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

  // セル位置が無効化されているかチェック（table-dnd-kit-test準拠）
  const isPositionDisabled = useCallback((position: number, maxPages: number) => {
    const row = Math.floor(position / maxPages)
    const col = position % maxPages

    return (
      disabledState.rows.has(row) ||
      disabledState.cols.has(col) ||
      disabledState.positions.has(position)
    )
  }, [disabledState])

  // table-dnd-kit-test準拠の動的テーブルデータ生成
  const getTableData = useCallback((): CellData[][] => {
    // 次の有効ファイルを取得する関数（無効化されていないファイルのみ）
    const enabledFiles = files.filter(
      (file) => file && file.id && !disabledState.files.has(file.id)
    )
    let enabledFileIndex = 0

    const getNextFile = () => {
      if (enabledFileIndex < enabledFiles.length) {
        return enabledFiles[enabledFileIndex++]
      }
      return null
    }

    if (fileOrder === "page-first") {
      // ページ優先配置（列優先と同等）- ページ毎にファイルを配置: A→D→G / B→E→H
      const result: CellData[][] = Array.from({ length: sortedStudents.length }, (_, studentIndex) =>
        Array.from({ length: maxPages }, (_, pageIndex) => {
          const position = studentIndex * maxPages + pageIndex
          const student = sortedStudents[studentIndex]
          if (isPositionDisabled(position, maxPages)) {
            return { 
              type: "disabled" as const, 
              position,
              student,
              pageNumber: pageIndex + 1
            }
          } else {
            return { 
              type: "empty" as const, 
              position,
              student,
              pageNumber: pageIndex + 1
            }
          }
        }),
      )

      // ページ優先（列優先）でファイルを配置
      for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
        for (let studentIndex = 0; studentIndex < sortedStudents.length; studentIndex++) {
          const position = studentIndex * maxPages + pageIndex
          if (!isPositionDisabled(position, maxPages)) {
            const nextFile = getNextFile()
            if (nextFile) {
              result[studentIndex][pageIndex] = { 
                type: "file", 
                file: nextFile, 
                position,
                student: sortedStudents[studentIndex],
                pageNumber: pageIndex + 1
              }
            }
          }
        }
      }

      return result
    } else {
      // 生徒優先配置（行優先と同等）- 生徒毎にファイルを配置: A→B→C / D→E→F
      const result: CellData[][] = []
      for (let studentIndex = 0; studentIndex < sortedStudents.length; studentIndex++) {
        const student = sortedStudents[studentIndex]
        const rowFiles: CellData[] = []
        for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
          const position = studentIndex * maxPages + pageIndex

          if (isPositionDisabled(position, maxPages)) {
            // 無効セル：赤い背景で表示、配置はスキップ
            rowFiles.push({ 
              type: "disabled", 
              position,
              student,
              pageNumber: pageIndex + 1
            })
          } else {
            const nextFile = getNextFile()
            if (nextFile) {
              // 有効セル：次のファイルを配置
              rowFiles.push({ 
                type: "file", 
                file: nextFile, 
                position,
                student,
                pageNumber: pageIndex + 1
              })
            } else {
              // ファイル不足：空きとして表示
              rowFiles.push({ 
                type: "empty", 
                position,
                student,
                pageNumber: pageIndex + 1
              })
            }
          }
        }
        result.push(rowFiles)
      }
      return result
    }
  }, [sortedStudents, maxPages, fileOrder, disabledState, files, isPositionDisabled])

  // メモ化されたテーブルデータ
  const tableData = useMemo(() => getTableData(), [getTableData])

  // table-dnd-kit-test準拠のファイル分類
  const getEnabledFiles = useCallback(() => {
    return files.filter(
      (file) => file && file.id && !disabledState.files.has(file.id)
    )
  }, [files, disabledState.files])

  const getDisabledFiles = useCallback(() => {
    return files.filter(
      (file) => file && file.id && disabledState.files.has(file.id)
    )
  }, [files, disabledState.files])

  // ファイルの色を自動生成
  const getFileColor = useCallback((file: UnifiedFile) => {
    if (file.color) return file.color
    
    const colors = [
      "bg-red-200", "bg-blue-200", "bg-green-200", "bg-yellow-200", "bg-purple-200",
      "bg-pink-200", "bg-indigo-200", "bg-orange-200", "bg-gray-200", "bg-teal-200"
    ]
    
    // ファイルIDからハッシュを生成して色を決定
    const hash = file.id.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    
    return colors[Math.abs(hash) % colors.length]
  }, [])

  const trashFiles = useMemo(() => getDisabledFiles(), [getDisabledFiles])

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

  // table-dnd-kit-test準拠のファイル無効化制御
  const toggleFileDisabled = (fileId: string) => {
    setDisabledState(prev => {
      const newFiles = new Set(prev.files)
      if (newFiles.has(fileId)) {
        // 復活：ゴミ箱から戻す
        newFiles.delete(fileId)
      } else {
        // 無効化：ゴミ箱に移動
        newFiles.add(fileId)
      }
      return { ...prev, files: newFiles }
    })
  }


  // アップロード機能（table-dnd-kit-test準拠のプレースホルダー）
  const handleUploadToCell = (position: number) => {
    const row = Math.floor(position / maxPages)
    const col = position % maxPages
    const cellName = `${String.fromCharCode(65 + col)}${row + 1}`
    alert(`${cellName}セルへのアップロード機能は後日実装予定です`)
  }

  // ============================================================================
  // dnd-kitイベントハンドラー（table-dnd-kit-test準拠）
  // ============================================================================

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string
    const foundFile = files.find((file) => file.id === activeId) || null
    setActiveFile(foundFile)
    
    // ゴミ箱からのドラッグかどうかを判定
    const isFromTrash = getDisabledFiles().some(file => file.id === activeId)
    setIsDraggingFromTrash(isFromTrash)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id.toString()
    const overId = over.id.toString()

    // ゴミ箱ボタンにhoverした時にpopoverを開く
    if (overId === "trash-popover-trigger") {
      setIsPopoverOpen(true)
    }

    // table-dnd-kit-test準拠のコンテナ間移動処理
    const findContainer = (id: string) => {
      if (id === "trash-area" || id === "trash-popover-trigger") return "trash"
      
      const enabledFile = getEnabledFiles().find((file) => file.id === id)
      if (enabledFile) return "main"
      
      const disabledFile = getDisabledFiles().find((file) => file.id === id)
      if (disabledFile) return "trash"
      
      return null
    }

    const activeContainer = findContainer(activeId)
    const overContainer = findContainer(overId)

    if (activeContainer !== overContainer && overContainer && activeContainer) {
      // コンテナ間移動：即座にdisabledStateを更新
      setDisabledState((prev) => {
        const newFiles = new Set(prev.files)
        if (activeContainer === "main" && overContainer === "trash") {
          newFiles.add(activeId)
        } else if (activeContainer === "trash" && overContainer === "main") {
          newFiles.delete(activeId)
        }
        return { ...prev, files: newFiles }
      })
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) {
      setActiveFile(null)
      setIsDraggingFromTrash(false)
      return
    }

    const activeId = active.id.toString()
    const overId = over.id.toString()

    if (activeId === overId) {
      setActiveFile(null)
      setIsDraggingFromTrash(false)
      return
    }

    // table-dnd-kit-test準拠のコンテナ判定関数
    const findContainer = (id: string) => {
      if (id === "trash-area" || id === "trash-popover-trigger") return "trash"
      
      const enabledFile = getEnabledFiles().find((file) => file.id === id)
      if (enabledFile) return "main"
      
      const disabledFile = getDisabledFiles().find((file) => file.id === id)
      if (disabledFile) return "trash"
      
      return null
    }

    const activeContainer = findContainer(activeId)
    const overContainer = findContainer(overId)

    if (activeContainer === overContainer && activeId !== overId) {
      // 同一コンテナ内での並び替え（table-dnd-kit-testと同じロジック）
      const newFiles = [...files]
      const oldIndex = newFiles.findIndex((file) => file.id === activeId)
      const newIndex = newFiles.findIndex((file) => file.id === overId)
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedFiles = arrayMove(newFiles, oldIndex, newIndex)
        onFilesChange(reorderedFiles)
      }
    }

    // セルドロップの処理は動的再配置により自動処理されるため削除
    // ファイルの順序変更のみでテーブルが再構成される

    setActiveFile(null)
    setIsDraggingFromTrash(false)
  }

  // ============================================================================
  // アップロード処理
  // ============================================================================

  const handleUpload = () => {
    const uploadData: UploadData[] = []

    // 動的テーブルデータから配置済みファイルのアップロードデータを生成
    tableData.forEach(row => {
      row.forEach(cell => {
        if (cell.type === "file" && cell.file && cell.student && cell.pageNumber) {
          uploadData.push({
            name: cell.file.name,
            fileName: cell.file.name,
            originalFileName: cell.file.originalFileName,
            type: cell.file.type,
            buffer: cell.file.buffer,
            studentId: cell.student.id,
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
                <span className="rounded-full bg-green-100 px-2 py-1 text-sm text-green-700">
                  {getEnabledFiles().length}件
                </span>
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
                      ページ優先 (A→D→G / B→E→H)
                    </Button>
                    <Button
                      onClick={() => onFileOrderChange("student-first")}
                      variant={fileOrder === "student-first" ? "default" : "outline"}
                      size="sm"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      生徒優先 (A→B→C / D→E→F)
                    </Button>
                  </>
                )}

                {/* プレビューモード切り替え */}
                <div className="flex items-center gap-2 border-l pl-2">
                  <span className="text-sm font-medium">プレビュー:</span>
                  <Button
                    onClick={() => setPreviewMode("full")}
                    variant={previewMode === "full" ? "default" : "outline"}
                    size="sm"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    全体画像
                  </Button>
                  <Button
                    onClick={() => setPreviewMode("name")}
                    variant={previewMode === "name" ? "default" : "outline"}
                    size="sm"
                  >
                    <User className="h-4 w-4 mr-2" />
                    氏名欄
                  </Button>
                </div>

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
                                <ContextMenu>
                                  <ContextMenuTrigger asChild>
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-red-600 line-through">{file.name}</span>
                                      <span className="text-sm text-red-400">ID: {file.id.slice(0, 8)}</span>
                                    </div>
                                  </ContextMenuTrigger>
                                  <ContextMenuContent>
                                    <ContextMenuItem
                                      onClick={() => toggleFileDisabled(file.id)}
                                      className="flex items-center gap-2"
                                    >
                                      <X className="h-4 w-4" />
                                      答案画像を有効化
                                    </ContextMenuItem>
                                  </ContextMenuContent>
                                </ContextMenu>
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
                  disabled={isUploading || getEnabledFiles().length === 0}
                  className="ml-4"
                >
                  {isUploading ? "アップロード中..." : "アップロード実行"}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 overflow-auto">
            {/* 全ファイル用のSortableContext（テーブル + ゴミ箱） */}
            <SortableContext
              items={[
                ...getEnabledFiles().map((file) => file.id),
                ...getDisabledFiles().map((file) => file.id),
              ]}
              strategy={rectSortingStrategy}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">生徒</TableHead>
                    {Array.from({ length: maxPages }, (_, colIndex) => (
                      <TableHead 
                        key={colIndex}
                        className={`w-32 cursor-pointer text-center hover:bg-gray-100 ${
                          disabledState.cols.has(colIndex)
                            ? "bg-red-100 text-red-600"
                            : ""
                        }`}
                        onClick={() => toggleColDisabled(colIndex)}
                      >
                        {colIndex + 1}ページ目
                        {disabledState.cols.has(colIndex) && " (無効)"}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* 配置戦略に応じて動的にデータを再構成 */}
                  {tableData.map((rowFiles, rowIndex) => (
                    <TableRow key={sortedStudents[rowIndex]?.id || rowIndex}>
                      <TableCell 
                        className={`cursor-pointer text-center font-medium hover:bg-gray-100 ${
                          disabledState.rows.has(rowIndex)
                            ? "bg-red-100 text-red-600"
                            : ""
                        }`}
                        onClick={() => toggleRowDisabled(rowIndex)}
                      >
                        {sortedStudents[rowIndex]?.lastName} {sortedStudents[rowIndex]?.firstName}
                        {disabledState.rows.has(rowIndex) && " (無効)"}
                      </TableCell>
                      {rowFiles.map((cellData, colIndex) => {
                        if (cellData.type === "disabled") {
                          // 無効化セル（赤い背景）
                          return (
                            <TableCell
                              key={`disabled-${rowIndex}-${colIndex}`}
                              className={`h-16 w-32 border bg-red-100 p-2 text-center transition-colors ${
                                isDraggingFromTrash
                                  ? "border-blue-300 bg-blue-50"
                                  : ""
                              }`}
                            >
                              <ContextMenu>
                                <ContextMenuTrigger asChild>
                                  <div className="flex h-full w-full cursor-pointer items-center justify-center">
                                    <div className="text-xs text-red-600">無効</div>
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent>
                                  <ContextMenuItem
                                    onClick={() => togglePositionDisabled(cellData.position)}
                                    className="flex items-center gap-2"
                                  >
                                    <X className="h-4 w-4" />
                                    セルを有効化
                                  </ContextMenuItem>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem
                                    onClick={() => handleUploadToCell(cellData.position)}
                                    className="flex items-center gap-2"
                                    disabled={true}
                                  >
                                    <Upload className="h-4 w-4" />
                                    このセルに答案画像をアップロード
                                  </ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            </TableCell>
                          )
                        }

                        if (cellData.type === "empty") {
                          // 空きセル
                          return (
                            <TableCell
                              key={`empty-${rowIndex}-${colIndex}`}
                              className={`h-16 w-32 border bg-gray-50 p-2 text-center transition-colors ${
                                isDraggingFromTrash
                                  ? "border-blue-300 bg-blue-50"
                                  : ""
                              }`}
                            >
                              <ContextMenu>
                                <ContextMenuTrigger asChild>
                                  <div className="flex h-full w-full cursor-pointer items-center justify-center">
                                    <div className="text-xs text-gray-400">空き</div>
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent>
                                  <ContextMenuItem
                                    onClick={() => togglePositionDisabled(cellData.position)}
                                    className="flex items-center gap-2"
                                  >
                                    <Ban className="h-4 w-4" />
                                    セルを無効化
                                  </ContextMenuItem>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem
                                    onClick={() => handleUploadToCell(cellData.position)}
                                    className="flex items-center gap-2"
                                  >
                                    <Upload className="h-4 w-4" />
                                    このセルに答案画像をアップロード
                                  </ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            </TableCell>
                          )
                        }

                        // ファイルセル（table-dnd-kit-test準拠）
                        const file = cellData.file!
                        const isFileDisabled = disabledState.files.has(file.id)

                        return (
                          <SortableTableCell
                            key={file.id}
                            id={file.id}
                            position={cellData.position}
                            hasFile={true}
                            isPositionDisabled={false} // 動的配置では無効セルにファイルは配置されない
                            isFileDisabled={isFileDisabled}
                            onTogglePosition={() => togglePositionDisabled(cellData.position)}
                            onToggleFileDisabled={() => toggleFileDisabled(file.id)}
                            onUploadToCell={() => handleUploadToCell(cellData.position)}
                          >
                            <FilePreviewCell 
                              file={file}
                              pageNumber={cellData.pageNumber || 1}
                              previewMode={previewMode}
                              isFileDisabled={isFileDisabled}
                              nameRegionAvailable={nameRegionAvailable[cellData.pageNumber || 1]}
                              getFileColor={getFileColor}
                              drawNameRegionCanvas={drawNameRegionCanvas}
                            />
                          </SortableTableCell>
                        )
                      })}
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
              <div className="flex items-center gap-3">
                <div
                  className={`h-8 w-8 rounded ${getFileColor(activeFile)} flex-shrink-0`}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 truncate">
                    {activeFile.name.split(' - ページ')[0] || activeFile.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {(activeFile.size / 1024).toFixed(1)}KB
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* 氏名欄クリッピング用の隠しcanvas */}
      <canvas
        ref={canvasRef}
        className="hidden"
        width={0}
        height={0}
      />
    </div>
  )
}