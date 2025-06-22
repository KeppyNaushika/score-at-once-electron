"use client"

import React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { EditableTable } from "@/components/common/EditableTable"

interface ClassStudentImportRow {
  studentId: string
}

interface ClassStudentImportTableProps {
  data: ClassStudentImportRow[]
  onDataChange: (data: ClassStudentImportRow[]) => void
}

export default function ClassStudentImportTable({
  data,
  onDataChange,
}: ClassStudentImportTableProps) {
  const columns: ColumnDef<ClassStudentImportRow>[] = [
    {
      id: 'studentId',
      header: '学籍番号',
      accessorKey: 'studentId',
      size: 200,
      meta: {
        placeholder: '例: 001',
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
      minRows={10}
      className="min-h-[400px] min-w-[300px]"
    />
  )
}