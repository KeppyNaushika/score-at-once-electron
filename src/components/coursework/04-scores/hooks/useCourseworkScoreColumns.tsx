import { useMemo } from "react"

import type { EditableColumnDef } from "@/components/common/EditableTable"
import type { CourseworkItemWithLetterScales } from "@/types/coursework.types"

import { isUnknownLetterValue } from "../../courseworkLetterValues"
import {
  adjColId,
  commentColId,
  isBlankOrFiniteNumber,
  reasonColId,
  type ScoreRow,
} from "../scoreTableRows"

/** 氏名・学級は途中で改行すると読みにくいので、列の幅は中身に合わせて広がらせる */
const READ_ONLY_COLUMNS: EditableColumnDef<ScoreRow>[] = [
  { id: "attendanceNumber", label: "出席番号", size: 70 },
  { id: "className", label: "学級", size: 80 },
  { id: "studentName", label: "氏名", size: 120 },
].map(({ id, label, size }): EditableColumnDef<ScoreRow> => ({
  id,
  header: () => <span className="whitespace-nowrap">{label}</span>,
  accessorKey: id,
  size,
  meta: { readOnly: true },
  cell: ({ getValue }) => (
    <span className="text-sm whitespace-nowrap">{String(getValue())}</span>
  ),
}))

/** 評価項目1つ分の列（値の列と、点数だけ表示でなければ補助列3つ） */
function itemColumns(
  item: CourseworkItemWithLetterScales,
  scoreOnly: boolean
): EditableColumnDef<ScoreRow>[] {
  const isLetter = item.inputMode === "letter"
  const validLabels = item.letterScales
    .map((letterScale) => letterScale.label)
    .join("/")
  const valueColumn: EditableColumnDef<ScoreRow> = {
    id: item.id,
    header: isLetter
      ? `${item.name} (評価)`
      : `${item.name} (満点${item.maxScore})`,
    accessorKey: item.id,
    size: 110,
    meta: {
      placeholder: isLetter ? validLabels || "評価記号" : "数値",
      // 文字評価は入力どおり保存する。赤は「変換表に無い」という注意で、
      // 変換表を1つも作っていない段階では判定しない（全マスが赤くても
      // 直しようがない）。数値は有限の数値なら有効で、満点超過も負数も
      // 許容する（配点の枠を超えて成績へ加減できる仕様）。
      invalidValuePolicy: isLetter ? "keep" : "reject",
      validate: (value: string) =>
        isLetter
          ? !isUnknownLetterValue(item, value)
          : isBlankOrFiniteNumber(value),
    },
  }
  if (scoreOnly) return [valueColumn]
  return [
    valueColumn,
    {
      id: adjColId(item.id),
      header: `${item.name}·加減点`,
      accessorKey: adjColId(item.id),
      size: 90,
      // 加減点は有限の数値のみ有効
      meta: { placeholder: "±0", validate: isBlankOrFiniteNumber },
    },
    {
      id: reasonColId(item.id),
      header: `${item.name}·理由`,
      accessorKey: reasonColId(item.id),
      size: 120,
      meta: { placeholder: "期限超過 等" },
    },
    {
      id: commentColId(item.id),
      header: `${item.name}·コメント`,
      accessorKey: commentColId(item.id),
      size: 160,
      meta: { placeholder: "通知書に表示" },
    },
  ]
}

/**
 * 点数入力の表の列。
 *
 * @param scoreOnly 点数だけ表示（補助列を隠す）
 * @param locked 成績算出のロック中。点数の列も読み取り専用にする（入力も貼り付けも
 *   受け付けない）
 */
export function useCourseworkScoreColumns(
  items: CourseworkItemWithLetterScales[],
  scoreOnly: boolean,
  locked: boolean
): EditableColumnDef<ScoreRow>[] {
  return useMemo(() => {
    const scoreColumns = items
      .flatMap((item) => itemColumns(item, scoreOnly))
      .map((column) =>
        locked
          ? { ...column, meta: { ...column.meta, readOnly: true } }
          : column
      )
    return [...READ_ONLY_COLUMNS, ...scoreColumns]
  }, [items, scoreOnly, locked])
}
