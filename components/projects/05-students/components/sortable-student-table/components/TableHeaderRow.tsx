"use client"

import { GripVertical } from "lucide-react"

import type { Student } from "@/components/projects/05-students/components/sortable-student-table/types/studentTableTypes"
import { Checkbox } from "@/components/ui/checkbox"
import { TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface TableHeaderRowProps {
  sortedStudents: Student[]
  selectedStudents: Set<string>
  onSelectAll: (checked: boolean) => void
}

export function TableHeaderRow({
  sortedStudents,
  selectedStudents,
  onSelectAll,
}: TableHeaderRowProps) {
  return (
    <TableHeader className="bg-background sticky top-0 z-10">
      <TableRow>
        <TableHead className="w-25">
          <div className="flex items-center gap-2">
            <GripVertical className="text-muted-foreground h-4 w-4" />
            <Checkbox
              checked={
                sortedStudents.length > 0 &&
                sortedStudents.every((s) => selectedStudents.has(s.id))
              }
              onCheckedChange={onSelectAll}
            />
          </div>
        </TableHead>
        <TableHead className="w-20">出席番号</TableHead>
        <TableHead className="w-25">学籍番号</TableHead>
        <TableHead>氏名</TableHead>
        <TableHead>ふりがな</TableHead>
        <TableHead>学級</TableHead>
        <TableHead>受験状態</TableHead>
      </TableRow>
    </TableHeader>
  )
}
