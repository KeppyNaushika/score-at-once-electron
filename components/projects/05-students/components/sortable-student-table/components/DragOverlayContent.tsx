"use client"

import type { Student } from "@/components/projects/05-students/components/sortable-student-table/types/student-table-types"

interface DragOverlayContentProps {
  activeStudent: Student | null
  selectedStudents: Set<string>
}

export function DragOverlayContent({
  activeStudent,
  selectedStudents,
}: DragOverlayContentProps) {
  if (!activeStudent) return null

  return (
    <div className="bg-background rounded-md border p-2 shadow-lg">
      <div className="font-medium">
        {activeStudent.lastName} {activeStudent.firstName}
      </div>
      <div className="text-muted-foreground text-sm">
        {activeStudent.memberships[0]?.class.name}
        {selectedStudents.size > 1 && ` (+${selectedStudents.size - 1}名)`}
      </div>
    </div>
  )
}
