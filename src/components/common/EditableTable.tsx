"use client"
"use no memo"

import type {
  CellContext,
  ColumnDef,
  Row,
  RowData,
} from "@tanstack/react-table"
import {
  columnSizingFeature,
  columnVisibilityFeature,
  flexRender,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { Plus, Trash2 } from "lucide-react"
import React, { useCallback, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

/** 編集セルの確定値をテーブルの外へ渡すために `meta` へ載せる項目 */
interface EditableTableMeta {
  updateData: (rowIndex: number, columnId: string, value: string) => void
}

/** 列ごとの振る舞いを `meta` へ載せる項目 */
interface EditableColumnMeta {
  /** 編集不可の列。セルは元のレンダラーのまま、貼り付けの対象からも外れる */
  readOnly?: boolean
  /** 編集セルの入力欄に出すプレースホルダ */
  placeholder?: string
  /** 非空の入力の検証。false なら赤背景で「保存されない」ことを示す */
  validate?: (value: string) => boolean
}

/**
 * このテーブルが使う機能と、`meta` の型。
 *
 * `tableMeta` / `columnMeta` は型専用スロットで、値は実行時に捨てられるので
 * `{} as` で型だけ渡す。この宣言はこのテーブルにしか効かないため、
 * `updateData` を必須にできる（EditableTable が必ず渡す）。テーブルごとに
 * 分かれていない宣言マージでは、`meta` を持つ無関係なテーブルまで
 * この契約を満たす義務を負ってしまうので必須にできなかった。
 *
 * 機能は使う API の分だけ入れる（v9 は既定で何も入らない）。
 * `columnSizingFeature` が `columnDef.size` と `header.getSize()` を、
 * `columnVisibilityFeature` が `row.getVisibleCells()` と
 * `table.getVisibleLeafColumns()` を生やす。
 */
const editableTableFeatures = tableFeatures({
  columnSizingFeature,
  columnVisibilityFeature,
  tableMeta: {} as EditableTableMeta,
  columnMeta: {} as EditableColumnMeta,
})

type EditableTableFeatures = typeof editableTableFeatures

/** EditableTable に渡す列定義。`meta` はこのテーブル専用の型が付く */
export type EditableColumnDef<TData extends RowData> = ColumnDef<
  EditableTableFeatures,
  TData
>

interface EditableTableProps<T extends RowData> {
  data: T[]
  columns: EditableColumnDef<T>[]
  onDataChange: (data: T[]) => void
  allowInsertRow?: boolean
  allowDeleteRow?: boolean
  className?: string
  getRowProps?: (row: Row<EditableTableFeatures, T>) => { className?: string }
}

type EditableCellProps<T extends RowData> = CellContext<
  EditableTableFeatures,
  T,
  unknown
>

function EditableCell<T extends RowData>({
  getValue,
  row,
  column,
  table,
}: EditableCellProps<T>) {
  const committedValue = String(getValue() ?? "")
  // 編集中の下書きは「どの確定値に対して打ったものか」を一緒に持つ。確定値が
  // 入れ替われば一致しなくなって自然に外れるので、blur で消さなくてよい。
  // 消してしまうと、親が受け付けなかった値（満点超過・未定義の評価記号など）が
  // 無言で消え、赤い警告を出す機会が無くなる。
  const [draft, setDraft] = useState<{
    committedValue: string
    text: string
  } | null>(null)
  const strValue =
    draft?.committedValue === committedValue ? draft.text : committedValue
  const inputRef = useRef<HTMLInputElement>(null)

  const meta = column.columnDef.meta

  // 非空かつ検証NGのセルは赤背景で警告（保存されない入力を可視化）
  const isInvalid =
    strValue.trim() !== "" && meta?.validate ? !meta.validate(strValue) : false

  const onBlur = () => {
    table.options.meta?.updateData(row.index, column.id, strValue)
    // 下書きは残す。親が受け付ければ確定値が変わって外れ、弾かれれば残って赤いまま。
    // 赤背景だけでは何が悪いか伝わらず、title はホバーしないと出ないので通知する
    if (isInvalid) {
      toast.warning(`「${strValue}」は保存されません`, {
        description: meta?.placeholder
          ? `入力できる値: ${meta.placeholder}`
          : undefined,
      })
    }
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

  return (
    <input
      ref={inputRef}
      value={strValue}
      onChange={(e) => setDraft({ committedValue, text: e.target.value })}
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

export function EditableTable<T extends RowData>({
  data,
  columns,
  onDataChange,
  allowInsertRow = true,
  allowDeleteRow = true,
  className = "",
  getRowProps,
}: EditableTableProps<T>) {
  const deleteRow = useCallback(
    (rowIndex: number) => {
      onDataChange(data.filter((_, index) => index !== rowIndex))
    },
    [data, onDataChange]
  )

  const addRowAfter = useCallback(
    (index: number) => {
      const newRow = columns.reduce<Record<string, string>>((acc, column) => {
        if (column.id) acc[column.id] = ""
        return acc
      }, {}) as T

      onDataChange([
        ...data.slice(0, index + 1),
        newRow,
        ...data.slice(index + 1),
      ])
    },
    [columns, data, onDataChange]
  )

  const hasReadOnlyColumns = useMemo(
    () => columns.some((column) => column.meta?.readOnly),
    [columns]
  )

  const editableColumns = useMemo(
    (): EditableColumnDef<T>[] => [
      ...columns.map((column) => {
        if (column.meta?.readOnly) return column // readOnlyカラムは元のセルレンダラーを維持
        return { ...column, cell: EditableCell }
      }),
      // 行追加ボタン列
      ...(allowInsertRow
        ? [
            {
              id: "addRow",
              header: "",
              cell: ({ row }: { row: Row<EditableTableFeatures, T> }) => (
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
              cell: ({ row }: { row: Row<EditableTableFeatures, T> }) => (
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

  // コア行モデルは v9 では常に自動で作られるので、明示的に渡す必要はない
  const table = useTable({
    features: editableTableFeatures,
    data,
    columns: editableColumns,
    meta: {
      updateData: (rowIndex: number, columnId: string, value: string) => {
        // readOnlyカラムへの変更を無視
        const column = columns.find((candidate) => candidate.id === columnId)
        if (column?.meta?.readOnly) return

        onDataChange(
          data.map((row, index) =>
            index === rowIndex ? { ...row, [columnId]: value } : row
          )
        )
      },
    },
  })

  const addRow = () => {
    const newRow = columns.reduce<Record<string, string>>((acc, column) => {
      if (column.id) acc[column.id] = ""
      return acc
    }, {}) as T

    onDataChange([...data, newRow])
  }

  const addMultipleRows = (count: number) => {
    const newRows = Array.from(
      { length: count },
      () =>
        columns.reduce<Record<string, string>>((acc, column) => {
          if (column.id) acc[column.id] = ""
          return acc
        }, {}) as T
    )

    onDataChange([...data, ...newRows])
  }

  /**
   * 貼り付けで弾かれた件数を伝える。
   *
   * 貼り付けは EditableCell を経由しないので下書きが残らず、赤背景も出せない。
   * 位置がずれていれば「ほぼ全件」が弾かれるので、件数だけで気づける。
   */
  const notifyRejectedPaste = (rejectedCount: number) => {
    if (rejectedCount === 0) return
    toast.warning(`${rejectedCount}件の値が保存されませんでした`, {
      description: "貼り付ける位置がずれていませんか？",
    })
  }

  /** その列の検証に照らして保存されない値か */
  const isRejected = (column: EditableColumnDef<T>, value: string) =>
    value.trim() !== "" && column.meta?.validate
      ? !column.meta.validate(value)
      : false

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()

    const paste = e.clipboardData.getData("text")
    // CRLF/CR を LF に正規化してから分割（末尾セルに \r が混入するのを防ぐ）
    const rows = paste.replace(/\r\n?/g, "\n").split("\n")
    // 末尾の終端改行による空行のみ除去。途中の空行は行対応を保つため残す
    // （空行を除去すると空白セルの分だけ以降の行が上に詰まりズレる）
    while (rows.length > 0 && rows[rows.length - 1].trim() === "") rows.pop()

    if (rows.length === 0) return

    if (hasReadOnlyColumns) {
      // マージ型ペースト: readOnlyカラムをスキップし、editableカラムのみにデータをマッピング
      const editableCols = columns.filter((column) => !column.meta?.readOnly)

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
            (column) => column.id === focusedColId
          )
          if (editableIndex >= 0) startEditableColIndex = editableIndex
        }
      }

      const newData = [...data]
      let rejectedCount = 0
      for (let ri = 0; ri < rows.length; ri++) {
        const targetRow = startRowIndex + ri
        if (targetRow >= newData.length) break

        const cells = rows[ri].split("\t")
        const updatedRow = { ...newData[targetRow] }
        for (let ci = 0; ci < cells.length; ci++) {
          const targetCol = startEditableColIndex + ci
          if (targetCol >= editableCols.length) break
          const targetColumn = editableCols[targetCol]
          const colId = targetColumn.id
          if (colId) {
            ;(updatedRow as Record<string, unknown>)[colId] = cells[ci]
            if (isRejected(targetColumn, cells[ci])) rejectedCount++
          }
        }
        newData[targetRow] = updatedRow
      }

      onDataChange(newData)
      notifyRejectedPaste(rejectedCount)
    } else {
      // 全置換型ペースト（後方互換）
      let rejectedCount = 0
      const pastedData = rows.map((row) => {
        const cells = row.split("\t")
        return columns.reduce<Record<string, string>>((acc, column, index) => {
          if (column.id) {
            const value = cells[index] || ""
            acc[column.id] = value
            if (isRejected(column, value)) rejectedCount++
          }
          return acc
        }, {}) as T
      })

      onDataChange(pastedData)
      notifyRejectedPaste(rejectedCount)
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="rounded-md border">
        <table className="w-full" onPaste={handlePaste}>
          <thead>
            <tr className="border-b bg-muted/50">
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-sm font-medium text-muted-foreground"
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

      <div className="text-sm text-muted-foreground">
        💡 ヒント: Excelからデータをコピーして、テーブル上で貼り付け (Ctrl+V)
        できます
      </div>
    </div>
  )
}
