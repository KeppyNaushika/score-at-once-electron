"use client"
"use no memo"

import type { CellContext, ColumnDef, Row } from "@tanstack/react-table"
import { flexRender, getCoreRowModel } from "@tanstack/react-table"
import type { TableOptions, TableOptionsResolved } from "@tanstack/table-core"
import { createTable } from "@tanstack/table-core"
import { Plus, Trash2 } from "lucide-react"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"

interface EditableTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  onDataChange: (data: T[]) => void
  allowInsertRow?: boolean
  allowDeleteRow?: boolean
  className?: string
  getRowProps?: (row: Row<T>) => { className?: string }
}

/** Table meta with updateData function for editable cells */
interface TableMeta {
  updateData: (rowIndex: number, columnId: string, value: string) => void
}

type EditableCellProps<T> = CellContext<T, unknown>

function EditableCell<T>({
  getValue,
  row,
  column,
  table,
}: EditableCellProps<T>) {
  const initialValue = getValue()
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  const onBlur = () => {
    const meta = table.options.meta as TableMeta | undefined
    meta?.updateData(row.index, column.id, String(value ?? ""))
  }

  const moveFocus = (target: HTMLInputElement) => {
    target.focus()
    target.select()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    // IME変換確定のEnter/Tabではセル移動しない
    if (e.nativeEvent.isComposing) return

    const currentCell = inputRef.current
    if (!currentCell) return

    if (e.key === "Enter") {
      // 同じ列の上下行へ移動（Shift+Enterで上）
      e.preventDefault()
      const table = currentCell.closest("table")
      if (!table) return
      const rows = Array.from(table.querySelectorAll("tbody tr"))
      const currentRow = currentCell.closest("tr")
      const rowIndex = currentRow ? rows.indexOf(currentRow) : -1
      if (rowIndex < 0 || !currentRow) return
      const colIndex = Array.from(currentRow.querySelectorAll("input")).indexOf(
        currentCell
      )
      if (colIndex < 0) return

      const targetRowIndex = e.shiftKey ? rowIndex - 1 : rowIndex + 1
      if (targetRowIndex < 0 || targetRowIndex >= rows.length) return
      const targetInputs = Array.from(
        rows[targetRowIndex].querySelectorAll("input")
      )
      const target =
        targetInputs[colIndex] ?? targetInputs[targetInputs.length - 1]
      if (target) moveFocus(target)
      return
    }

    if (e.key === "Tab") {
      // 左右へ移動。行末は次行の先頭、行頭は前行の末尾へ（Shift+Tabで逆）
      e.preventDefault()
      const table = currentCell.closest("table")
      if (!table) return
      const cells = Array.from(
        table.querySelectorAll("tbody input")
      ) as HTMLInputElement[]
      const currentIndex = cells.indexOf(currentCell)
      if (currentIndex < 0) return
      const nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1
      if (nextIndex >= 0 && nextIndex < cells.length) {
        moveFocus(cells[nextIndex])
      }
    }
  }

  const meta = column.columnDef.meta as
    | { placeholder?: string; validate?: (value: string) => boolean }
    | undefined

  // 非空かつ検証NGのセルは赤背景で警告（保存されない入力を可視化）
  const strValue = String(value ?? "")
  const isInvalid =
    strValue.trim() !== "" && meta?.validate ? !meta.validate(strValue) : false

  return (
    <input
      ref={inputRef}
      value={strValue}
      onChange={(e) => setValue(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className={`absolute inset-0 h-full w-full border-none px-4 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none ${
        isInvalid
          ? "bg-red-100 text-red-700 focus:bg-red-50"
          : "bg-transparent focus:bg-white"
      }`}
      placeholder={meta?.placeholder || ""}
      title={
        isInvalid ? "無効な値です（このままでは保存されません）" : undefined
      }
    />
  )
}

function useLocalReactTable<TData>(options: TableOptions<TData>) {
  const [table] = useState(() =>
    createTable<TData>({
      state: {},
      onStateChange: () => {},
      renderFallbackValue: null,
      ...options,
    } as TableOptionsResolved<TData>)
  )

  const [internalState, setInternalState] = useState(() => table.initialState)

  table.setOptions((prev) => ({
    ...prev,
    ...options,
    state: {
      ...internalState,
      ...options.state,
    },
    onStateChange: (updater) => {
      setInternalState(updater)
      options.onStateChange?.(updater)
    },
  }))

  return table
}

export function EditableTable<T extends object>({
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

  const deleteRow = useCallback(
    (rowIndex: number) => {
      const newData = tableData.filter((_, index) => index !== rowIndex)
      setTableData(newData)
      setTimeout(() => onDataChange(newData), 0)
    },
    [tableData, setTableData, onDataChange]
  )

  const addRowAfter = useCallback(
    (index: number) => {
      const newRow = columns.reduce<Record<string, string>>((acc, col) => {
        if (col.id) acc[col.id] = ""
        return acc
      }, {}) as T

      const newData = [
        ...tableData.slice(0, index + 1),
        newRow,
        ...tableData.slice(index + 1),
      ]
      setTableData(newData)
      setTimeout(() => onDataChange(newData), 0)
    },
    [columns, tableData, setTableData, onDataChange]
  )

  const hasReadOnlyColumns = useMemo(
    () =>
      columns.some(
        (col) => (col.meta as { readOnly?: boolean } | undefined)?.readOnly
      ),
    [columns]
  )

  const editableColumns = useMemo(
    () => [
      ...columns.map((col) => {
        const meta = col.meta as { readOnly?: boolean } | undefined
        if (meta?.readOnly) return col // readOnlyカラムは元のセルレンダラーを維持
        return { ...col, cell: EditableCell }
      }),
      // 行追加ボタン列
      ...(allowInsertRow
        ? [
            {
              id: "addRow",
              header: "",
              cell: ({ row }: { row: Row<T> }) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addRowAfter(row.index)}
                  className="h-6 w-6 p-0 text-green-600 hover:bg-green-50 hover:text-green-800"
                  title="この行の下に新しい行を追加"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              ),
              size: 40,
            },
          ]
        : []),
      ...(allowDeleteRow
        ? [
            {
              id: "actions",
              header: "",
              cell: ({ row }: { row: Row<T> }) => (
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
    [columns, allowInsertRow, allowDeleteRow, deleteRow, addRowAfter]
  )

  const table = useLocalReactTable({
    data: tableData,
    columns: editableColumns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      updateData: (rowIndex: number, columnId: string, value: string) => {
        // readOnlyカラムへの変更を無視
        const col = columns.find((c) => c.id === columnId)
        if ((col?.meta as { readOnly?: boolean } | undefined)?.readOnly) return

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
    const newRow = columns.reduce<Record<string, string>>((acc, col) => {
      if (col.id) acc[col.id] = ""
      return acc
    }, {}) as T

    const newData = [...tableData, newRow]
    setTableData(newData)
    setTimeout(() => onDataChange(newData), 0)
  }

  const addMultipleRows = (count: number) => {
    const newRows = Array.from(
      { length: count },
      () =>
        columns.reduce<Record<string, string>>((acc, col) => {
          if (col.id) acc[col.id] = ""
          return acc
        }, {}) as T
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

    if (hasReadOnlyColumns) {
      // マージ型ペースト: readOnlyカラムをスキップし、editableカラムのみにデータをマッピング
      const editableCols = columns.filter(
        (col) => !(col.meta as { readOnly?: boolean } | undefined)?.readOnly
      )

      // フォーカスセルの位置を起点にする
      const activeElement = document.activeElement as HTMLInputElement | null
      let startRowIndex = 0
      let startEditableColIndex = 0

      if (activeElement?.closest("td")) {
        const td = activeElement.closest("td")!
        const tr = td.closest("tr")!
        const tbody = tr.closest("tbody")!
        const allRows = Array.from(tbody.querySelectorAll("tr"))
        startRowIndex = allRows.indexOf(tr)

        // フォーカスセルのカラムIDを特定
        const allTds = Array.from(tr.querySelectorAll("td"))
        const tdIndex = allTds.indexOf(td)
        const visibleColumns = table.getVisibleLeafColumns()
        if (tdIndex >= 0 && tdIndex < visibleColumns.length) {
          const focusedColId = visibleColumns[tdIndex].id
          const editableIndex = editableCols.findIndex(
            (c) => c.id === focusedColId
          )
          if (editableIndex >= 0) startEditableColIndex = editableIndex
        }
      }

      const newData = [...tableData]
      for (let ri = 0; ri < rows.length; ri++) {
        const targetRow = startRowIndex + ri
        if (targetRow >= newData.length) break

        const cells = rows[ri].split("\t")
        const updatedRow = { ...newData[targetRow] }
        for (let ci = 0; ci < cells.length; ci++) {
          const targetCol = startEditableColIndex + ci
          if (targetCol >= editableCols.length) break
          const colId = editableCols[targetCol].id
          if (colId) {
            ;(updatedRow as Record<string, unknown>)[colId] = cells[ci]
          }
        }
        newData[targetRow] = updatedRow
      }

      setTableData(newData)
      onDataChange(newData)
    } else {
      // 全置換型ペースト（後方互換）
      const pastedData = rows.map((row) => {
        const cells = row.split("\t")
        return columns.reduce<Record<string, string>>((acc, col, index) => {
          if (col.id) acc[col.id] = cells[index] || ""
          return acc
        }, {}) as T
      })

      setTableData(pastedData)
      onDataChange(pastedData)
    }
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
                          header.getContext()
                        )}
                  </th>
                ))
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
                          cell.getContext()
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
              className="px-2 text-xs"
            >
              +5行
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addMultipleRows(10)}
              className="px-2 text-xs"
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
