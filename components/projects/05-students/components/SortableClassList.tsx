"use client"

import { useState } from "react"

import {
  DragHandle,
  SortableTableProvider,
  useSortableRow,
} from "@/components/common/sortable-table"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

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
  const { setNodeRef, style, isDragging, dragHandleProps } = useSortableRow(
    classItem.id
  )

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`w-full p-3 ${isDragging ? "rotate-2 shadow-lg" : ""}`}
    >
      <div className="flex items-center space-x-3">
        <DragHandle dragHandleProps={dragHandleProps} />
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

  const activeClass = activeId
    ? selectedClasses.find((classItem) => classItem.id === activeId)
    : null

  if (selectedClasses.length === 0) {
    return (
      <div className="text-muted-foreground py-4 text-center text-sm">
        学級を選択すると、ここで追加順序を設定できます
      </div>
    )
  }

  return (
    <SortableTableProvider
      items={selectedClasses.map((classItem) => classItem.id)}
      onDragStart={(event) => setActiveId(event.active.id as string)}
      onDragEnd={(event) => {
        const { active, over } = event
        setActiveId(null)

        if (!over || active.id === over.id) return

        const oldIndex = selectedClasses.findIndex(
          (classItem) => classItem.id === active.id
        )
        const newIndex = selectedClasses.findIndex(
          (classItem) => classItem.id === over.id
        )

        if (oldIndex === -1 || newIndex === -1) return

        const reorderedClasses = [...selectedClasses]
        const [removed] = reorderedClasses.splice(oldIndex, 1)
        reorderedClasses.splice(newIndex, 0, removed)
        onReorder(reorderedClasses)
      }}
      dragOverlay={
        activeClass ? (
          <Card className="bg-background scale-105 rotate-2 border-2 border-blue-200 p-3 shadow-xl">
            <div className="flex items-center space-x-3">
              <div className="h-4 w-4 text-blue-500" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{activeClass.name}</span>
                  <Badge variant="outline">{activeClass.studentCount}名</Badge>
                </div>
              </div>
            </div>
          </Card>
        ) : null
      }
    >
      <div className="space-y-2">
        <p className="text-sm font-medium">追加順序（ドラッグで並び替え）</p>
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
      </div>
    </SortableTableProvider>
  )
}
