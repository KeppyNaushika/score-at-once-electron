"use client"

import { useState } from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable,
  DragOverEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Ban, Upload, X, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

// テスト用のファイル型
interface TestFile {
  id: string
  name: string
  color: string
  isPlaceholder?: boolean
}

// ソート可能かつドロップ可能なテーブルセルコンポーネント
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
  id: string; 
  children: React.ReactNode;
  onTogglePosition: () => void;
  onToggleFileDisabled: () => void;
  onUploadToCell: () => void;
  position: number;
  hasFile: boolean;
  isPositionDisabled: boolean;
  isFileDisabled?: boolean;
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
      type: 'table-cell',
      position: position,
    }
  })

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `cell-${position}`,
    data: {
      type: 'table-cell',
      position: position,
    },
  })

  // 両方のrefを設定
  const setNodeRef = (node: HTMLElement | null) => {
    setSortableRef(node)
    setDroppableRef(node)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <TableCell
      ref={setNodeRef}
      style={style}
      className={`border p-2 h-16 w-32 text-center cursor-grab active:cursor-grabbing transition-all duration-200 ${
        isOver ? 'bg-green-100 border-green-400 border-2 scale-105' : ''
      }`}
      {...attributes}
      {...listeners}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="w-full h-full flex items-center justify-center">
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

// ドロップ可能なゴミ箱エリア
function DroppableTrashArea({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'trash-area',
    data: {
      type: 'trash-area',
    },
  })

  return (
    <div ref={setNodeRef} className={`mb-6 transition-all duration-200 ${
      isOver ? 'scale-105 ring-4 ring-red-300 ring-opacity-50' : ''
    }`}>
      {children}
    </div>
  )
}

// ゴミ箱からドラッグ可能なファイルアイテム（表のセルと同じ構造）
function DraggableTrashFile({ file }: { file: TestFile }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `trash-${file.id}`,
    data: {
      type: 'trash-file',
      file: file,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border p-2 h-16 w-32 text-center cursor-grab active:cursor-grabbing transition-all duration-200 bg-red-50 border-red-300 ${
        isDragging ? 'shadow-lg scale-105' : ''
      }`}
      {...listeners}
      {...attributes}
    >
      <div className="flex flex-col items-center justify-center h-full">
        <div className={`w-8 h-8 rounded mb-1 ${file.color} ring-2 ring-red-300 opacity-70`} />
        <div className="text-sm font-medium text-red-500 line-through">{file.name}</div>
        <div className="text-xs text-gray-500">{file.id}</div>
      </div>
    </div>
  )
}


export default function TableDndKitTestPage() {
  // 配置戦略
  const [placementStrategy, setPlacementStrategy] = useState<"row-first" | "col-first">("row-first")

  // テスト用ファイル配列（5x5で10個）
  const [files, setFiles] = useState<TestFile[]>([
    { id: "file-1", name: "A", color: "bg-red-200" },
    { id: "file-2", name: "B", color: "bg-blue-200" },
    { id: "file-3", name: "C", color: "bg-green-200" },
    { id: "file-4", name: "D", color: "bg-yellow-200" },
    { id: "file-5", name: "E", color: "bg-purple-200" },
    { id: "file-6", name: "F", color: "bg-pink-200" },
    { id: "file-7", name: "G", color: "bg-indigo-200" },
    { id: "file-8", name: "H", color: "bg-orange-200" },
    { id: "file-9", name: "I", color: "bg-gray-200" },
    { id: "file-10", name: "J", color: "bg-teal-200" },
  ])

  // 無効化状態管理
  const [disabledState, setDisabledState] = useState({
    rows: new Set<number>(),
    cols: new Set<number>(),
    cells: new Set<string>(), // ファイルID単位の無効化（既存、現在未使用）
    positions: new Set<number>(), // セル位置単位の無効化（新規追加）
    files: new Set<string>(), // ファイル答案無効化（コンテキストメニュー用）
  })

  // ドラッグ状態管理
  const [activeFile, setActiveFile] = useState<TestFile | null>(null)
  const [isDraggingFromTrash, setIsDraggingFromTrash] = useState(false)

  // セル位置が無効化されているかチェック
  const isPositionDisabled = (position: number) => {
    const row = Math.floor(position / 5)
    const col = position % 5

    return disabledState.rows.has(row) || 
           disabledState.cols.has(col) ||
           disabledState.positions.has(position)
  }

  // ファイルが無効化されているかチェック
  const isFileDisabled = (fileId: string) => {
    return disabledState.cells.has(fileId)
  }

  // ファイルインデックスが無効化されているかチェック（dnd-kit用のみ）
  const isDisabled = (fileIndex: number) => {
    if (fileIndex >= files.length) return false // ファイルが存在しない場合は無効ではない
    
    const fileId = files[fileIndex]?.id
    return disabledState.cells.has(fileId) // 個別セル無効化のみチェック
  }

  // 有効なファイルのみ取得（dnd-kit用）
  const getEnabledFiles = () => {
    return files.filter((file) => file && file.id && !disabledState.files.has(file.id))
  }

  // 無効化されたファイルのみ取得
  const getDisabledFiles = () => {
    return files.filter((file) => file && file.id && disabledState.files.has(file.id))
  }

  // 仮想インデックス → 実インデックスのマッピング
  const getVirtualToRealMapping = () => {
    const mapping: number[] = []
    for (let realIndex = 0; realIndex < files.length; realIndex++) {
      if (!isDisabled(realIndex)) {
        mapping.push(realIndex)
      }
    }
    return mapping
  }

  // テーブルデータを配置戦略に応じて再構成（5x5）
  const getTableData = () => {
    let nextFileIndex = 0 // 次に配置するファイルの実インデックス
    
    // 次の有効ファイルを取得する関数（無効化されていないファイルのみ）
    const enabledFiles = getEnabledFiles()
    let enabledFileIndex = 0
    
    const getNextFile = () => {
      if (enabledFileIndex < enabledFiles.length) {
        return enabledFiles[enabledFileIndex++]
      }
      return null
    }
    
    if (placementStrategy === "row-first") {
      // 行優先配置
      const result = []
      for (let row = 0; row < 5; row++) {
        const rowFiles = []
        for (let col = 0; col < 5; col++) {
          const position = row * 5 + col
          
          if (isPositionDisabled(position)) {
            // 無効セル：赤い背景で表示、配置はスキップ
            rowFiles.push({ type: 'disabled', position })
          } else {
            const nextFile = getNextFile()
            if (nextFile) {
              // 有効セル：次のファイルを配置
              rowFiles.push({ type: 'file', file: nextFile, position })
            } else {
              // ファイル不足：空きとして表示
              rowFiles.push({ type: 'empty', position })
            }
          }
        }
        result.push(rowFiles)
      }
      return result
    } else {
      // 列優先配置
      const result = Array.from({ length: 5 }, (_, row) => 
        Array.from({ length: 5 }, (_, col) => {
          const position = row * 5 + col
          if (isPositionDisabled(position)) {
            return { type: 'disabled', position }
          } else {
            return { type: 'empty', position }
          }
        })
      )
      
      // 列優先でファイルを配置
      for (let col = 0; col < 5; col++) {
        for (let row = 0; row < 5; row++) {
          const position = row * 5 + col
          if (!isPositionDisabled(position)) {
            const nextFile = getNextFile()
            if (nextFile) {
              result[row][col] = { type: 'file', file: nextFile, position }
            }
          }
        }
      }
      
      return result
    }
  }

  // 無効化トグル関数
  const toggleRowDisabled = (row: number) => {
    setDisabledState(prev => {
      const newRows = new Set(prev.rows)
      if (newRows.has(row)) {
        newRows.delete(row)
      } else {
        newRows.add(row)
      }
      return { ...prev, rows: newRows }
    })
  }

  const toggleColDisabled = (col: number) => {
    setDisabledState(prev => {
      const newCols = new Set(prev.cols)
      if (newCols.has(col)) {
        newCols.delete(col)
      } else {
        newCols.add(col)
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

  const toggleFileDisabled = (fileId: string) => {
    setDisabledState(prev => {
      const newFiles = new Set(prev.files)
      if (newFiles.has(fileId)) {
        // 復活：最後尾に追加
        newFiles.delete(fileId)
      } else {
        // 無効化：ゴミ箱に移動
        newFiles.add(fileId)
      }
      return { ...prev, files: newFiles }
    })
  }

  const restoreFileFromTrash = (fileId: string) => {
    setDisabledState(prev => {
      const newFiles = new Set(prev.files)
      newFiles.delete(fileId)
      return { ...prev, files: newFiles }
    })
  }

  const handleUploadToCell = (position: number) => {
    // 後日実装予定のアップロード機能
    const row = Math.floor(position / 5)
    const col = position % 5
    const cellName = `${String.fromCharCode(65 + col)}${row + 1}`
    alert(`${cellName}セルへのアップロード機能は後日実装予定です`)
  }

  // 戦略変更時の処理
  const handleStrategyChange = (newStrategy: "row-first" | "col-first") => {
    setPlacementStrategy(newStrategy)
  }

  // センサー設定
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // ドラッグ開始処理
  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string
    const activeData = event.active.data.current

    console.log('🔄 Drag Start:', {
      activeId,
      activeData,
      type: activeData?.type,
      file: activeData?.file,
    })

    if (activeData?.type === 'trash-file') {
      // ゴミ箱からのドラッグ
      console.log('✅ Detected trash file drag:', activeData.file.name)
      setIsDraggingFromTrash(true)
      setActiveFile(activeData.file)
    } else {
      // テーブル内でのドラッグ
      const file = files.find((file) => file.id === activeId)
      console.log('✅ Detected table file drag:', file?.name || 'not found')
      setActiveFile(file || null)
    }
  }

  // ドラッグオーバー処理（kanban風 - コンテナ間移動）
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    const activeData = active.data.current
    const overData = over?.data.current

    if (!over) return

    const activeId = active.id.toString()
    const overId = over.id.toString()

    // アクティブとオーバーが異なるコンテナにある場合のみ処理
    const activeIsTrash = activeId.startsWith('trash-')
    const overIsTrash = overId.startsWith('trash-') || overId === 'trash-area'

    // ゴミ箱からテーブルへ
    if (activeIsTrash && !overIsTrash) {
      const file = activeData?.file
      
      if (!file) return // ファイルが存在しない場合は処理しない
      
      setFiles(prevFiles => {
        // 既に移動済みかチェック（undefinedファイルをフィルタ）
        const validFiles = prevFiles.filter(f => f && f.id)
        if (validFiles.some(f => f.id === file.id)) {
          return prevFiles
        }
        return [...prevFiles, file]
      })
      
      setDisabledState(prev => {
        const newFiles = new Set(prev.files)
        newFiles.delete(file.id)
        return { ...prev, files: newFiles }
      })
    }

    // テーブルからゴミ箱へ
    else if (!activeIsTrash && overIsTrash) {
      const fileId = active.id as string
      
      setDisabledState(prev => {
        const newFiles = new Set(prev.files)
        newFiles.add(fileId)
        return { ...prev, files: newFiles }
      })
    }
  }

  // ドラッグ終了処理（kanban風）
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    console.log('🔚 Drag End:', {
      activeId: active.id,
      overId: over?.id,
    })

    if (!over) {
      // ドラッグキャンセル - 状態を元に戻す
      console.log('🚫 Drag cancelled - reverting state')
      const activeData = active.data.current
      
      setDisabledState(prev => {
        const newFiles = new Set(prev.files)
        if (activeData?.type === 'trash-file') {
          newFiles.add(activeData.file.id)
        } else {
          newFiles.delete(active.id as string)
        }
        return { ...prev, files: newFiles }
      })
      
      // ゴミ箱からの一時的な追加をクリーンアップ
      if (activeData?.type === 'trash-file' && activeData?.file?.id) {
        setFiles(prevFiles => prevFiles.filter(f => f && f.id && f.id !== activeData.file.id))
      }
    } else {
      const activeId = active.id.toString()
      const overId = over.id.toString()

      const activeIsTrash = activeId.startsWith('trash-')
      const overIsTrash = overId.startsWith('trash-') || overId === 'trash-area'

      // 同じコンテナ内での移動
      if ((activeIsTrash && overIsTrash) || (!activeIsTrash && !overIsTrash)) {
        // テーブル内での並び替え
        if (!activeIsTrash && !overIsTrash && active.id !== over.id) {
          console.log('🔄 Table internal reorder')
          setFiles((files) => {
            const enabledFiles = getEnabledFiles()
            const mapping = getVirtualToRealMapping()
            
            const virtualOldIndex = enabledFiles.findIndex((file) => file && file.id === active.id)
            const virtualNewIndex = enabledFiles.findIndex((file) => file && file.id === over.id)
            
            if (virtualOldIndex === -1 || virtualNewIndex === -1) {
              console.warn('Invalid file indices for reorder')
              return files
            }
            
            const realOldIndex = mapping[virtualOldIndex]
            const realNewIndex = mapping[virtualNewIndex]
            
            if (realOldIndex === undefined || realNewIndex === undefined) {
              console.warn('Invalid real indices for reorder')
              return files
            }
            
            return arrayMove(files, realOldIndex, realNewIndex)
          })
        }
        // ゴミ箱内での移動は何もしない
      }
      // 異なるコンテナ間の移動は既にhandleDragOverで処理済み
      else {
        console.log('✅ Cross-container move confirmed')
      }
    }

    // 状態をリセット
    setActiveFile(null)
    setIsDraggingFromTrash(false)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Table DnD Kit Test</h1>
      
      {/* 配置戦略選択 */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => handleStrategyChange("row-first")}
              className={`px-3 py-1 rounded border text-sm ${
                placementStrategy === "row-first"
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white border-gray-300 hover:bg-gray-50"
              }`}
            >
              行優先 (A→B→C / D→E→F / ...)
            </button>
            <button
              onClick={() => handleStrategyChange("col-first")}
              className={`px-3 py-1 rounded border text-sm ${
                placementStrategy === "col-first"
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white border-gray-300 hover:bg-gray-50"
              }`}
            >
              列優先 (A→D→G / B→E→H / ...)
            </button>
          </div>
          <span className="text-sm text-gray-600">
            現在: <strong>{placementStrategy === "row-first" ? "行優先" : "列優先"}</strong>
          </span>
        </div>
      </div>

      {/* shadcn/ui テーブル */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">答案シートテーブル (5x5):</h2>
        
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {/* テーブル用のSortableContext */}
          <SortableContext 
            items={getEnabledFiles().map(file => file.id)} 
            strategy={rectSortingStrategy}
          >
            <Table className="w-fit">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24 text-center">生徒</TableHead>
                  {Array.from({ length: 5 }, (_, colIndex) => (
                    <TableHead 
                      key={colIndex} 
                      className={`w-32 text-center cursor-pointer hover:bg-gray-100 ${
                        disabledState.cols.has(colIndex) ? 'bg-red-100 text-red-600' : ''
                      }`}
                      onClick={() => toggleColDisabled(colIndex)}
                    >
                      {colIndex + 1}ページ目
                      {disabledState.cols.has(colIndex) && ' (無効)'}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* 配置戦略に応じてデータを再構成 */}
                {getTableData().map((rowFiles, rowIndex) => (
                  <TableRow key={rowIndex}>
                    <TableCell 
                      className={`font-medium text-center cursor-pointer hover:bg-gray-100 ${
                        disabledState.rows.has(rowIndex) ? 'bg-red-100 text-red-600' : ''
                      }`}
                      onClick={() => toggleRowDisabled(rowIndex)}
                    >
                      生徒 {rowIndex + 1}
                      {disabledState.rows.has(rowIndex) && ' (無効)'}
                    </TableCell>
                    {rowFiles.map((cellData, colIndex) => {
                      if (cellData.type === 'disabled') {
                        // 無効化セル（赤い背景）
                        return (
                          <TableCell
                            key={`disabled-${rowIndex}-${colIndex}`}
                            className={`border p-2 h-16 w-32 text-center bg-red-100 transition-colors ${
                              isDraggingFromTrash ? 'bg-blue-50 border-blue-300' : ''
                            }`}
                          >
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div className="w-full h-full flex items-center justify-center cursor-pointer">
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
                      
                      if (cellData.type === 'empty') {
                        // 空きセル
                        return (
                          <TableCell
                            key={`empty-${rowIndex}-${colIndex}`}
                            className={`border p-2 h-16 w-32 text-center bg-gray-50 transition-colors ${
                              isDraggingFromTrash ? 'bg-blue-50 border-blue-300' : ''
                            }`}
                          >
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div className="w-full h-full flex items-center justify-center cursor-pointer">
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
                      
                      // ファイルセル - ドロップも可能にする（シンプル）
                      const file = cellData.file!
                      const position = cellData.position
                      const isDisabledPosition = disabledState.positions.has(position)
                      const isFileDisabled = disabledState.files.has(file.id)
                      
                      return (
                        <SortableTableCell
                          key={file.id}
                          id={file.id}
                          onTogglePosition={() => togglePositionDisabled(position)}
                          onToggleFileDisabled={() => toggleFileDisabled(file.id)}
                          onUploadToCell={() => handleUploadToCell(position)}
                          position={position}
                          hasFile={true}
                          isPositionDisabled={isDisabledPosition}
                          isFileDisabled={isFileDisabled}
                        >
                          <div className={`flex flex-col items-center justify-center h-full ${
                            isDisabledPosition ? 'opacity-50' : isFileDisabled ? 'opacity-30' : ''
                          }`}>
                            <input
                              type="checkbox"
                              className="mb-1 cursor-pointer"
                              checked={isDisabledPosition}
                              onChange={() => togglePositionDisabled(position)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className={`w-8 h-8 rounded mb-1 ${file.color} ${
                              isFileDisabled ? 'ring-2 ring-red-300' : ''
                            }`} />
                            <div className={`text-sm font-medium ${
                              isFileDisabled ? 'text-red-500 line-through' : ''
                            }`}>{file.name}</div>
                            <div className="text-xs text-gray-500">{file.id}</div>
                          </div>
                        </SortableTableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SortableContext>

          {/* 無効化された答案画像（ゴミ箱） - ドロップ可能エリア */}
          <SortableContext 
            items={getDisabledFiles().map(file => `trash-${file.id}`)}
            strategy={rectSortingStrategy}
          >
            <DroppableTrashArea>
              <Card className="border-2 border-dashed border-red-300 bg-red-50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-red-700">
                    <Trash2 className="h-5 w-5" />
                    無効化した答案画像 ({getDisabledFiles().length}件)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {getDisabledFiles().length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-1">
                        {getDisabledFiles().map((file) => (
                          <DraggableTrashFile key={file.id} file={file} />
                        ))}
                      </div>
                      <div className="mt-3 text-xs text-red-600">
                        💡 双方向ドラッグ可能: 表 ⇄ ゴミ箱
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 h-16 flex items-center justify-center">
                        <div className="text-sm">表からファイルをドラッグしてここにドロップ</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </DroppableTrashArea>
          </SortableContext>
          
          {/* ドラッグ中のプレビュー表示 */}
          <DragOverlay>
            {activeFile ? (
              <div className="border-2 border-blue-400 p-2 h-16 w-32 flex flex-col items-center justify-center bg-white shadow-2xl transform rotate-3 scale-110 ring-4 ring-blue-200 ring-opacity-50">
                <div className={`w-8 h-8 rounded mb-1 ${activeFile.color}`} />
                <div className="text-sm font-medium">{activeFile.name}</div>
                <div className="text-xs text-gray-500">{activeFile.id}</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* 現在の順序表示 */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">状態情報:</h2>
        <div className="space-y-2">
          <div>
            <h3 className="text-md font-medium">
              全ファイル: {files.map(f => f.name).join(' → ')}
            </h3>
          </div>
          <div>
            <h3 className="text-md font-medium">
              有効ファイル: {getEnabledFiles().map(f => f.name).join(' → ')}
            </h3>
          </div>
          <div className="text-sm text-gray-600">
            無効化された行: {Array.from(disabledState.rows).map(r => `生徒${r+1}`).join(', ') || 'なし'}
          </div>
          <div className="text-sm text-gray-600">
            無効化された列: {Array.from(disabledState.cols).map(c => `${c+1}ページ`).join(', ') || 'なし'}
          </div>
          <div className="text-sm text-gray-600">
            無効化されたセル: {Array.from(disabledState.cells).join(', ') || 'なし'}
          </div>
          <div className="text-sm text-gray-600">
            無効化された位置: {Array.from(disabledState.positions).map(p => {
              const row = Math.floor(p / 5)
              const col = p % 5
              return `${String.fromCharCode(65 + col)}${row + 1}`
            }).join(', ') || 'なし'}
          </div>
          <div className="text-sm text-gray-600">
            無効化されたファイル: {Array.from(disabledState.files).map(fileId => {
              const file = files.find(f => f.id === fileId)
              return file ? file.name : fileId
            }).join(', ') || 'なし'}
          </div>
        </div>
      </div>
    </div>
  )
}