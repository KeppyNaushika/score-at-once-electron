import type { KeyboardEvent, MouseEvent, ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { TableCell, TableRow } from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import {
  formatDay,
  formatFullDateTime,
  formatUpdatedAt,
} from "./entityListDateFormat"
import type { EntityListNextStep, SortableEntityRow } from "./types"

interface EntityListRowProps<TRow> {
  sortableRow: SortableEntityRow<TRow>
  /** 名前セルの2行目 */
  summary: ReactNode
  step: EntityListNextStep
  /** 選べない理由。あれば選択を止め、`title` に出す */
  selectionDisabledReason: string | undefined
  isSelected: boolean
  onToggleSelect: (checked: boolean) => void
  /** 行そのものを押したとき（概要ページへ） */
  onOpenOverview: () => void
  /** 「次のステップ」を押したとき */
  onOpenNextStep: () => void
  /** 行末の「…」の中身 */
  rowMenu: ReactNode
}

/** 押されたのが行そのものか、行の中の別の導線かを分ける */
function stopRowActivation(event: MouseEvent<HTMLTableCellElement>) {
  event.stopPropagation()
}

/**
 * 一覧の1行。**行のどこを押しても概要ページへ飛ぶ**が、チェックボックス・
 * 「次のステップ」・「…」の3つは行クリックを止める（別の当たり判定を持つため）。
 */
export function EntityListRow<TRow>({
  sortableRow,
  summary,
  step,
  selectionDisabledReason,
  isSelected,
  onToggleSelect,
  onOpenOverview,
  onOpenNextStep,
  rowMenu,
}: EntityListRowProps<TRow>) {
  const fullUpdatedAt = formatFullDateTime(sortableRow.updatedAt)

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    // 行そのものが導線なので、マウスと同じことをキーボードからもできるようにする
    if (event.key !== "Enter" && event.key !== " ") return
    if (event.target !== event.currentTarget) return
    event.preventDefault()
    onOpenOverview()
  }

  return (
    <TableRow
      className="group cursor-pointer"
      tabIndex={0}
      aria-label={`${sortableRow.name}の概要を開く`}
      onClick={onOpenOverview}
      onKeyDown={handleRowKeyDown}
    >
      {/* 選択の当たり判定はこのセルの中のチェックボックスだけ */}
      <TableCell className="text-center" onClick={stopRowActivation}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onToggleSelect(checked === true)}
          disabled={selectionDisabledReason !== undefined}
          title={selectionDisabledReason}
          aria-label={`${sortableRow.name}を選択`}
        />
      </TableCell>
      <TableCell>
        <div className="font-medium">{sortableRow.name}</div>
        <div className="text-sm text-muted-foreground">{summary}</div>
      </TableCell>
      <TableCell className="text-center text-sm text-muted-foreground tabular-nums">
        {formatDay(sortableRow.referenceDate)}
      </TableCell>
      {/*
        短い姿だけを出し、省略のない日時は hover で読ませる。
        行はどこを押しても概要ページへ飛ぶので、押して開く形にはできない
      */}
      <TableCell className="text-center text-sm text-muted-foreground tabular-nums">
        {fullUpdatedAt === null ? (
          formatUpdatedAt(sortableRow.updatedAt)
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{formatUpdatedAt(sortableRow.updatedAt)}</span>
            </TooltipTrigger>
            <TooltipContent>{fullUpdatedAt}</TooltipContent>
          </Tooltip>
        )}
      </TableCell>
      {/* 概要とは別の飛び先なので、行の当たり判定を止める */}
      <TableCell className="text-center" onClick={stopRowActivation}>
        <Button
          size="sm"
          className="w-48 justify-start rounded-lg text-left"
          onClick={onOpenNextStep}
        >
          <span className="text-xs">{step.label}</span>
        </Button>
      </TableCell>
      {/* 行メニュー。ここも行の当たり判定を止める */}
      <TableCell className="text-center" onClick={stopRowActivation}>
        {rowMenu}
      </TableCell>
    </TableRow>
  )
}
