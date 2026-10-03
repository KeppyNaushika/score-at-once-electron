"use client"
"use no memo"

import type { CellContext, RowData } from "@tanstack/react-table"
import React, { useRef, useState } from "react"
import { toast } from "sonner"

import type { EditableTableFeatures } from "../EditableTable"

type EditableCellProps<T extends RowData> = CellContext<
  EditableTableFeatures,
  T,
  unknown
>

/** 表の1マスの入力欄（下書き・検証・Enter/Tab での移動） */
export function EditableCell<T extends RowData>({
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
  const keepsInvalidValue = meta?.invalidValuePolicy === "keep"

  // 非空かつ検証NGのセルは赤背景で警告
  const isInvalid =
    strValue.trim() !== "" && meta?.validate ? !meta.validate(strValue) : false

  const onBlur = () => {
    table.options.meta?.updateData(row.index, column.id, strValue)
    // 下書きは残す。親が受け付ければ確定値が変わって外れ、弾かれれば残って赤いまま。
    // 赤背景だけでは何が悪いか伝わらず、title はホバーしないと出ないので通知する。
    // 入力どおり保存する列は失われるものが無いので、通知はしない（赤だけで足りる）
    if (isInvalid && !keepsInvalidValue) {
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
      if (targetRowIndex < 0 || targetRowIndex >= rows.length) {
        // 移る先が無くてもフォーカスは外れないので、ここで確定する
        onBlur()
        return
      }
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
      } else {
        // 表の最後（最初）のマス。移る先が無いとフォーカスが外れず onBlur が
        // 来ないので、ここで確定する。確定しないと、そのまま画面を移ったときに
        // 最後に打った値が保存されない
        onBlur()
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
        isInvalid
          ? keepsInvalidValue
            ? "想定していない値です（入力どおり保存します）"
            : "無効な値です（このままでは保存されません）"
          : undefined
      }
    />
  )
}
