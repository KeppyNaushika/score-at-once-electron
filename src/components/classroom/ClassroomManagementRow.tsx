"use client"

import { SquarePen, Trash } from "lucide-react"

import { TooltipButton } from "@/components/common/TooltipButton"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { TableCell, TableRow } from "@/components/ui/table"
import type { ClassroomWithMemberships } from "@/types/prismaExtensions"

interface ClassroomManagementRowProps {
  classroom: ClassroomWithMemberships
  /**
   * 名前・コード・学年が同じ別の学級が一覧にある。見分けるため、名前の下に作成日と
   * 在籍の始まった年を添える（同じ値の行が並ぶのは正常で、id で区別する）
   */
  hasSameLookingClassroom: boolean
  /** いま所属している生徒の数 */
  memberCount: number
  isSelected: boolean
  /** 行を押したとき（学級の詳細を開く） */
  onOpen: () => void
  onToggleSelect: () => void
  onEdit: () => void
  onDelete: () => void
}

/** 同じ名前の学級を見分ける添え書き（作成日と、所属の始まった年） */
function sameLookingClassroomDetail(
  classroom: ClassroomWithMemberships
): string {
  const startYears = [
    ...new Set(
      classroom.memberships.map((membership) =>
        new Date(membership.startDate).getFullYear()
      )
    ),
  ].toSorted((left, right) => left - right)
  return [
    `作成 ${classroom.createdAt.toLocaleDateString("ja-JP")}`,
    startYears.length > 0 ? `所属の開始 ${startYears.join("・")}年` : null,
  ]
    .filter((part) => part)
    .join("・")
}

/** 学級管理の一覧の1行。選択・編集・削除のボタンは行を開く押下に伝えない */
export function ClassroomManagementRow({
  classroom,
  hasSameLookingClassroom,
  memberCount,
  isSelected,
  onOpen,
  onToggleSelect,
  onEdit,
  onDelete,
}: ClassroomManagementRowProps) {
  return (
    <TableRow
      onClick={onOpen}
      className="group cursor-pointer"
      data-state={isSelected ? "selected" : undefined}
    >
      <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          aria-label={`${classroom.name}を選択`}
        />
      </TableCell>
      <TableCell className="font-medium">
        {classroom.name}
        {classroom.isVisible === false && (
          <Badge
            variant="secondary"
            className="ml-2 rounded-full px-2 py-0 text-xs font-normal"
          >
            非表示
          </Badge>
        )}
        {hasSameLookingClassroom && (
          <div className="text-xs font-normal text-muted-foreground">
            {sameLookingClassroomDetail(classroom)}
          </div>
        )}
      </TableCell>
      <TableCell>
        {classroom.classroomCode ? (
          <Badge
            variant="outline"
            className="rounded-full px-2.5 py-0.5 text-xs font-normal"
          >
            {classroom.classroomCode}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="tabular-nums">
        {classroom.grade || (
          <span className="text-muted-foreground">未設定</span>
        )}
      </TableCell>
      <TableCell>
        {classroom.description ? (
          <span className="max-w-xs truncate text-sm">
            {classroom.description}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="tabular-nums">{memberCount}名</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1.5 opacity-60 transition-opacity group-hover:opacity-100">
          <TooltipButton
            label="学級を編集"

            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg transition-colors hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
          >
            <SquarePen className="h-4 w-4" />
          </TooltipButton>
          <TooltipButton
            label="学級を削除"

            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash className="h-4 w-4" />
          </TooltipButton>
        </div>
      </TableCell>
    </TableRow>
  )
}
