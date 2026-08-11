"use client"

import {
  type EditableColumnDef,
  EditableTable,
} from "@/components/common/EditableTable"

interface ClassroomStudentImportRow {
  studentId: string
  attendanceNumber: string
  startDate: string
  endDate: string
}

interface ClassroomStudentImportTableProps {
  data: ClassroomStudentImportRow[]
  onDataChange: (data: ClassroomStudentImportRow[]) => void
}

export default function ClassroomStudentImportTable({
  data,
  onDataChange,
}: ClassroomStudentImportTableProps) {
  const columns: EditableColumnDef<ClassroomStudentImportRow>[] = [
    {
      id: "studentId",
      header: "学籍番号",
      accessorKey: "studentId",
      size: 200,
      meta: {
        placeholder: "例: 2024001",
      },
    },
    {
      id: "attendanceNumber",
      header: "出席番号",
      accessorKey: "attendanceNumber",
      size: 150,
      meta: {
        placeholder: "例: 1",
      },
    },
    {
      id: "startDate",
      header: "開始日",
      accessorKey: "startDate",
      size: 150,
      meta: {
        placeholder: "例: 2024/4/1",
      },
    },
    {
      id: "endDate",
      header: "終了日",
      accessorKey: "endDate",
      size: 150,
      meta: {
        placeholder: "例: 2025/3/31",
      },
    },
  ]

  return (
    <EditableTable
      data={data}
      columns={columns}
      onDataChange={onDataChange}
      allowInsertRow={true}
      allowDeleteRow={true}
      className="min-w-162.5"
    />
  )
}
