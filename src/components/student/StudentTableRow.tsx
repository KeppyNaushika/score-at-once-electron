"use client"

import { Edit, Trash2 } from "lucide-react"

import { TooltipButton } from "@/components/common/TooltipButton"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { TableCell, TableRow } from "@/components/ui/table"
import { compareMembershipPhase, membershipPhase } from "@/lib/membership"
import type { StudentWithMemberships } from "@/types/prismaExtensions"

interface StudentTableRowProps {
  student: StudentWithMemberships
  isSelected: boolean
  /** 行を押したとき（生徒の詳細を開く） */
  onOpen: () => void
  onToggleSelect: () => void
  onEdit: () => void
  onDelete: () => void
}

/** 生徒管理の一覧の1行。選択・編集・削除のボタンは行を開く押下に伝えない */
export function StudentTableRow({
  student,
  isSelected,
  onOpen,
  onToggleSelect,
  onEdit,
  onDelete,
}: StudentTableRowProps) {
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
          aria-label={`${student.lastName} ${student.firstName}を選択`}
        />
      </TableCell>
      <TableCell className="font-mono text-sm">
        {student.studentNumber}
      </TableCell>
      <TableCell className="font-medium">
        {student.lastName} {student.firstName}
      </TableCell>
      <TableCell className="tabular-nums">
        {student.enrollmentYear || (
          <span className="text-muted-foreground">未設定</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1.5">
          {/* 在籍中 → 在籍予定 → 過去の順に（同じ時期の中は開始日の新しい順）。
              在籍予定は点線の枠と「予定」で、過去の所属は薄い枠で分ける */}
          {student.memberships
            .toSorted((membershipA, membershipB) =>
              compareMembershipPhase(
                membershipPhase(membershipA),
                membershipPhase(membershipB)
              )
            )
            .map((membership) => {
              const phase = membershipPhase(membership)
              if (phase === "current") {
                return (
                  <Badge
                    key={membership.id}
                    variant="secondary"
                    className="rounded-full px-2.5 py-0.5 text-xs font-normal"
                  >
                    {membership.classroom.name}
                  </Badge>
                )
              }
              if (phase === "upcoming") {
                return (
                  <Badge
                    key={membership.id}
                    variant="outline"
                    title={`在籍予定（${new Date(membership.startDate).toLocaleDateString("ja-JP")}から）`}
                    className="rounded-full border-dashed px-2.5 py-0.5 text-xs font-normal"
                  >
                    {membership.classroom.name}
                    <span className="ml-1 text-muted-foreground">予定</span>
                  </Badge>
                )
              }
              return (
                <Badge
                  key={membership.id}
                  variant="outline"
                  title="過去の所属"
                  className="rounded-full px-2.5 py-0.5 text-xs font-normal text-muted-foreground"
                >
                  {membership.classroom.name}
                </Badge>
              )
            })}
          {student.memberships.length === 0 && (
            <span className="text-sm text-muted-foreground">未所属</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1.5 opacity-60 transition-opacity group-hover:opacity-100">
          <TooltipButton
            label="生徒を編集"

            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg transition-colors hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
          >
            <Edit className="h-4 w-4" />
          </TooltipButton>
          <TooltipButton
            label="生徒を削除"

            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 className="h-4 w-4" />
          </TooltipButton>
        </div>
      </TableCell>
    </TableRow>
  )
}
