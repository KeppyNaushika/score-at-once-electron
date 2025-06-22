"use client"

import React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { EditableTable } from "@/components/common/EditableTable"

interface ClassAssignmentRow {
  studentId: string
  classCode: string
}

interface ClassAssignmentTableProps {
  data: ClassAssignmentRow[]
  onDataChange: (data: ClassAssignmentRow[]) => void
  existingClasses: Array<{
    name: string
    classCode?: string | null
  }>
}

export default function ClassAssignmentTable({
  data,
  onDataChange,
  existingClasses,
}: ClassAssignmentTableProps) {
  const availableClassCodes = existingClasses
    .filter(cls => cls.classCode)
    .map(cls => cls.classCode)
    .join(', ')

  const columns: ColumnDef<ClassAssignmentRow>[] = [
    {
      id: 'studentId',
      header: '学籍番号',
      accessorKey: 'studentId',
      size: 100,
      meta: {
        placeholder: '例: 001',
      },
    },
    {
      id: 'classCode',
      header: 'クラスコード',
      accessorKey: 'classCode',
      size: 120,
      meta: {
        placeholder: '例: 1A',
      },
    },
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-blue-50 p-4">
        <h4 className="font-medium text-blue-900">利用可能なクラスコード</h4>
        <p className="text-sm text-blue-700 mt-1">
          {availableClassCodes || 'クラスが登録されていません'}
        </p>
      </div>
      
      <EditableTable
        data={data}
        columns={columns}
        onDataChange={onDataChange}
        allowInsertRow={true}
        allowDeleteRow={true}
        minRows={10}
        className="min-h-[400px]"
      />
    </div>
  )
}