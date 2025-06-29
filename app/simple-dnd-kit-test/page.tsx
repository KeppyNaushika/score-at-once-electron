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
  useDroppable,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// アイテム型（recursive-dnd-kanban-board準拠）
interface SimpleItem {
  id: string
  columnId: string  // 所属コンテナID
  content: string
}

// コンテナ型（定義のみ、データは持たない）
interface Container {
  id: string
  title: string
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
    transition: transition || 'transform 150ms ease', // 滑らかな移動アニメーション
    opacity: isDragging ? 0.5 : 1, // ドラッグ中は薄く表示（完全に消さない）
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

// ドロップ可能なメインリストエリア
function MainListArea({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'main-area',
    data: { type: 'main' },
  })

  return (
    <div
      ref={setNodeRef}
      className={`border-2 border-dashed rounded-lg p-4 transition-all duration-300 ease-in-out ${
        isOver
          ? 'border-blue-400 bg-blue-50 shadow-lg ring-2 ring-blue-200 ring-opacity-50 scale-[1.02]'
          : 'border-gray-300 bg-gray-50/50 hover:bg-gray-100/50'
      }`}
    >
      {children}
    </div>
  )
}

// ドロップ可能なグリッド表エリア
function GridArea({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'grid-area',
    data: { type: 'grid' },
  })

  return (
    <div
      ref={setNodeRef}
      className={`border-2 border-dashed border-green-300 bg-green-50/50 rounded-lg p-4 transition-all duration-300 ease-in-out ${
        isOver
          ? 'border-green-400 bg-green-100 shadow-lg ring-2 ring-green-200 ring-opacity-50 scale-[1.02]'
          : 'hover:bg-green-100/50'
      }`}
    >
      {children}
    </div>
  )
}

// ドロップ可能なゴミ箱エリア
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

// ドロップ可能なPopoverトリガーボタン
function DroppableTrashButton({
  children,
  trashCount,
  onClick,
  droppableId = 'trash-popover-trigger'
}: {
  children: React.ReactNode;
  trashCount: number;
  onClick?: () => void;
  droppableId?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { type: droppableId.includes('grid') ? 'grid-trash' : 'trash' },
  })

  const handleClick = (e: React.MouseEvent) => {
    // ドラッグ中でない場合のみクリックイベントを実行
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

// ドロップ可能なグリッド用ゴミ箱エリア
function GridTrashArea({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'grid-trash-area',
    data: { type: 'grid-trash' },
  })

  return (
    <div
      ref={setNodeRef}
      className={`border-2 border-dashed border-red-300 bg-red-50 rounded-lg p-4 min-h-24 transition-all duration-300 ease-in-out ${
        isOver
          ? 'border-red-400 bg-red-100 shadow-lg ring-2 ring-red-200 ring-opacity-50 scale-[1.02]'
          : 'hover:bg-red-100/50'
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
  sensors
}: {
  items: SimpleItem[]
  setItems: React.Dispatch<React.SetStateAction<SimpleItem[]>>
  activeItem: SimpleItem | null
  setActiveItem: React.Dispatch<React.SetStateAction<SimpleItem | null>>
  findContainer: (id: string) => string | null
  sensors: any
}) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const getItemsInContainer = (containerId: string) => {
    return items.filter(item => item.columnId === containerId)
  }

  const listItems = getItemsInContainer("main")
  const trashItems = getItemsInContainer("trash")

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string
    const foundItem = items.find(item => item.id === activeId) || null
    setActiveItem(foundItem)

    // メインリストからのドラッグの場合、Popoverを開く
    const activeContainer = findContainer(activeId)
    if (activeContainer === 'main') {
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
      setItems(prevItems => {
        return prevItems.map(item =>
          item.id === activeId
            ? { ...item, columnId: overContainer }
            : item
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
      setItems(prevItems => {
        const oldIndex = prevItems.findIndex(item => item.id === activeId)
        const newIndex = prevItems.findIndex(item => item.id === overId)
        return arrayMove(prevItems, oldIndex, newIndex)
      })
    }

    setActiveItem(null)
  }

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
        📋 Kanban風リスト
        <span className="text-sm font-normal text-gray-500">- 完璧なクロスコンテナドラッグ&ドロップ</span>
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
          <div className="flex justify-between items-center mb-3 h-20">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-blue-800">📝 メインリスト</h3>
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-sm">{listItems.length}件</span>
            </div>

            {/* ゴミ箱ボタン（Popover） */}
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <div>
                  <DroppableTrashButton
                    trashCount={trashItems.length}
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
                      items={trashItems.map(item => item.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {trashItems.map((item) => (
                          <SortableListItem key={item.id} id={item.id}>
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-red-600 line-through">{item.content}</span>
                              <span className="text-sm text-red-400">ID: {item.id}</span>
                            </div>
                          </SortableListItem>
                        ))}

                        {trashItems.length === 0 && (
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
          </div>

          {/* メインリストコンテンツ */}
          <MainListArea>
            <div className="min-h-96">
              <SortableContext
                items={listItems.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {listItems.map((item) => (
                    <SortableListItem key={item.id} id={item.id}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{item.content}</span>
                        <span className="text-sm text-gray-500">ID: {item.id}</span>
                      </div>
                    </SortableListItem>
                  ))}

                  {listItems.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
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
            <div className="bg-white border-2 border-blue-400 rounded-lg p-4 shadow-2xl transform rotate-3 scale-110 ring-4 ring-blue-200 ring-opacity-30 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-800">{activeItem.content}</span>
                <span className="text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded-full">ID: {activeItem.id}</span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

// ゴミ箱のアイテム（ドラッグ可能）
function TrashItem({ item }: { item: SimpleItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `trash-${item.id}`,
    data: { type: 'trash-item', originalItem: item }
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
      className="bg-white border-2 border-red-200 rounded p-2 h-16 w-24 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing opacity-70"
      {...attributes}
      {...listeners}
    >
      <div className="text-sm font-medium text-red-600 line-through">{item.content}</div>
      <div className="text-xs text-red-400">{item.id}</div>
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
  placementStrategy
}: {
  gridItems: SimpleItem[]
  setGridItems: React.Dispatch<React.SetStateAction<SimpleItem[]>>
  activeItem: SimpleItem | null
  setActiveItem: React.Dispatch<React.SetStateAction<SimpleItem | null>>
  findContainer: (id: string) => string | null
  sensors: any
  placementStrategy: "row-first" | "col-first"
}) {
  const [isGridPopoverOpen, setIsGridPopoverOpen] = useState(false)
  const getItemsInContainer = (containerId: string) => {
    return gridItems.filter(item => item.columnId === containerId)
  }

  const tableItems = getItemsInContainer("grid")
  const gridTrashItems = getItemsInContainer("grid-trash")

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string
    const foundItem = gridItems.find(item => item.id === activeId) || null
    setActiveItem(foundItem)

    // グリッド表からのドラッグの場合、Popoverを開く
    const activeContainer = findContainer(activeId)
    if (activeContainer === 'grid') {
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
      setGridItems(prevItems => {
        return prevItems.map(item =>
          item.id === activeId
            ? { ...item, columnId: overContainer }
            : item
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
      setGridItems(prevItems => {
        const oldIndex = prevItems.findIndex(item => item.id === activeId)
        const newIndex = prevItems.findIndex(item => item.id === overId)
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
      <h2 className="text-lg font-semibold mb-2">3x3 グリッド表:</h2>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col">
          {/* ヘッダー部分 */}
          <div className="flex justify-between items-center mb-3 h-20">
            <div className="flex items-center gap-2">
              <h3 className="text-md font-semibold text-green-800">グリッド表</h3>
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-sm">{tableItems.length}件</span>
            </div>

            {/* グリッド用ゴミ箱ボタン（Popover） */}
            <Popover open={isGridPopoverOpen} onOpenChange={setIsGridPopoverOpen}>
              <PopoverTrigger asChild>
                <div>
                  <DroppableTrashButton
                    trashCount={gridTrashItems.length}
                    onClick={() => setIsGridPopoverOpen(!isGridPopoverOpen)}
                    droppableId="grid-trash-popover-trigger"
                  >
                    <div>ゴミ箱を開く</div>
                  </DroppableTrashButton>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-4" side="bottom" align="end">
                <GridTrashArea>
                  <div className="min-h-48 max-h-64 overflow-y-auto">
                    <SortableContext
                      items={gridTrashItems.map(item => item.id)}
                      strategy={rectSortingStrategy}
                    >
                      {gridTrashItems.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {gridTrashItems.map((item) => (
                            <SortableGridCell key={item.id} id={item.id}>
                              <div className="text-center opacity-70">
                                <div className="text-lg font-bold text-red-600 line-through">{item.content}</div>
                                <div className="text-xs text-red-400">{item.id}</div>
                              </div>
                            </SortableGridCell>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-gray-500">
                          <Trash2 className="h-6 w-6 mx-auto mb-2 opacity-50" />
                          <div className="text-sm">グリッドアイテムをここにドラッグ</div>
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
              items={tableItems.map(item => item.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-3 gap-2 w-fit">
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
                            <div className="text-lg font-bold">{item.content}</div>
                            <div className="text-xs text-gray-500">{item.id}</div>
                          </div>
                        </SortableGridCell>
                      ) : (
                        <div className="bg-gray-100 border border-gray-300 rounded p-2 h-24 w-32 flex items-center justify-center">
                          <span className="text-gray-400 text-sm">空き</span>
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
  )
}

export default function SimpleDndKitTestPage() {
  // 配置戦略
  const [placementStrategy, setPlacementStrategy] = useState<"row-first" | "col-first">("row-first")

  // コンテナ定義（recursive-dnd-kanban-board準拠）
  const [containers] = useState<Container[]>([
    { id: "main", title: "メインリスト" },
    { id: "trash", title: "ゴミ箱リスト" }
  ])

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
    return items.filter(item => item.columnId === containerId)
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
    if (id === 'main-area') return 'main'
    if (id === 'trash-area' || id === 'trash-popover-trigger') return 'trash'
    if (id === 'grid-area') return 'grid'
    if (id === 'grid-trash-area' || id === 'grid-trash-popover-trigger') return 'grid-trash'

    // kanbanアイテムの場合
    const item = items.find(item => item.id === id)
    if (item) {
      return item.columnId
    }

    // グリッドアイテムの場合
    const gridItem = gridItems.find(item => item.id === id)
    if (gridItem) {
      return gridItem.columnId
    }

    return null
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🚀 Perfect DnD Kit Implementation</h1>
        <p className="text-gray-600 mb-6">Inspired by recursive-dnd-kanban-board with seamless cross-container drag & drop</p>
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
        <h2 className="text-lg font-semibold mb-2">データ順序:</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-md font-medium mb-2">メインリスト: {listItems.map(i => i.content).join(' → ')}</h3>
            <h3 className="text-md font-medium mb-2 text-red-600">ゴミ箱リスト: {trashItems.map(i => i.content).join(' → ')}</h3>
          </div>
          <div>
            <h3 className="text-md font-medium mb-2">グリッド表: {gridItems.filter(i => i.columnId === 'grid').map(i => i.content).join(' → ')}</h3>
            <h3 className="text-md font-medium mb-2 text-red-600">グリッド用ゴミ箱: {gridItems.filter(i => i.columnId === 'grid-trash').map(i => i.content).join(' → ')}</h3>
          </div>
        </div>
      </div>
    </div>
  )
}
