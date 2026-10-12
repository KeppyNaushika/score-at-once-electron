"use client"

import type {
  RosterColumn,
  RosterRow,
  RosterTableSlots,
} from "@/components/common/roster-table/types"
import { DragHandle, useSortableRow } from "@/components/common/sortable-table"
import { Checkbox } from "@/components/ui/checkbox"
import { TableCell, TableRow } from "@/components/ui/table"

interface RosterTableRowProps {
  row: RosterRow
  isSelected: boolean
  /** 行・チェックボックスのクリック（Shift の範囲選択に使うのでイベントごと渡す） */
  onToggleSelection: (studentId: string, event: React.MouseEvent) => void
  additionalColumns: RosterColumn[]
  rowActionButtons?: RosterTableSlots["rowActionButtons"]
}

/**
 * ドラッグ可能な名簿テーブル行
 *
 * コア列（学籍番号/氏名/ふりがな/学級/出席番号）に加え、スロットの追加列・
 * 行アクションボタンを描画する。
 */
export function RosterTableRow({
  row,
  isSelected,
  onToggleSelection,
  additionalColumns,
  rowActionButtons,
}: RosterTableRowProps) {
  const { setNodeRef, style, isDragging, dragHandleProps } = useSortableRow(
    row.id
  )

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? "bg-muted/50 shadow-lg" : ""} cursor-pointer`}
      // Shift+クリックで範囲を選ぶとき、文字列の選択が伸びないようにする
      onMouseDown={(event) => {
        if (event.shiftKey) event.preventDefault()
      }}
      onClick={(event) => {
        if (!event.defaultPrevented) {
          onToggleSelection(row.id, event)
        }
      }}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          <DragHandle dragHandleProps={dragHandleProps} />
          <Checkbox
            checked={isSelected}
            // 選択は呼び手が持つ（制御）。トグルはクリックのイベントから行い、
            // Shift を範囲選択へ届ける。Space キーもボタンのクリックとしてここへ来る。
            // 行の onClick へ泡立つと同じトグルが2回走るので止める
            onClick={(event) => {
              event.stopPropagation()
              onToggleSelection(row.id, event)
            }}
            aria-label={`${row.lastName} ${row.firstName}を選択`}
          />
        </div>
      </TableCell>
      <TableCell className="text-center font-medium">
        {row.classroomInfo.attendanceNumber ?? "-"}
      </TableCell>
      <TableCell className="font-mono">{row.studentNumber}</TableCell>
      <TableCell className="font-medium">
        {row.lastName} {row.firstName}
      </TableCell>
      <TableCell className="text-muted-foreground">{row.kana}</TableCell>
      <TableCell>{row.classroomInfo.classroom?.name ?? "-"}</TableCell>
      {additionalColumns.map((column) => (
        <TableCell key={column.key} className={column.cellClassName}>
          {column.cell(row)}
        </TableCell>
      ))}
      {rowActionButtons && (
        <TableCell className={rowActionButtons.cellClassName}>
          <div onClick={(e) => e.stopPropagation()}>
            {rowActionButtons.render(row)}
          </div>
        </TableCell>
      )}
    </TableRow>
  )
}
