"use client"
"use no memo"

import type { ColumnDef, Row, RowData } from "@tanstack/react-table"
import {
  columnSizingFeature,
  columnVisibilityFeature,
  flexRender,
  metaHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { Plus, Trash2 } from "lucide-react"
import React, { useCallback, useMemo } from "react"
import { toast } from "sonner"

import { TooltipButton } from "@/components/common/TooltipButton"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import { EditableCell } from "./editable-table/EditableCell"
import {
  mergePastedRows,
  type PasteOrigin,
  replaceWithPastedRows,
  splitPastedRows,
} from "./editable-table/pastedRows"

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
  /** 非空の入力の検証。false なら赤背景で注意を示す */
  validate?: (value: string) => boolean
  /**
   * 検証NGの入力をどう扱う列か。
   *
   * - `"reject"`（既定）: 保存されない。赤背景と「保存されません」の通知は破棄の予告。
   * - `"keep"`: 入力どおり保存する。赤背景は「想定していない値だ」という注意であって
   *   破棄の予告ではないので、通知も出さず、貼り付けの「保存されませんでした」の
   *   件数にも数えない（数えると嘘になる）。
   */
  invalidValuePolicy?: "reject" | "keep"
}

/**
 * このテーブルが使う機能と、`meta` の型。
 *
 * `tableMeta` / `columnMeta` は型専用スロットで、値は実行時に捨てられるので
 * `metaHelper` で型だけ渡す。この宣言はこのテーブルにしか効かないため、
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
  tableMeta: metaHelper<EditableTableMeta>(),
  columnMeta: metaHelper<EditableColumnMeta>(),
})

export type EditableTableFeatures = typeof editableTableFeatures

/** EditableTable に渡す列定義。`meta` はこのテーブル専用の型が付く */
export type EditableColumnDef<TData extends RowData> = ColumnDef<
  EditableTableFeatures,
  TData
>

interface EditableTableProps<T extends RowData> {
  data: T[]
  columns: EditableColumnDef<T>[]
  onDataChange: (data: T[]) => void
  /**
   * 空の行の作り方。渡した表だけが行を足せる（行追加のボタンと、貼り付けの全置換）。
   *
   * 新しい行の形は列の id からは作れない（列に出ない項目も行は持ちうる）ので、
   * 使う側が決める。渡さない表の貼り付けは全置換せず、今ある行へ配るだけになる。
   */
  createEmptyRow?: () => T
  allowDeleteRow?: boolean
  className?: string
  getRowProps?: (row: Row<EditableTableFeatures, T>) => { className?: string }
  /**
   * 貼り付けられた文字列を、表へ配る前に差し替える口（任意）。
   *
   * 渡さなければ従来どおり、貼られた文字列がそのまま配られる。表記を人へ尋ねて
   * から配りたい表だけがこれを渡す。**貼り付け1回につき1度**しか呼ばれない
   * （セルごとに尋ねると300人分の貼り付けで300回尋ねることになる）。
   *
   * 待っている間にフォーカスは移りうるので、貼り付け先の起点は呼ぶ前に読んである。
   */
  transformPastedText?: (pastedText: string) => Promise<string>
}
export function EditableTable<T extends RowData>({
  data,
  columns,
  onDataChange,
  createEmptyRow,
  allowDeleteRow = true,
  className = "",
  getRowProps,
  transformPastedText,
}: EditableTableProps<T>) {
  const deleteRow = useCallback(
    (rowIndex: number) => {
      onDataChange(data.filter((_, index) => index !== rowIndex))
    },
    [data, onDataChange]
  )

  const addRowAfter = useCallback(
    (index: number, createRow: () => T) => {
      onDataChange([
        ...data.slice(0, index + 1),
        createRow(),
        ...data.slice(index + 1),
      ])
    },
    [data, onDataChange]
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
      ...(createEmptyRow
        ? [
            {
              id: "addRow",
              header: "",
              cell: ({ row }: { row: Row<EditableTableFeatures, T> }) => (
                <TooltipButton
                  label="この行の下に新しい行を追加"

                  variant="ghost"
                  size="sm"
                  onClick={() => addRowAfter(row.index, createEmptyRow)}
                  className="h-6 w-6 p-0 text-green-600 hover:bg-green-50 hover:text-green-800"
                >
                  <Plus className="h-3 w-3" />
                </TooltipButton>
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
    [columns, createEmptyRow, allowDeleteRow, deleteRow, addRowAfter]
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

  const addRows = (count: number, createRow: () => T) => {
    onDataChange([...data, ...Array.from({ length: count }, createRow)])
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

  /** 編集できる列だけを、表に並んでいる順で */
  const editableColumnsForPaste = columns.filter(
    (column) => !column.meta?.readOnly
  )

  /** フォーカスしているセルから貼り付けの起点を読む（同期。待つ前に呼ぶこと） */
  const readPasteOrigin = (): PasteOrigin => {
    const activeElement = document.activeElement
    const td =
      activeElement instanceof HTMLElement ? activeElement.closest("td") : null
    const tr = td?.closest("tr")
    const tbody = tr?.closest("tbody")
    if (!td || !tr || !tbody) return { rowIndex: 0, editableColumnIndex: 0 }

    const allRows = Array.from(tbody.querySelectorAll("tr"))
    const rowIndex = allRows.indexOf(tr)

    // フォーカスセルのカラムIDを特定
    const allCells = Array.from(tr.querySelectorAll("td"))
    const cellIndex = allCells.indexOf(td)
    const visibleColumns = table.getVisibleLeafColumns()
    if (cellIndex < 0 || cellIndex >= visibleColumns.length) {
      return { rowIndex: Math.max(rowIndex, 0), editableColumnIndex: 0 }
    }
    const focusedColumnId = visibleColumns[cellIndex].id
    const editableColumnIndex = editableColumnsForPaste.findIndex(
      (column) => column.id === focusedColumnId
    )
    return {
      rowIndex: Math.max(rowIndex, 0),
      editableColumnIndex: Math.max(editableColumnIndex, 0),
    }
  }

  /** 貼り付けられた文字列を表へ配る */
  const applyPastedText = (pastedText: string, origin: PasteOrigin) => {
    const pastedRows = splitPastedRows(pastedText)
    if (pastedRows.length === 0) return

    // 全置換は行を作るので、空の行の作り方を渡された表だけ
    const pasted =
      hasReadOnlyColumns || !createEmptyRow
        ? mergePastedRows(data, pastedRows, origin, editableColumnsForPaste)
        : replaceWithPastedRows(pastedRows, columns, createEmptyRow)
    onDataChange(pasted.rows)
    notifyRejectedPaste(pasted.rejectedCount)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()

    const pastedText = e.clipboardData.getData("text")
    // 起点は今読む。差し替えを待つ間にフォーカスが移りうる
    const origin = readPasteOrigin()

    if (!transformPastedText) {
      applyPastedText(pastedText, origin)
      return
    }
    void transformPastedText(pastedText).then((resolvedText) => {
      applyPastedText(resolvedText, origin)
    })
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="rounded-md border">
        {/*
          横に流すのは呼び出し側の箱（Table の既定の包みは overflow-auto）。
          ここで流すと、端のマスの入力欄の focus ring が包みで切れる
        */}
        <Table
          className="text-base"
          wrapperClassName="overflow-visible"
          onPaste={handlePaste}
        >
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-auto bg-transparent px-4 py-3 text-sm whitespace-normal text-muted-foreground"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => {
              const rowProps = getRowProps?.(row) || {}
              return (
                <TableRow
                  key={row.id}
                  className={cn("hover:bg-muted/50", rowProps.className)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="relative h-9 p-0 whitespace-normal"
                    >
                      <div className="flex h-full items-center px-4 py-2">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {createEmptyRow && (
        <div className="flex justify-start gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => addRows(1, createEmptyRow)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            行を追加
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => addRows(5, createEmptyRow)}
              className="px-2 text-xs"
            >
              +5行
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addRows(10, createEmptyRow)}
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
