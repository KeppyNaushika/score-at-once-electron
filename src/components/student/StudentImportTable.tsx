"use client"

import { ColumnDef } from "@tanstack/react-table"

import { EditableTable } from "@/components/common/EditableTable"

interface StudentImportRow {
  studentNumber: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear: string
  isDuplicate?: boolean
}

interface StudentImportTableProps {
  data: StudentImportRow[]
  onDataChange: (data: StudentImportRow[]) => void
}

export default function StudentImportTable({
  data,
  onDataChange,
}: StudentImportTableProps) {
  const columns: ColumnDef<StudentImportRow>[] = [
    {
      id: "studentNumber",
      header: "学籍番号",
      accessorKey: "studentNumber",
      size: 100,
      meta: {
        placeholder: "例: 001",
      },
    },
    {
      id: "lastName",
      header: "姓",
      accessorKey: "lastName",
      size: 100,
      meta: {
        placeholder: "例: 田中",
      },
    },
    {
      id: "firstName",
      header: "名",
      accessorKey: "firstName",
      size: 100,
      meta: {
        placeholder: "例: 太郎",
      },
    },
    {
      id: "lastNameKana",
      header: "姓カナ",
      accessorKey: "lastNameKana",
      size: 120,
      meta: {
        placeholder: "例: タナカ",
      },
    },
    {
      id: "firstNameKana",
      header: "名カナ",
      accessorKey: "firstNameKana",
      size: 120,
      meta: {
        placeholder: "例: タロウ",
      },
    },
    {
      id: "enrollmentYear",
      header: "入学年度",
      accessorKey: "enrollmentYear",
      size: 80,
      meta: {
        placeholder: "例: 2024",
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
      className="min-h-100 min-w-200"
      getRowProps={(row) => ({
        className: row.original.isDuplicate ? "bg-red-50" : "",
      })}
    />
  )
}
