"use client"

import { useState } from "react"

import {
  DragHandle,
  SortableTableProvider,
  useSortableRow,
} from "@/components/common/sortable-table"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

interface SortableClassroomItemData {
  id: string
  name: string
  studentCount: number
}

interface SortableClassroomListProps {
  selectedClassrooms: SortableClassroomItemData[]
  onReorder: (orderedIds: string[]) => void
}

function SortableClassroomItem({
  classroomItem,
}: {
  classroomItem: SortableClassroomItemData
}) {
  const { setNodeRef, style, isDragging, dragHandleProps } = useSortableRow(
    classroomItem.id
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
            <span className="font-medium">{classroomItem.name}</span>
            <Badge variant="outline">{classroomItem.studentCount}名</Badge>
          </div>
        </div>
      </div>
    </Card>
  )
}

/**
 * 選択済み学級の追加順をドラッグで並び替えるリスト
 */
export function SortableClassroomList({
  selectedClassrooms,
  onReorder,
}: SortableClassroomListProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const activeClassroom = activeId
    ? selectedClassrooms.find((classroomItem) => classroomItem.id === activeId)
    : null

  if (selectedClassrooms.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        学級を選択すると、ここで追加順序を設定できます
      </div>
    )
  }

  return (
    <SortableTableProvider
      items={selectedClassrooms.map((classroomItem) => classroomItem.id)}
      onDragStart={(event) => setActiveId(event.active.id as string)}
      onDragEnd={(event) => {
        const { active, over } = event
        setActiveId(null)

        if (!over || active.id === over.id) return

        const oldIndex = selectedClassrooms.findIndex(
          (classroomItem) => classroomItem.id === active.id
        )
        const newIndex = selectedClassrooms.findIndex(
          (classroomItem) => classroomItem.id === over.id
        )

        if (oldIndex === -1 || newIndex === -1) return

        const reordered = [...selectedClassrooms]
        const [removed] = reordered.splice(oldIndex, 1)
        reordered.splice(newIndex, 0, removed)
        onReorder(reordered.map((classroomItem) => classroomItem.id))
      }}
      dragOverlay={
        activeClassroom ? (
          <Card className="scale-105 rotate-2 border-2 border-blue-200 bg-background p-3 shadow-xl">
            <div className="flex items-center space-x-3">
              <div className="h-4 w-4 text-blue-500" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{activeClassroom.name}</span>
                  <Badge variant="outline">
                    {activeClassroom.studentCount}名
                  </Badge>
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
          {selectedClassrooms.map((classroomItem, index) => (
            <div key={classroomItem.id} className="flex items-center gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <SortableClassroomItem classroomItem={classroomItem} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SortableTableProvider>
  )
}
