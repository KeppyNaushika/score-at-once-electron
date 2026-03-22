"use client"

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
import { Trash2 } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// アイテム型（recursive-dnd-kanban-board準拠）
interface SimpleItem {
  id: string
  columnId: string // 所属コンテナID
  content: string
}

// ソート可能なアイテムコンポーネント（リスト用）
function SortableListItem({
  id,
  children,
}: {
  id: string
  children: React.ReactNode
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

// ソート可能なグリッドセルコンポーネント（表用）
function SortableGridCell({
  id,
  children,
  gridOrder,
}: {
  id: string
  children: React.ReactNode
  gridOrder?: number
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
      className="flex h-24 w-32 cursor-grab flex-col items-center justify-center rounded border border-gray-300 bg-white p-2 active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}

// ドロップ可能なメインリストエリア
function MainListArea({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "main-area",
    data: { type: "main" },
  })

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 border-dashed p-4 transition-all duration-300 ease-in-out ${
        isOver
          ? "ring-opacity-50 scale-[1.02] border-blue-400 bg-blue-50 shadow-lg ring-2 ring-blue-200"
          : "border-gray-300 bg-gray-50/50 hover:bg-gray-100/50"
      }`}
    >
      {children}
    </div>
  )
}

// ドロップ可能なグリッド表エリア
function GridArea({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "grid-area",
    data: { type: "grid" },
  })

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 border-dashed border-green-300 bg-green-50/50 p-4 transition-all duration-300 ease-in-out ${
        isOver
          ? "ring-opacity-50 scale-[1.02] border-green-400 bg-green-100 shadow-lg ring-2 ring-green-200"
          : "hover:bg-green-100/50"
      }`}
    >
      {children}
    </div>
  )
}

// ドロップ可能なゴミ箱エリア
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
    data: { type: droppableId.includes("grid") ? "grid-trash" : "trash" },
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

// ドロップ可能なグリッド用ゴミ箱エリア
function GridTrashArea({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "grid-trash-area",
    data: { type: "grid-trash" },
  })

  return (
    <div
      ref={setNodeRef}
      className={`min-h-24 rounded-lg border-2 border-dashed border-red-300 bg-red-50 p-4 transition-all duration-300 ease-in-out ${
        isOver
          ? "ring-opacity-50 scale-[1.02] border-red-400 bg-red-100 shadow-lg ring-2 ring-red-200"
          : "hover:bg-red-100/50"
      }`}
    >
      {children}
    </div>
  )
}

// Kanbanリストコンポーネント
function KanbanLists({
  items,
  setItems,
  activeItem,
  setActiveItem,
  findContainer,
  sensors,
}: {
  items: SimpleItem[]
  setItems: React.Dispatch<React.SetStateAction<SimpleItem[]>>
  activeItem: SimpleItem | null
  setActiveItem: React.Dispatch<React.SetStateAction<SimpleItem | null>>
  findContainer: (id: string) => string | null
  sensors: ReturnType<typeof useSensors>
}) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const getItemsInContainer = (containerId: string) => {
    return items.filter((item) => item.columnId === containerId)
  }

  const listItems = getItemsInContainer("main")
  const trashItems = getItemsInContainer("trash")

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string
    const foundItem = items.find((item) => item.id === activeId) || null
    setActiveItem(foundItem)

    // メインリストからのドラッグの場合、Popoverを開く
    const activeContainer = findContainer(activeId)
    if (activeContainer === "main") {
      setIsPopoverOpen(true)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id.toString()
    const overId = over.id.toString()

    const activeContainer = findContainer(activeId)
    const overContainer = findContainer(overId)

    if (activeContainer !== overContainer && overContainer && activeContainer) {
      setItems((prevItems) => {
        return prevItems.map((item) =>
          item.id === activeId ? { ...item, columnId: overContainer } : item
        )
      })
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) {
      setActiveItem(null)
      return
    }

    const activeId = active.id.toString()
    const overId = over.id.toString()

    if (activeId === overId) {
      setActiveItem(null)
      return
    }

    const activeContainer = findContainer(activeId)
    const overContainer = findContainer(overId)

    if (activeContainer === overContainer && activeId !== overId) {
      setItems((prevItems) => {
        const oldIndex = prevItems.findIndex((item) => item.id === activeId)
        const newIndex = prevItems.findIndex((item) => item.id === overId)
        return arrayMove(prevItems, oldIndex, newIndex)
      })
    }

    setActiveItem(null)
  }

  return (
    <div className="mb-8">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-800">
        📋 Kanban風リスト
        <span className="text-sm font-normal text-gray-500">
          - 完璧なクロスコンテナドラッグ&ドロップ
        </span>
      </h2>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col">
          {/* ヘッダー部分 */}
          <div className="mb-3 flex h-20 items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-blue-800">
                📝 メインリスト
              </h3>
              <span className="rounded-full bg-blue-100 px-2 py-1 text-sm text-blue-700">
                {listItems.length}件
              </span>
            </div>

            {/* ゴミ箱ボタン（Popover） */}
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <div>
                  <DroppableTrashButton
                    trashCount={trashItems.length}
                    onClick={() => setIsPopoverOpen(!isPopoverOpen)}
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-4" side="bottom" align="end">
                <TrashArea>
                  <div className="max-h-64 min-h-48 overflow-y-auto">
                    <SortableContext
                      items={trashItems.map((item) => item.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {trashItems.map((item) => (
                          <SortableListItem key={item.id} id={item.id}>
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-red-600 line-through">
                                {item.content}
                              </span>
                              <span className="text-sm text-red-400">
                                ID: {item.id}
                              </span>
                            </div>
                          </SortableListItem>
                        ))}

                        {trashItems.length === 0 && (
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

          {/* メインリストコンテンツ */}
          <MainListArea>
            <div className="min-h-96">
              <SortableContext
                items={listItems.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {listItems.map((item) => (
                    <SortableListItem key={item.id} id={item.id}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{item.content}</span>
                        <span className="text-sm text-gray-500">
                          ID: {item.id}
                        </span>
                      </div>
                    </SortableListItem>
                  ))}

                  {listItems.length === 0 && (
                    <div className="py-8 text-center text-gray-500">
                      <div className="text-sm">リストが空です</div>
                    </div>
                  )}
                </div>
              </SortableContext>
            </div>
          </MainListArea>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <div className="ring-opacity-30 scale-110 rotate-3 transform rounded-lg border-2 border-blue-400 bg-white p-4 shadow-2xl ring-4 ring-blue-200 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-800">
                  {activeItem.content}
                </span>
                <span className="rounded-full bg-blue-100 px-2 py-1 text-sm text-blue-600">
                  ID: {activeItem.id}
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

// グリッド表コンポーネント
function GridTable({
  gridItems,
  setGridItems,
  activeItem,
  setActiveItem,
  findContainer,
  sensors,
  placementStrategy,
}: {
  gridItems: SimpleItem[]
  setGridItems: React.Dispatch<React.SetStateAction<SimpleItem[]>>
  activeItem: SimpleItem | null
  setActiveItem: React.Dispatch<React.SetStateAction<SimpleItem | null>>
  findContainer: (id: string) => string | null
  sensors: ReturnType<typeof useSensors>
  placementStrategy: "row-first" | "col-first"
}) {
  const [isGridPopoverOpen, setIsGridPopoverOpen] = useState(false)
  const getItemsInContainer = (containerId: string) => {
    return gridItems.filter((item) => item.columnId === containerId)
  }

  const tableItems = getItemsInContainer("grid")
  const gridTrashItems = getItemsInContainer("grid-trash")

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string
    const foundItem = gridItems.find((item) => item.id === activeId) || null
    setActiveItem(foundItem)

    // グリッド表からのドラッグの場合、Popoverを開く
    const activeContainer = findContainer(activeId)
    if (activeContainer === "grid") {
      setIsGridPopoverOpen(true)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id.toString()
    const overId = over.id.toString()

    const activeContainer = findContainer(activeId)
    const overContainer = findContainer(overId)

    if (activeContainer !== overContainer && overContainer && activeContainer) {
      setGridItems((prevItems) => {
        return prevItems.map((item) =>
          item.id === activeId ? { ...item, columnId: overContainer } : item
        )
      })
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) {
      setActiveItem(null)
      return
    }

    const activeId = active.id.toString()
    const overId = over.id.toString()

    if (activeId === overId) {
      setActiveItem(null)
      return
    }

    const activeContainer = findContainer(activeId)
    const overContainer = findContainer(overId)

    if (activeContainer === overContainer && activeId !== overId) {
      setGridItems((prevItems) => {
        const oldIndex = prevItems.findIndex((item) => item.id === activeId)
        const newIndex = prevItems.findIndex((item) => item.id === overId)
        return arrayMove(prevItems, oldIndex, newIndex)
      })
    }

    setActiveItem(null)
  }

  // グリッド表示順序を計算する関数
  const getGridOrder = (index: number) => {
    if (placementStrategy === "row-first") {
      return index
    } else {
      const row = Math.floor(index / 3)
      const col = index % 3
      return col * 3 + row
    }
  }

  return (
    <div className="mb-8">
      <h2 className="mb-2 text-lg font-semibold">3x3 グリッド表:</h2>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col">
          {/* ヘッダー部分 */}
          <div className="mb-3 flex h-20 items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-md font-semibold text-green-800">
                グリッド表
              </h3>
              <span className="rounded-full bg-green-100 px-2 py-1 text-sm text-green-700">
                {tableItems.length}件
              </span>
            </div>

            {/* グリッド用ゴミ箱ボタン（Popover） */}
            <Popover
              open={isGridPopoverOpen}
              onOpenChange={setIsGridPopoverOpen}
            >
              <PopoverTrigger asChild>
                <div>
                  <DroppableTrashButton
                    trashCount={gridTrashItems.length}
                    onClick={() => setIsGridPopoverOpen(!isGridPopoverOpen)}
                    droppableId="grid-trash-popover-trigger"
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-4" side="bottom" align="end">
                <GridTrashArea>
                  <div className="max-h-64 min-h-48 overflow-y-auto">
                    <SortableContext
                      items={gridTrashItems.map((item) => item.id)}
                      strategy={rectSortingStrategy}
                    >
                      {gridTrashItems.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {gridTrashItems.map((item) => (
                            <SortableGridCell key={item.id} id={item.id}>
                              <div className="text-center opacity-70">
                                <div className="text-lg font-bold text-red-600 line-through">
                                  {item.content}
                                </div>
                                <div className="text-xs text-red-400">
                                  {item.id}
                                </div>
                              </div>
                            </SortableGridCell>
                          ))}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-gray-500">
                          <Trash2 className="mx-auto mb-2 h-6 w-6 opacity-50" />
                          <div className="text-sm">
                            グリッドアイテムをここにドラッグ
                          </div>
                        </div>
                      )}
                    </SortableContext>
                  </div>
                </GridTrashArea>
              </PopoverContent>
            </Popover>
          </div>

          {/* グリッド表コンテンツ */}
          <GridArea>
            <SortableContext
              items={tableItems.map((item) => item.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid w-fit grid-cols-3 gap-2">
                {Array.from({ length: 9 }, (_, index) => {
                  const item = tableItems[index]
                  return (
                    <div key={index} style={{ order: getGridOrder(index) }}>
                      {item ? (
                        <SortableGridCell
                          id={item.id}
                          gridOrder={getGridOrder(index)}
                        >
                          <div className="text-center">
                            <div className="text-lg font-bold">
                              {item.content}
                            </div>
                            <div className="text-xs text-gray-500">
                              {item.id}
                            </div>
                          </div>
                        </SortableGridCell>
                      ) : (
                        <div className="flex h-24 w-32 items-center justify-center rounded border border-gray-300 bg-gray-100 p-2">
                          <span className="text-sm text-gray-400">空き</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </SortableContext>
          </GridArea>
        </div>

        <DragOverlay>
          {activeItem ? (
            <div className="flex h-24 w-32 scale-105 rotate-3 transform flex-col items-center justify-center rounded border border-gray-300 bg-white p-2 shadow-lg">
              <div className="text-center">
                <div className="text-lg font-bold">{activeItem.content}</div>
                <div className="text-xs text-gray-500">{activeItem.id}</div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

export default function SimpleDndKitTestPage() {
  // 配置戦略
  const [placementStrategy, setPlacementStrategy] = useState<
    "row-first" | "col-first"
  >("row-first")

  // 全アイテム配列（recursive-dnd-kanban-board準拠）
  const [items, setItems] = useState<SimpleItem[]>([
    { id: "item-1", columnId: "main", content: "Item 1" },
    { id: "item-2", columnId: "main", content: "Item 2" },
    { id: "item-3", columnId: "main", content: "Item 3" },
    { id: "item-4", columnId: "main", content: "Item 4" },
    { id: "item-5", columnId: "main", content: "Item 5" },
  ])

  // グリッド用アイテム配列（3x3で9個、グリッド表とゴミ箱で共有）
  const [gridItems, setGridItems] = useState<SimpleItem[]>([
    { id: "grid-1", columnId: "grid", content: "A" },
    { id: "grid-2", columnId: "grid", content: "B" },
    { id: "grid-3", columnId: "grid", content: "C" },
    { id: "grid-4", columnId: "grid", content: "D" },
    { id: "grid-5", columnId: "grid", content: "E" },
    { id: "grid-6", columnId: "grid", content: "F" },
    { id: "grid-7", columnId: "grid", content: "G" },
    { id: "grid-8", columnId: "grid", content: "H" },
    { id: "grid-9", columnId: "grid", content: "I" },
  ])

  // ドラッグ状態管理
  const [activeItem, setActiveItem] = useState<SimpleItem | null>(null)

  // convenience getters（recursive-dnd-kanban-board準拠）
  const getItemsInContainer = (containerId: string) => {
    return items.filter((item) => item.columnId === containerId)
  }

  const listItems = getItemsInContainer("main")
  const trashItems = getItemsInContainer("trash")

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

  // アイテムがどのコンテナにあるかを見つける関数（recursive-dnd-kanban-board準拠）
  const findContainer = (id: string) => {
    // コンテナ自体の場合
    if (id === "main-area") return "main"
    if (id === "trash-area" || id === "trash-popover-trigger") return "trash"
    if (id === "grid-area") return "grid"
    if (id === "grid-trash-area" || id === "grid-trash-popover-trigger")
      return "grid-trash"

    // kanbanアイテムの場合
    const item = items.find((item) => item.id === id)
    if (item) {
      return item.columnId
    }

    // グリッドアイテムの場合
    const gridItem = gridItems.find((item) => item.id === id)
    if (gridItem) {
      return gridItem.columnId
    }

    return null
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">
          🚀 Perfect DnD Kit Implementation
        </h1>
        <p className="mb-6 text-gray-600">
          Inspired by recursive-dnd-kanban-board with seamless cross-container
          drag & drop
        </p>
      </div>

      {/* Kanbanリスト */}
      <KanbanLists
        items={items}
        setItems={setItems}
        activeItem={activeItem}
        setActiveItem={setActiveItem}
        findContainer={findContainer}
        sensors={sensors}
      />

      {/* 配置戦略選択 */}
      <div className="mb-4">
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

      {/* グリッド表 */}
      <GridTable
        gridItems={gridItems}
        setGridItems={setGridItems}
        activeItem={activeItem}
        setActiveItem={setActiveItem}
        findContainer={findContainer}
        sensors={sensors}
        placementStrategy={placementStrategy}
      />

      {/* 現在の順序表示 */}
      <div className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">データ順序:</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-md mb-2 font-medium">
              メインリスト: {listItems.map((i) => i.content).join(" → ")}
            </h3>
            <h3 className="text-md mb-2 font-medium text-red-600">
              ゴミ箱リスト: {trashItems.map((i) => i.content).join(" → ")}
            </h3>
          </div>
          <div>
            <h3 className="text-md mb-2 font-medium">
              グリッド表:{" "}
              {gridItems
                .filter((i) => i.columnId === "grid")
                .map((i) => i.content)
                .join(" → ")}
            </h3>
            <h3 className="text-md mb-2 font-medium text-red-600">
              グリッド用ゴミ箱:{" "}
              {gridItems
                .filter((i) => i.columnId === "grid-trash")
                .map((i) => i.content)
                .join(" → ")}
            </h3>
          </div>
        </div>
      </div>
    </div>
  )
}
