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
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// テスト用のファイル型
interface TestFile {
  id: string
  name: string
  color: string
}

// ソート可能なテーブルセルコンポーネント
function SortableTableCell({ 
  id, 
  children
}: { 
  id: string; 
  children: React.ReactNode;
}) {
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
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <TableCell
      ref={setNodeRef}
      style={style}
      className="border p-2 h-16 w-32 text-center cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      {children}
    </TableCell>
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
  })

  // ドラッグ状態管理
  const [activeFile, setActiveFile] = useState<TestFile | null>(null)

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
    return files.filter((_, index) => !isDisabled(index))
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
    
    // 次の有効ファイルを取得する関数
    const getNextFile = () => {
      while (nextFileIndex < files.length) {
        if (!isDisabled(nextFileIndex)) {
          return files[nextFileIndex++]
        }
        nextFileIndex++
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
    const file = files.find((file) => file.id === activeId)
    setActiveFile(file || null)
  }

  // ドラッグ終了処理（仮想→実インデックス変換）
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setFiles((files) => {
        const enabledFiles = getEnabledFiles()
        const mapping = getVirtualToRealMapping()
        
        // 仮想インデックス（有効ファイル内での位置）
        const virtualOldIndex = enabledFiles.findIndex((file) => file.id === active.id)
        const virtualNewIndex = enabledFiles.findIndex((file) => file.id === over.id)
        
        // 実インデックス（元のfiles配列での位置）
        const realOldIndex = mapping[virtualOldIndex]
        const realNewIndex = mapping[virtualNewIndex]
        
        console.log(`Virtual: ${virtualOldIndex} → ${virtualNewIndex}`)
        console.log(`Real: ${realOldIndex} → ${realNewIndex}`)
        
        return arrayMove(files, realOldIndex, realNewIndex)
      })
    }

    setActiveFile(null)
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
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={getEnabledFiles().map(file => file.id)} strategy={rectSortingStrategy}>
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
                          <TableCell key={`disabled-${rowIndex}-${colIndex}`} className="border p-2 h-16 w-32 text-center bg-red-100">
                            <div className="text-xs text-red-600">無効</div>
                          </TableCell>
                        )
                      }
                      
                      if (cellData.type === 'empty') {
                        // 空きセル
                        return (
                          <TableCell key={`empty-${rowIndex}-${colIndex}`} className="border p-2 h-16 w-32 text-center bg-gray-50">
                            <div className="text-xs text-gray-400">空き</div>
                          </TableCell>
                        )
                      }
                      
                      // ファイルセル
                      const file = cellData.file!
                      const position = cellData.position
                      const isDisabledPosition = disabledState.positions.has(position)
                      
                      return (
                        <SortableTableCell
                          key={file.id}
                          id={file.id}
                        >
                          <div className={`flex flex-col items-center justify-center h-full ${
                            isDisabledPosition ? 'opacity-50' : ''
                          }`}>
                            <input
                              type="checkbox"
                              className="mb-1 cursor-pointer"
                              checked={isDisabledPosition}
                              onChange={() => togglePositionDisabled(position)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className={`w-8 h-8 rounded mb-1 ${file.color}`} />
                            <div className="text-sm font-medium">{file.name}</div>
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
          
          {/* ドラッグ中のプレビュー表示 */}
          <DragOverlay>
            {activeFile ? (
              <div className="border p-2 h-16 w-32 flex flex-col items-center justify-center bg-white shadow-lg transform rotate-2 scale-105">
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
        </div>
      </div>
    </div>
  )
}