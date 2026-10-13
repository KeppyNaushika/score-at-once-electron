import type { StudentClassroomMembership } from "@prisma/client"

import { Badge } from "@/components/ui/badge"
import { TableCell } from "@/components/ui/table"
import { MEMBERSHIP_PHASE_LABELS, type MembershipPhase } from "@/lib/membership"

/** 時期ごとのバッジの見た目（在籍中は塗り・在籍予定は破線・過去在籍は控えめ） */
const PHASE_BADGE_STYLES: Record<
  MembershipPhase,
  { variant: "default" | "outline" | "secondary"; className: string }
> = {
  current: {
    variant: "default",
    className: "rounded-full px-2 py-0.5 text-xs font-normal",
  },
  upcoming: {
    variant: "outline",
    className: "rounded-full border-dashed px-2 py-0.5 text-xs font-normal",
  },
  past: {
    variant: "secondary",
    className: "rounded-full px-2 py-0.5 text-xs font-normal",
  },
}

/**
 * 在籍の時期（在籍中・在籍予定・過去在籍）のバッジ。
 * 学級の在籍一覧と生徒の在籍一覧が同じ姿で書き並べていたのを1つにした。
 */
export function MembershipPhaseBadge({ phase }: { phase: MembershipPhase }) {
  const style = PHASE_BADGE_STYLES[phase]
  return (
    <Badge variant={style.variant} className={style.className}>
      {MEMBERSHIP_PHASE_LABELS[phase]}
    </Badge>
  )
}

interface MembershipPeriodCellsProps {
  membership: Pick<
    StudentClassroomMembership,
    "startDate" | "endDate" | "notes"
  >
}

/** 在籍の開始日・終了日・備考の3つのセル。無いものは「—」 */
export function MembershipPeriodCells({
  membership,
}: MembershipPeriodCellsProps) {
  return (
    <>
      <TableCell className="tabular-nums">
        {new Date(membership.startDate).toLocaleDateString("ja-JP")}
      </TableCell>
      <TableCell className="tabular-nums">
        {membership.endDate
          ? new Date(membership.endDate).toLocaleDateString("ja-JP")
          : "—"}
      </TableCell>
      <TableCell className="max-w-xs truncate text-sm">
        {membership.notes || <span className="text-muted-foreground">—</span>}
      </TableCell>
    </>
  )
}
