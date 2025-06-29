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
  DragOverEvent,
  DragOverlay,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

// シンプルなアイテム型
interface SimpleItem {
  id: string
  content: string
}

// ソート可能なアイテムコンポーネント（リスト用）
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
    transition,
    opacity: isDragging ? 0.5 : 1, // ドラッグ中は薄く表示（完全に消さない）
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-gray-300 rounded p-4 mb-2 cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}

// ソート可能なグリッドセルコンポーネント（表用）
function SortableGridCell({ 
  id, 
  children, 
  gridOrder 
}: { 
  id: string; 
  children: React.ReactNode;
  gridOrder?: number;
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
    opacity: isDragging ? 0.5 : 1, // ドラッグ中は薄く表示（完全に消さない）
    order: gridOrder, // CSSのorderで表示順を制御
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-gray-300 rounded p-2 h-24 w-32 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}

export default function SimpleDndKitTestPage() {
  // 配置戦略
  const [placementStrategy, setPlacementStrategy] = useState<"row-first" | "col-first">("row-first")

  // リスト用アイテム配列
  const [listItems, setListItems] = useState<SimpleItem[]>([
    { id: "list-1", content: "Item 1" },
    { id: "list-2", content: "Item 2" },
    { id: "list-3", content: "Item 3" },
    { id: "list-4", content: "Item 4" },
    { id: "list-5", content: "Item 5" },
  ])

  // グリッド用アイテム配列（3x3で9個）
  const [gridItems, setGridItems] = useState<SimpleItem[]>([
    { id: "grid-1", content: "A" },
    { id: "grid-2", content: "B" },
    { id: "grid-3", content: "C" },
    { id: "grid-4", content: "D" },
    { id: "grid-5", content: "E" },
    { id: "grid-6", content: "F" },
    { id: "grid-7", content: "G" },
    { id: "grid-8", content: "H" },
    { id: "grid-9", content: "I" },
  ])

  // ドラッグ状態管理
  const [activeItem, setActiveItem] = useState<SimpleItem | null>(null)

  // グリッド表示順序を計算する関数
  const getGridOrder = (index: number) => {
    if (placementStrategy === "row-first") {
      // 行優先: そのままの順序
      return index
    } else {
      // 列優先: CSSのorderで表示順を変更
      const row = Math.floor(index / 3)
      const col = index % 3
      return col * 3 + row
    }
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
    const item = [...listItems, ...gridItems].find((item) => item.id === activeId)
    setActiveItem(item || null)
  }

  // ドラッグ終了処理
  const handleDragEnd = (event: DragEndEvent, isGrid = false) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const setItems = isGrid ? setGridItems : setListItems
      
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }

    setActiveItem(null)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Simple DnD Kit Test</h1>
      
      {/* リスト版 */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-2">シンプルな縦並びリスト:</h2>
        
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={(e) => handleDragEnd(e, false)}
        >
          <SortableContext items={listItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
            <div className="max-w-md">
              {listItems.map((item) => (
                <SortableListItem key={item.id} id={item.id}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{item.content}</span>
                    <span className="text-sm text-gray-500">ID: {item.id}</span>
                  </div>
                </SortableListItem>
              ))}
            </div>
          </SortableContext>
          
          {/* ドラッグ中のプレビュー表示 */}
          <DragOverlay>
            {activeItem && activeItem.id.startsWith('list-') ? (
              <div className="bg-white border border-gray-300 rounded p-4 shadow-lg transform rotate-2 scale-105">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{activeItem.content}</span>
                  <span className="text-sm text-gray-500">ID: {activeItem.id}</span>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* グリッド版 */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-2">3x3 グリッド表:</h2>
        
        {/* 配置戦略選択 */}
        <div className="mb-4">
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
        
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={(e) => handleDragEnd(e, true)}
        >
          <SortableContext items={gridItems.map(item => item.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-2 w-fit">
              {gridItems.map((item, index) => (
                <SortableGridCell 
                  key={item.id} 
                  id={item.id}
                  gridOrder={getGridOrder(index)}
                >
                  <div className="text-center">
                    <div className="text-lg font-bold">{item.content}</div>
                    <div className="text-xs text-gray-500">{item.id}</div>
                  </div>
                </SortableGridCell>
              ))}
            </div>
          </SortableContext>
          
          {/* ドラッグ中のプレビュー表示 */}
          <DragOverlay>
            {activeItem && activeItem.id.startsWith('grid-') ? (
              <div className="bg-white border border-gray-300 rounded p-2 h-24 w-32 flex flex-col items-center justify-center shadow-lg transform rotate-3 scale-105">
                <div className="text-center">
                  <div className="text-lg font-bold">{activeItem.content}</div>
                  <div className="text-xs text-gray-500">{activeItem.id}</div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

      </div>

      {/* 現在の順序表示 */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">データ順序:</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-md font-medium mb-2">リスト: {listItems.map(i => i.content).join(' → ')}</h3>
          </div>
          <div>
            <h3 className="text-md font-medium mb-2">グリッド: {gridItems.map(i => i.content).join(' → ')}</h3>
          </div>
        </div>
      </div>
    </div>
  )
}