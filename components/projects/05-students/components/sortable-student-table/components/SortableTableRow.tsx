"use client"

import type { SortableTableRowProps } from "@/components/projects/05-students/components/sortable-student-table/types/studentTableTypes"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { TableCell, TableRow } from "@/components/ui/table"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, UserCheck, Users, UserX } from "lucide-react"

export function SortableTableRow({
  student,
  isSelected,
  onToggleSelection,
  onStatusUpdate,
  isDragging,
}: SortableTableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: student.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={`${isSortableDragging ? "bg-muted/50" : ""} ${isDragging ? "shadow-lg" : ""} cursor-pointer`}
      onClick={(event) => {
        if (!event.defaultPrevented) {
          onToggleSelection(student.id, event)
        }
      }}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          <div
            {...attributes}
            {...listeners}
            className="hover:bg-muted cursor-grab rounded p-1 hover:cursor-grabbing"
          >
            <GripVertical className="text-muted-foreground h-4 w-4" />
          </div>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => {
              onToggleSelection(student.id)
            }}
          />
        </div>
      </TableCell>
      <TableCell className="text-center font-medium">
        {student.projectClassInfo?.attendanceNumber ?? "-"}
      </TableCell>
      <TableCell className="font-mono">{student.studentId}</TableCell>
      <TableCell className="font-medium">
        {student.lastName} {student.firstName}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {student.lastNameKana} {student.firstNameKana}
      </TableCell>
      <TableCell>{student.projectClassInfo?.className ?? "-"}</TableCell>
      <TableCell>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant={student.status === "participating" ? "default" : "outline"}
            onClick={() => onStatusUpdate(student.id, "participating")}
            className="gap-1"
          >
            <UserCheck className="h-3 w-3" />
            受験
          </Button>
          <Button
            size="sm"
            variant={student.status === "expected" ? "secondary" : "outline"}
            onClick={() => onStatusUpdate(student.id, "expected")}
            className="gap-1"
          >
            <Users className="h-3 w-3" />
            見込
          </Button>
          <Button
            size="sm"
            variant={student.status === "absent" ? "destructive" : "outline"}
            onClick={() => onStatusUpdate(student.id, "absent")}
            className="gap-1"
          >
            <UserX className="h-3 w-3" />
            欠席
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
