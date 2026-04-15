"use client"

import { UserCheck, Users, UserX } from "lucide-react"

import { DragHandle, useSortableRow } from "@/components/common/sortable-table"
import type { SortableTableRowProps } from "@/components/exams/05-students/components/sortable-student-table/types/studentTableTypes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { TableCell, TableRow } from "@/components/ui/table"

/**
 * ドラッグ可能な生徒テーブル行
 *
 * 共通のuseSortableRowとDragHandleを使用し、チェックボックス選択・受験状態ボタンを表示する。
 */
export function SortableTableRow({
  student,
  isSelected,
  onToggleSelection,
  onStatusUpdate,
}: SortableTableRowProps) {
  const { setNodeRef, style, isDragging, dragHandleProps } = useSortableRow(
    student.id
  )

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? "bg-muted/50 shadow-lg" : ""} cursor-pointer`}
      onClick={(event) => {
        if (!event.defaultPrevented) {
          onToggleSelection(student.id, event)
        }
      }}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          <DragHandle dragHandleProps={dragHandleProps} />
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => {
              onToggleSelection(student.id)
            }}
          />
        </div>
      </TableCell>
      <TableCell className="text-center font-medium">
        {student.examClassInfo?.attendanceNumber ?? "-"}
      </TableCell>
      <TableCell className="font-mono">{student.studentNumber}</TableCell>
      <TableCell className="font-medium">
        {student.lastName} {student.firstName}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {student.lastNameKana} {student.firstNameKana}
      </TableCell>
      <TableCell>{student.examClassInfo?.className ?? "-"}</TableCell>
      <TableCell className="text-center">
        {student.answerSheetCount > 0 ? (
          <Badge variant="secondary" className="tabular-nums">
            {student.answerSheetCount}枚
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
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
