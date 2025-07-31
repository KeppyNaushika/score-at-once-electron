"use client"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
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
import { GripVertical } from "lucide-react"
import { useCallback, useState } from "react"

interface AvailableClass {
  id: string
  name: string
  studentCount: number
  isSelected: boolean
  order?: number
}

interface SortableClassListProps {
  selectedClasses: AvailableClass[]
  onReorder: (reorderedClasses: AvailableClass[]) => void
}

function SortableClassItem({ classItem }: { classItem: AvailableClass }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: classItem.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`w-full p-3 ${isDragging ? "rotate-2 shadow-lg" : ""}`}
    >
      <div className="flex items-center space-x-3">
        <div
          {...attributes}
          {...listeners}
          className="hover:bg-muted cursor-grab rounded p-1 transition-colors active:cursor-grabbing"
        >
          <GripVertical className="text-muted-foreground h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="font-medium">{classItem.name}</span>
            <Badge variant="outline">{classItem.studentCount}名</Badge>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function SortableClassList({
  selectedClasses,
  onReorder,
}: SortableClassListProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor),
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over || active.id === over.id) {
        return
      }

      const oldIndex = selectedClasses.findIndex((cls) => cls.id === active.id)
      const newIndex = selectedClasses.findIndex((cls) => cls.id === over.id)

      if (oldIndex === -1 || newIndex === -1) {
        return
      }

      const reorderedClasses = arrayMove(selectedClasses, oldIndex, newIndex)
      onReorder(reorderedClasses)
    },
    [selectedClasses, onReorder],
  )

  const activeClass = activeId
    ? selectedClasses.find((cls) => cls.id === activeId)
    : null

  if (selectedClasses.length === 0) {
    return (
      <div className="text-muted-foreground py-4 text-center text-sm">
        学級を選択すると、ここで追加順序を設定できます
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-2">
        <p className="text-sm font-medium">追加順序（ドラッグで並び替え）</p>
        <SortableContext
          items={selectedClasses.map((cls) => cls.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {selectedClasses.map((classItem, index) => (
              <div key={classItem.id} className="flex items-center gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <SortableClassItem classItem={classItem} />
                </div>
              </div>
            ))}
          </div>
        </SortableContext>
      </div>

      <DragOverlay>
        {activeClass ? (
          <Card className="bg-background scale-105 rotate-2 border-2 border-blue-200 p-3 shadow-xl">
            <div className="flex items-center space-x-3">
              <GripVertical className="h-4 w-4 text-blue-500" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{activeClass.name}</span>
                  <Badge variant="outline">{activeClass.studentCount}名</Badge>
                </div>
              </div>
            </div>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
