"use client"

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
import { Ban, Trash2, Upload, X } from "lucide-react"
import { useState } from "react"

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
      className={`h-16 w-32 cursor-grab border p-2 text-center transition-all duration-200 active:cursor-grabbing ${
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

// ドロップ可能なPopoverトリガーボタン
function DroppableTrashButton({
  trashCount,
  onClick,
  droppableId = "trash-popover-trigger",
}: {
  trashCount: number
  onClick?: () => void
  droppableId?: string
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { type: "trash" },
  })

  const handleClick = () => {
    // ドラッグ中でない場合のみクリックイベントを実行
    if (!isOver && onClick) {
      onClick()
    }
  }

  return (
    <Button
      ref={setNodeRef}
      variant="outline"
      className={`h-12 w-48 cursor-pointer transition-all duration-300 ease-in-out ${
        isOver
          ? "ring-opacity-50 scale-105 border-blue-400 shadow-lg ring-2 ring-blue-200"
          : "hover:bg-gray-50"
      }`}
      onClick={handleClick}
    >
      <div className="flex items-center gap-2 text-xs">
        <Trash2 className="h-4 w-4" />
        <span className="text-center leading-tight">
          ここにドラッグして
          <br />
          答案を無効化
        </span>
        <span className="text-xs text-gray-500">({trashCount}件)</span>
      </div>
    </Button>
  )
}

// ドロップ可能なゴミ箱エリア（simple-dnd-kit-test準拠）
function TrashArea({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "trash-area",
    data: { type: "trash" },
  })

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 border-dashed p-4 transition-all duration-300 ease-in-out ${
        isOver
          ? "ring-opacity-50 scale-[1.02] border-red-400 bg-red-50 shadow-lg ring-2 ring-red-200"
          : "border-red-300 bg-red-50/50 hover:bg-red-100/50"
      }`}
    >
      {children}
    </div>
  )
}

// ソート可能なアイテムコンポーネント（simple-dnd-kit-test完全準拠）
function SortableListItem({
  id,
  children,
  data,
}: {
  id: string
  children: React.ReactNode
  data?: Record<string, unknown>
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || "transform 150ms ease", // 滑らかな移動アニメーション
    opacity: isDragging ? 0.5 : 1, // ドラッグ中は薄く表示（完全に消さない）
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group mb-2 cursor-grab rounded-lg border border-gray-200 bg-white p-4 transition-all duration-300 ease-in-out hover:scale-[1.01] hover:border-gray-300 hover:shadow-md active:scale-[0.98] active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}

export default function TableDndKitTestPage() {
  // 配置戦略
  const [placementStrategy, setPlacementStrategy] = useState<
    "row-first" | "col-first"
  >("row-first")

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

  // Popover状態管理
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  // セル位置が無効化されているかチェック
  const isPositionDisabled = (position: number) => {
    const row = Math.floor(position / 5)
    const col = position % 5

    return (
      disabledState.rows.has(row) ||
      disabledState.cols.has(col) ||
      disabledState.positions.has(position)
    )
  }

  // 有効なファイルのみ取得（dnd-kit用）
  const getEnabledFiles = () => {
    return files.filter(
      (file) => file && file.id && !disabledState.files.has(file.id)
    )
  }

  // 無効化されたファイルのみ取得
  const getDisabledFiles = () => {
    return files.filter(
      (file) => file && file.id && disabledState.files.has(file.id)
    )
  }

  // テーブルセルのデータ型定義
  interface CellData {
    type: "disabled" | "file" | "empty"
    position: number
    file?: TestFile
  }

  // テーブルデータを配置戦略に応じて再構成（5x5）
  const getTableData = (): CellData[][] => {
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
      const result: CellData[][] = []
      for (let row = 0; row < 5; row++) {
        const rowFiles: CellData[] = []
        for (let col = 0; col < 5; col++) {
          const position = row * 5 + col

          if (isPositionDisabled(position)) {
            // 無効セル：赤い背景で表示、配置はスキップ
            rowFiles.push({ type: "disabled", position })
          } else {
            const nextFile = getNextFile()
            if (nextFile) {
              // 有効セル：次のファイルを配置
              rowFiles.push({ type: "file", file: nextFile, position })
            } else {
              // ファイル不足：空きとして表示
              rowFiles.push({ type: "empty", position })
            }
          }
        }
        result.push(rowFiles)
      }
      return result
    } else {
      // 列優先配置
      const result: CellData[][] = Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 5 }, (_, col) => {
          const position = row * 5 + col
          if (isPositionDisabled(position)) {
            return { type: "disabled", position }
          } else {
            return { type: "empty", position }
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
              result[row][col] = { type: "file", file: nextFile, position }
            }
          }
        }
      }

      return result
    }
  }

  // 無効化トグル関数
  const toggleRowDisabled = (row: number) => {
    setDisabledState((prev) => {
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
    setDisabledState((prev) => {
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
    setDisabledState((prev) => {
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
    setDisabledState((prev) => {
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

  // アイテムがどのコンテナにあるかを見つける関数（simple-dnd-kit-test準拠）
  const findContainer = (id: string) => {
    // コンテナ自体の場合
    if (id === "trash-area" || id === "trash-popover-trigger") return "trash"

    // テーブルファイルの場合
    const enabledFile = getEnabledFiles().find((file) => file.id === id)
    if (enabledFile) {
      return "main"
    }

    // ゴミ箱ファイルの場合
    const disabledFile = getDisabledFiles().find((file) => file.id === id)
    if (disabledFile) {
      return "trash"
    }

    return null
  }

  // センサー設定
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // ドラッグ開始処理（simple-dnd-kit-test完全準拠）
  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string
    const foundFile = files.find((file) => file.id === activeId) || null
    setActiveFile(foundFile)
  }

  // ドラッグオーバー処理（simple-dnd-kit-test完全準拠）
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id.toString()
    const overId = over.id.toString()

    // ボタンにhoverした時にpopoverを開く
    if (overId === "trash-popover-trigger") {
      setIsPopoverOpen(true)
    }

    const activeContainer = findContainer(activeId)
    const overContainer = findContainer(overId)

    if (activeContainer !== overContainer && overContainer && activeContainer) {
      // コンテナ間移動：即座にdisabledStateを更新（simple-dnd-kit-testのcolumnId変更と同等）
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

  // ドラッグ終了処理（simple-dnd-kit-test完全準拠）
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

    const activeContainer = findContainer(activeId)
    const overContainer = findContainer(overId)

    if (activeContainer === overContainer && activeId !== overId) {
      // 同一コンテナ内での並び替え（simple-dnd-kit-testと同じロジック）
      setFiles((prevFiles) => {
        const oldIndex = prevFiles.findIndex((file) => file.id === activeId)
        const newIndex = prevFiles.findIndex((file) => file.id === overId)
        return arrayMove(prevFiles, oldIndex, newIndex)
      })
    }

    setActiveFile(null)
    setIsDraggingFromTrash(false)
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold">Table DnD Kit Test</h1>

      {/* 配置戦略選択 */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => handleStrategyChange("row-first")}
              className={`rounded border px-3 py-1 text-sm ${
                placementStrategy === "row-first"
                  ? "border-blue-500 bg-blue-500 text-white"
                  : "border-gray-300 bg-white hover:bg-gray-50"
              }`}
            >
              行優先 (A→B→C / D→E→F / ...)
            </button>
            <button
              onClick={() => handleStrategyChange("col-first")}
              className={`rounded border px-3 py-1 text-sm ${
                placementStrategy === "col-first"
                  ? "border-blue-500 bg-blue-500 text-white"
                  : "border-gray-300 bg-white hover:bg-gray-50"
              }`}
            >
              列優先 (A→D→G / B→E→H / ...)
            </button>
          </div>
          <span className="text-sm text-gray-600">
            現在:{" "}
            <strong>
              {placementStrategy === "row-first" ? "行優先" : "列優先"}
            </strong>
          </span>
        </div>
      </div>

      {/* shadcn/ui テーブル */}
      <div className="mb-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="mb-3 flex h-20 items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-green-800">
                答案シートテーブル (5x5)
              </h2>
              <span className="rounded-full bg-green-100 px-2 py-1 text-sm text-green-700">
                {getEnabledFiles().length}件
              </span>
            </div>

            {/* ゴミ箱ボタン（Popover） */}
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <div>
                  <DroppableTrashButton
                    trashCount={getDisabledFiles().length}
                    onClick={() => setIsPopoverOpen(!isPopoverOpen)}
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-4" side="bottom" align="end">
                <TrashArea>
                  <div className="max-h-64 min-h-48 overflow-y-auto">
                    <SortableContext
                      items={getDisabledFiles().map((file) => file.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {getDisabledFiles().map((file) => (
                          <SortableListItem key={file.id} id={file.id}>
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-red-600 line-through">
                                    {file.name}
                                  </span>
                                  <span className="text-sm text-red-400">
                                    ID: {file.id}
                                  </span>
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
                          </SortableListItem>
                        ))}

                        {getDisabledFiles().length === 0 && (
                          <div className="py-6 text-center text-gray-500">
                            <Trash2 className="mx-auto mb-2 h-6 w-6 opacity-50" />
                            <div className="text-sm">
                              アイテムをここにドラッグ
                            </div>
                          </div>
                        )}
                      </div>
                    </SortableContext>
                  </div>
                </TrashArea>
              </PopoverContent>
            </Popover>
          </div>
          {/* 全ファイル用のSortableContext（テーブル + ゴミ箱） */}
          <SortableContext
            items={[
              ...getEnabledFiles().map((file) => file.id),
              ...getDisabledFiles().map((file) => file.id),
            ]}
            strategy={rectSortingStrategy}
          >
            <Table className="w-fit">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24 text-center">生徒</TableHead>
                  {Array.from({ length: 5 }, (_, colIndex) => (
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
                {/* 配置戦略に応じてデータを再構成 */}
                {getTableData().map((rowFiles, rowIndex) => (
                  <TableRow key={rowIndex}>
                    <TableCell
                      className={`cursor-pointer text-center font-medium hover:bg-gray-100 ${
                        disabledState.rows.has(rowIndex)
                          ? "bg-red-100 text-red-600"
                          : ""
                      }`}
                      onClick={() => toggleRowDisabled(rowIndex)}
                    >
                      生徒 {rowIndex + 1}
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
                                  <div className="text-xs text-red-600">
                                    無効
                                  </div>
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                <ContextMenuItem
                                  onClick={() =>
                                    togglePositionDisabled(cellData.position)
                                  }
                                  className="flex items-center gap-2"
                                >
                                  <X className="h-4 w-4" />
                                  セルを有効化
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                  onClick={() =>
                                    handleUploadToCell(cellData.position)
                                  }
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
                                  <div className="text-xs text-gray-400">
                                    空き
                                  </div>
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                <ContextMenuItem
                                  onClick={() =>
                                    togglePositionDisabled(cellData.position)
                                  }
                                  className="flex items-center gap-2"
                                >
                                  <Ban className="h-4 w-4" />
                                  セルを無効化
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                  onClick={() =>
                                    handleUploadToCell(cellData.position)
                                  }
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
                      const isDisabledPosition =
                        disabledState.positions.has(position)
                      const isFileDisabled = disabledState.files.has(file.id)

                      return (
                        <SortableTableCell
                          key={file.id}
                          id={file.id}
                          onTogglePosition={() =>
                            togglePositionDisabled(position)
                          }
                          onToggleFileDisabled={() =>
                            toggleFileDisabled(file.id)
                          }
                          onUploadToCell={() => handleUploadToCell(position)}
                          position={position}
                          hasFile={true}
                          isPositionDisabled={isDisabledPosition}
                          isFileDisabled={isFileDisabled}
                        >
                          <div
                            className={`flex h-full flex-col items-center justify-center ${
                              isDisabledPosition
                                ? "opacity-50"
                                : isFileDisabled
                                  ? "opacity-30"
                                  : ""
                            }`}
                          >
                            <div
                              className={`mb-1 h-8 w-8 rounded ${file.color} ${
                                isFileDisabled ? "ring-2 ring-red-300" : ""
                              }`}
                            />
                            <div
                              className={`text-sm font-medium ${
                                isFileDisabled
                                  ? "text-red-500 line-through"
                                  : ""
                              }`}
                            >
                              {file.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {file.id}
                            </div>
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
              <div className="ring-opacity-50 flex h-16 w-32 scale-110 rotate-3 transform flex-col items-center justify-center border-2 border-blue-400 bg-white p-2 shadow-2xl ring-4 ring-blue-200">
                <div className={`mb-1 h-8 w-8 rounded ${activeFile.color}`} />
                <div className="text-sm font-medium">{activeFile.name}</div>
                <div className="text-xs text-gray-500">{activeFile.id}</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* 現在の順序表示 */}
      <div className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">状態情報:</h2>
        <div className="space-y-2">
          <div>
            <h3 className="text-md font-medium">
              全ファイル: {files.map((f) => f.name).join(" → ")}
            </h3>
          </div>
          <div>
            <h3 className="text-md font-medium">
              有効ファイル:{" "}
              {getEnabledFiles()
                .map((f) => f.name)
                .join(" → ")}
            </h3>
          </div>
          <div className="text-sm text-gray-600">
            無効化された行:{" "}
            {Array.from(disabledState.rows)
              .map((r) => `生徒${r + 1}`)
              .join(", ") || "なし"}
          </div>
          <div className="text-sm text-gray-600">
            無効化された列:{" "}
            {Array.from(disabledState.cols)
              .map((c) => `${c + 1}ページ`)
              .join(", ") || "なし"}
          </div>
          <div className="text-sm text-gray-600">
            無効化されたセル:{" "}
            {Array.from(disabledState.cells).join(", ") || "なし"}
          </div>
          <div className="text-sm text-gray-600">
            無効化された位置:{" "}
            {Array.from(disabledState.positions)
              .map((p) => {
                const row = Math.floor(p / 5)
                const col = p % 5
                return `${String.fromCharCode(65 + col)}${row + 1}`
              })
              .join(", ") || "なし"}
          </div>
          <div className="text-sm text-gray-600">
            無効化されたファイル:{" "}
            {Array.from(disabledState.files)
              .map((fileId) => {
                const file = files.find((f) => f.id === fileId)
                return file ? file.name : fileId
              })
              .join(", ") || "なし"}
          </div>
        </div>
      </div>
    </div>
  )
}
