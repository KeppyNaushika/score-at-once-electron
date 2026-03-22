"use client"

import { SortableStudentTableContainer } from "@/components/exams/05-students/components/sortable-student-table/components/SortableStudentTableContainer"
import type { SortableStudentTableProps } from "@/components/exams/05-students/components/sortable-student-table/types/studentTableTypes"

export default function SortableStudentTable(props: SortableStudentTableProps) {
  return <SortableStudentTableContainer {...props} />
}
