"use client"

import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useCallback, useEffect, useState } from "react"

// テスト用のファイル型
interface TestFile {
  id: string
  name: string
  color: string
}

// ソート可能なセルコンポーネント
function SortableCell({
  cellId,
  file,
  row,
  col,
  draggedFileId,
}: {
  cellId: string
  file?: TestFile
  row: number
  col: number
  draggedFileId: string | null
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: file?.id || cellId,
    disabled: !file,
    // ドラッグ中とドラッグ後のアニメーションを適切に制御
    animateLayoutChanges: (args) => {
      // ドラッグされている要素自体はアニメーションしない（DragOverlayが担当）
      if (args.isSorting && draggedFileId === file?.id) {
        return false
      }
      // その他の要素（B, C等）は自然にアニメーション
      return true
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    // アニメーション制御：抑制時は即座に移動、通常時はスムーズ
    transition: isDragging ? "none" : transition || "transform 200ms ease",
    // ドラッグ中の元セルは非表示にしてDragOverlayを見せる
    opacity: isDragging ? 0 : 1,
  }

  // Excelスタイルのセル名を生成（A1, B2など）
  const getExcelCellName = (row: number, col: number) => {
    const columnLetter = String.fromCharCode(65 + col) // 0→A, 1→B, 2→C
    const rowNumber = row + 1 // 0→1, 1→2, 2→3
    return `${columnLetter}${rowNumber}`
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex h-24 w-32 flex-col items-center justify-center rounded-lg border-2 border-gray-300 p-2 ${file ? "cursor-grab bg-white" : "bg-gray-100"} ${isDragging ? "ring-2 ring-blue-500" : ""} `}
      {...attributes}
      {...listeners}
    >
      <div className="mb-1 font-mono text-xs text-gray-500">
        {getExcelCellName(row, col)}
      </div>
      {file ? (
        <div className="text-center">
          <div className={`mb-1 h-8 w-8 rounded ${file.color}`} />
          <div className="text-xs font-medium">{file.name}</div>
          <div className="text-xs text-gray-400">{file.id.slice(0, 6)}</div>
        </div>
      ) : (
        <div className="text-xs text-gray-400">空き</div>
      )}
    </div>
  )
}

export default function DndKitTestPage() {
  // 配置戦略
  const [placementStrategy, setPlacementStrategy] = useState<
    "row-first" | "col-first"
  >("row-first")

  // ファイル配列（順序管理用）
  const [files, setFiles] = useState<TestFile[]>([
    { id: "file-001", name: "File A", color: "bg-red-200" },
    { id: "file-002", name: "File B", color: "bg-blue-200" },
    { id: "file-003", name: "File C", color: "bg-green-200" },
    { id: "file-004", name: "File D", color: "bg-yellow-200" },
    { id: "file-005", name: "File E", color: "bg-purple-200" },
  ])

  // ドラッグ状態管理
  const [activeFile, setActiveFile] = useState<TestFile | null>(null)
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null)

  // セル位置からファイルを取得する関数
  const getFileAtPosition = useCallback(
    (row: number, col: number): TestFile | undefined => {
      let index: number

      if (placementStrategy === "row-first") {
        // 行優先：0行目全部 → 1行目全部 → 2行目全部
        index = row * 3 + col
      } else {
        // 列優先：0列目全部 → 1列目全部 → 2列目全部
        index = col * 3 + row
      }

      return files[index]
    },
    [files, placementStrategy]
  )

  // クライアントサイドマウント状態
  const [isMounted, setIsMounted] = useState(false)

  // 初期配置
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setIsMounted(true)
    })

    return () => cancelAnimationFrame(frame)
  }, [])

  // 戦略変更時の自動配置
  const handleStrategyChange = (newStrategy: "row-first" | "col-first") => {
    setPlacementStrategy(newStrategy)
    // 戦略変更時はファイル配列をリセット（初期順序に戻す）
    setFiles([
      { id: "file-001", name: "File A", color: "bg-red-200" },
      { id: "file-002", name: "File B", color: "bg-blue-200" },
      { id: "file-003", name: "File C", color: "bg-green-200" },
      { id: "file-004", name: "File D", color: "bg-yellow-200" },
      { id: "file-005", name: "File E", color: "bg-purple-200" },
    ])
  }

  // dnd-kit センサー
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // ドラッグ開始処理
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const activeId = event.active.id as string
      const file = files.find((f) => f.id === activeId)
      setActiveFile(file || null)
      setDraggedFileId(activeId)
    },
    [files]
  )

  // ドラッグ終了処理（dragend時にデータ確定）
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      setActiveFile(null)
      setDraggedFileId(null)
      return
    }

    // ファイル配列を更新（DragOverlay完了後）
    setFiles((prevFiles) => {
      const activeIndex = prevFiles.findIndex((f) => f.id === active.id)
      const overIndex = prevFiles.findIndex((f) => f.id === over.id)

      if (activeIndex === -1 || overIndex === -1) return prevFiles

      return arrayMove(prevFiles, activeIndex, overIndex)
    })

    // 状態をリセット（即座に）
    setActiveFile(null)
    setDraggedFileId(null)
  }

  // ドラッグ可能なファイルIDリスト
  const sortableFileIds = files.slice(0, 9).map((f) => f.id) // 最大9個（3x3）

  // サーバーサイドレンダリング時は何も表示しない
  if (!isMounted) {
    return (
      <div className="p-8">
        <h1 className="mb-6 text-2xl font-bold">DnD Kit Test Page</h1>
        <div className="flex h-64 items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold">DnD Kit Test Page</h1>

      {/* ファイル一覧表示 */}
      <div className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">元のファイル順序:</h2>
        <div className="flex gap-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 rounded border p-2"
            >
              <div className={`h-4 w-4 rounded ${file.color}`} />
              <span className="text-sm">{file.name}</span>
              <span className="text-xs text-gray-500">
                ({file.id.slice(0, 6)})
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 配置戦略選択 */}
      <div className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">配置戦略:</h2>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => handleStrategyChange("row-first")}
              className={`rounded border px-4 py-2 ${
                placementStrategy === "row-first"
                  ? "border-blue-500 bg-blue-500 text-white"
                  : "border-gray-300 bg-white hover:bg-gray-50"
              }`}
            >
              行優先 (A→B→C / D→E→...)
            </button>
            <button
              onClick={() => handleStrategyChange("col-first")}
              className={`rounded border px-4 py-2 ${
                placementStrategy === "col-first"
                  ? "border-blue-500 bg-blue-500 text-white"
                  : "border-gray-300 bg-white hover:bg-gray-50"
              }`}
            >
              列優先 (A→D→空 / B→E→空 / ...)
            </button>
          </div>
          <button
            onClick={() => handleStrategyChange(placementStrategy)}
            className="rounded border border-green-500 bg-green-500 px-4 py-2 text-white hover:bg-green-600"
          >
            リセット
          </button>
        </div>
        <div className="mt-2 text-sm text-gray-600">
          現在の戦略:{" "}
          <strong>
            {placementStrategy === "row-first" ? "行優先" : "列優先"}
          </strong>
        </div>
      </div>

      {/* 3x3 グリッド */}
      <div className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">
          3x3 グリッド (ドラッグ&ドロップ可能):
        </h2>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          // レイアウト変更時のアニメーションを制御
          autoScroll={false}
        >
          <SortableContext
            items={sortableFileIds}
            strategy={rectSortingStrategy}
          >
            <div className="grid w-fit grid-cols-3 gap-4">
              {Array.from({ length: 3 }, (_, row) =>
                Array.from({ length: 3 }, (_, col) => {
                  const cellId = `${row}-${col}`
                  const file = getFileAtPosition(row, col)

                  return (
                    <SortableCell
                      key={cellId}
                      cellId={cellId}
                      file={file}
                      row={row}
                      col={col}
                      draggedFileId={draggedFileId}
                    />
                  )
                })
              )}
            </div>
          </SortableContext>

          {/* ドラッグ中のプレビュー表示 */}
          <DragOverlay
            dropAnimation={{
              duration: 200,
              easing: "ease-out",
            }}
          >
            {activeFile ? (
              <div className="flex h-24 w-32 scale-105 rotate-3 flex-col items-center justify-center rounded-lg border-2 border-blue-500 bg-white p-2 shadow-lg">
                <div className="text-center">
                  <div className={`mb-1 h-8 w-8 rounded ${activeFile.color}`} />
                  <div className="text-xs font-medium">{activeFile.name}</div>
                  <div className="text-xs text-gray-400">
                    {activeFile.id.slice(0, 6)}
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* 現在のファイル順序表示 */}
      <div className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">現在のファイル順序:</h2>
        <div className="rounded bg-gray-100 p-4">
          <pre className="text-xs">
            {JSON.stringify(
              files.map((f) => ({ id: f.id, name: f.name })),
              null,
              2
            )}
          </pre>
        </div>

        {/* グリッド配置の視覚化 */}
        <div className="mt-4">
          <h3 className="text-md mb-2 font-medium">
            グリッド配置（
            {placementStrategy === "row-first" ? "行優先" : "列優先"}）:
          </h3>
          <div className="grid w-fit grid-cols-3 gap-2">
            {Array.from({ length: 3 }, (_, row) =>
              Array.from({ length: 3 }, (_, col) => {
                const file = getFileAtPosition(row, col)
                const getExcelCellName = (r: number, c: number) => {
                  const columnLetter = String.fromCharCode(65 + c)
                  const rowNumber = r + 1
                  return `${columnLetter}${rowNumber}`
                }

                return (
                  <div
                    key={`${row}-${col}`}
                    className="flex h-12 w-16 flex-col items-center justify-center rounded border bg-white text-xs"
                  >
                    <div className="font-mono text-gray-500">
                      {getExcelCellName(row, col)}
                    </div>
                    <div className="font-medium">{file?.name || "空き"}</div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
