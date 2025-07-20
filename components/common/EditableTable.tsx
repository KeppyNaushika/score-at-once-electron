"use client"

import { Button } from "@/components/ui/button"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Plus, Trash2 } from "lucide-react"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

interface EditableTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  onDataChange: (data: T[]) => void
  allowInsertRow?: boolean
  allowDeleteRow?: boolean
  className?: string
  getRowProps?: (row: any) => { className?: string }
}

interface EditableCellProps {
  getValue: () => any
  row: any
  column: any
  table: any
}

function EditableCell({ getValue, row, column, table }: EditableCellProps) {
  const initialValue = getValue()
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  const onBlur = () => {
    table.options.meta?.updateData(row.index, column.id, value)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      inputRef.current?.blur()
    }
    if (e.key === "Tab") {
      e.preventDefault()
      const currentCell = inputRef.current
      if (currentCell) {
        const table = currentCell.closest("table")
        if (table) {
          const cells = Array.from(table.querySelectorAll("input"))
          const currentIndex = cells.indexOf(currentCell)
          const nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1
          if (nextIndex >= 0 && nextIndex < cells.length) {
            ;(cells[nextIndex] as HTMLInputElement).focus()
          }
        }
      }
    }
  }

  return (
    <input
      ref={inputRef}
      value={value || ""}
      onChange={(e) => setValue(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className="absolute inset-0 h-full w-full border-none bg-transparent px-4 py-2 text-sm focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
      placeholder={column.columnDef.meta?.placeholder || ""}
    />
  )
}

export function EditableTable<T extends Record<string, any>>({
  data,
  columns,
  onDataChange,
  allowInsertRow = true,
  allowDeleteRow = true,
  className = "",
  getRowProps,
}: EditableTableProps<T>) {
  const [tableData, setTableData] = useState(data)

  useEffect(() => {
    setTableData(data)
  }, [data])

  const deleteRow = useCallback((rowIndex: number) => {
    const newData = tableData.filter((_, index) => index !== rowIndex)
    setTableData(newData)
    setTimeout(() => onDataChange(newData), 0)
  }, [tableData, setTableData, onDataChange])

  const addRowAfter = useCallback((index: number) => {
    const newRow = columns.reduce((acc, col) => {
      ;(acc as any)[col.id as string] = ""
      return acc
    }, {} as T)

    const newData = [
      ...tableData.slice(0, index + 1),
      newRow,
      ...tableData.slice(index + 1)
    ]
    setTableData(newData)
    setTimeout(() => onDataChange(newData), 0)
  }, [columns, tableData, setTableData, onDataChange])

  const editableColumns = useMemo(
    () => [
      ...columns.map((col) => ({
        ...col,
        cell: EditableCell,
      })),
      // 行追加ボタン列
      {
        id: "addRow",
        header: "",
        cell: ({ row }: { row: any }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => addRowAfter(row.index)}
            className="h-6 w-6 p-0 text-green-600 hover:text-green-800 hover:bg-green-50"
            title="この行の下に新しい行を追加"
          >
            <Plus className="h-3 w-3" />
          </Button>
        ),
        size: 40,
      },
      ...(allowDeleteRow
        ? [
            {
              id: "actions",
              header: "",
              cell: ({ row }: { row: any }) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteRow(row.index)}
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              ),
              size: 40,
            },
          ]
        : []),
    ],
    [columns, allowDeleteRow, deleteRow, addRowAfter],
  )

  const table = useReactTable({
    data: tableData,
    columns: editableColumns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      updateData: (rowIndex: number, columnId: string, value: any) => {
        setTableData((old) => {
          const newData = old.map((row, index) => {
            if (index === rowIndex) {
              return {
                ...row,
                [columnId]: value,
              }
            }
            return row
          })
          // Defer the onDataChange call to avoid state update during render
          setTimeout(() => onDataChange(newData), 0)
          return newData
        })
      },
    },
  })

  const addRow = () => {
    const newRow = columns.reduce((acc, col) => {
      ;(acc as any)[col.id as string] = ""
      return acc
    }, {} as T)

    const newData = [...tableData, newRow]
    setTableData(newData)
    setTimeout(() => onDataChange(newData), 0)
  }

  const addMultipleRows = (count: number) => {
    const newRows = Array.from({ length: count }, () =>
      columns.reduce((acc, col) => {
        ;(acc as any)[col.id as string] = ""
        return acc
      }, {} as T)
    )

    const newData = [...tableData, ...newRows]
    setTableData(newData)
    setTimeout(() => onDataChange(newData), 0)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()

    const paste = e.clipboardData.getData("text")
    const rows = paste.split("\n").filter((row) => row.trim() !== "")

    if (rows.length === 0) return

    const pastedData = rows.map((row) => {
      const cells = row.split("\t")
      return columns.reduce((acc, col, index) => {
        ;(acc as any)[col.id as string] = cells[index] || ""
        return acc
      }, {} as T)
    })

    setTableData(pastedData)
    onDataChange(pastedData)
  }


  return (
    <div className={`space-y-4 ${className}`}>
      <div className="rounded-md border">
        <table className="w-full" onPaste={handlePaste}>
          <thead>
            <tr className="bg-muted/50 border-b">
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="text-muted-foreground px-4 py-3 text-left text-sm font-medium"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const rowProps = getRowProps?.(row) || {}
              const rowClassName = `border-b hover:bg-muted/50 ${rowProps.className || ""}`
              return (
                <tr key={row.id} className={rowClassName}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="relative h-9 px-0 py-0">
                      <div className="flex h-full items-center px-4 py-2">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {allowInsertRow && (
        <div className="flex justify-start gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={addRow}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            行を追加
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => addMultipleRows(5)}
              className="text-xs px-2"
            >
              +5行
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addMultipleRows(10)}
              className="text-xs px-2"
            >
              +10行
            </Button>
          </div>
        </div>
      )}

      <div className="text-muted-foreground text-sm">
        💡 ヒント: Excelからデータをコピーして、テーブル上で貼り付け (Ctrl+V)
        できます
      </div>
    </div>
  )
}
