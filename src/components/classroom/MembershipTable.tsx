"use client"

import { Calendar, Edit, Trash2, User } from "lucide-react"
import { useMemo, useState } from "react"

import ConfirmationModal from "@/components/common/ConfirmationModal"
import { TooltipButton } from "@/components/common/TooltipButton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { SortableTableHead } from "@/components/ui/SortableTableHead"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useDialogTarget } from "@/hooks/useDialogTarget"
import { useTableSort } from "@/hooks/useTableSort"
import {
  compareMembershipPhase,
  matchesMembershipStatusFilter,
  type MembershipPhase,
  membershipPhase,
  type MembershipStatusFilter,
} from "@/lib/membership"
import { cn } from "@/lib/utils"
import type { ClassroomMembership } from "@/types/prismaExtensions"

interface ClassroomMembershipTableProps {
  memberships: ClassroomMembership[]
  statusFilter: MembershipStatusFilter
  onEdit: (membership: ClassroomMembership) => void
  onViewStudent: (membership: ClassroomMembership) => void
  onDelete: (membershipId: string) => void
  onBulkDelete?: (membershipIds: string[]) => void
}

// ソート用の型
interface ClassroomMembershipSortable {
  id: string
  studentId: string
  attendanceNumber: number | null
  fullName: string
  startDate: string
  endDate: string | null
  phase: MembershipPhase
  original: ClassroomMembership
}

export default function ClassroomMembershipTable({
  memberships,
  statusFilter,
  onEdit,
  onViewStudent,
  onDelete,
  onBulkDelete,
}: ClassroomMembershipTableProps) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  // 確認を開いた時点の選択を写しておく（窓に出す件数と消す対象を一致させる）
  const bulkDeletion = useDialogTarget<string[]>()

  // ソート用のデータ変換
  const sortableData = useMemo<ClassroomMembershipSortable[]>(() => {
    return memberships.map((membership) => ({
      id: membership.id,
      studentId: membership.student.studentNumber,
      attendanceNumber: membership.attendanceNumber ?? null,
      fullName: `${membership.student.lastName}${membership.student.firstName}`,
      startDate: membership.startDate.toISOString(),
      endDate: membership.endDate ? membership.endDate.toISOString() : null,
      phase: membershipPhase(membership),
      original: membership,
    }))
  }, [memberships])

  // ソート機能
  const { sortedData, sortConfig, requestSort } = useTableSort(sortableData, {
    defaultSort: { key: "attendanceNumber", direction: "asc" },
  })

  // ステータスフィルター適用（絞り込みはページ側が持つ）
  const filteredData = useMemo(
    () =>
      sortedData.filter((membership) =>
        matchesMembershipStatusFilter(membership.phase, statusFilter)
      ),
    [sortedData, statusFilter]
  )

  // 在籍中 → 在籍予定 → 過去の順に表示（ソート後）
  const displayData = useMemo(() => {
    // デフォルトソートの場合のみ、時期で並べる
    if (sortConfig.key === "attendanceNumber" || sortConfig.key === null) {
      return [...filteredData].sort((membershipA, membershipB) =>
        compareMembershipPhase(membershipA.phase, membershipB.phase)
      )
    }
    return filteredData
  }, [filteredData, sortConfig.key])

  // 絞り込みで隠れた行は選択に数えない（見えない所属を一括削除しないため）
  const selectedIds = useMemo(
    () =>
      new Set(
        displayData
          .filter((membership) => checkedIds.has(membership.id))
          .map((membership) => membership.id)
      ),
    [displayData, checkedIds]
  )

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setCheckedIds(new Set(displayData.map((membership) => membership.id)))
    } else {
      setCheckedIds(new Set())
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setCheckedIds(newSelected)
  }

  const handleBulkDelete = () => {
    if (selectedIds.size > 0 && onBulkDelete) {
      bulkDeletion.openWith(Array.from(selectedIds))
    }
  }

  const handleConfirmBulkDelete = () => {
    if (bulkDeletion.target !== null && onBulkDelete) {
      onBulkDelete(bulkDeletion.target)
      setCheckedIds(new Set())
    }
    bulkDeletion.close()
  }

  return (
    <div className="space-y-6">
      {/* 全所属一覧 */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              所属一覧
              <span className="ml-1 text-lg font-normal text-muted-foreground tabular-nums">
                ({displayData.length}名)
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  className="rounded-lg"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  選択した{selectedIds.size}件を削除
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {displayData.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-muted/40">
                    <TableHead className="w-14 px-4">
                      <Checkbox
                        checked={
                          selectedIds.size === displayData.length &&
                          displayData.length > 0
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <SortableTableHead
                      sortKey="studentId"
                      currentSortKey={sortConfig.key}
                      currentDirection={sortConfig.direction}
                      onSort={(key) => requestSort(key)}
                    >
                      学籍番号
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="attendanceNumber"
                      currentSortKey={sortConfig.key}
                      currentDirection={sortConfig.direction}
                      onSort={(key) => requestSort(key)}
                    >
                      出席番号
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="fullName"
                      currentSortKey={sortConfig.key}
                      currentDirection={sortConfig.direction}
                      onSort={(key) => requestSort(key)}
                    >
                      氏名
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="startDate"
                      currentSortKey={sortConfig.key}
                      currentDirection={sortConfig.direction}
                      onSort={(key) => requestSort(key)}
                    >
                      開始日
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="endDate"
                      currentSortKey={sortConfig.key}
                      currentDirection={sortConfig.direction}
                      onSort={(key) => requestSort(key)}
                    >
                      終了日
                    </SortableTableHead>
                    <TableHead>備考</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayData.map(({ original: membership, phase }) => (
                    <TableRow
                      key={membership.id}
                      className={cn(
                        "group",
                        phase === "past" && "bg-muted/20 opacity-50"
                      )}
                    >
                      <TableCell className="px-4">
                        <Checkbox
                          checked={selectedIds.has(membership.id)}
                          onCheckedChange={(checked) =>
                            handleSelectOne(membership.id, checked === true)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {membership.student.studentNumber}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {membership.attendanceNumber || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {membership.student.lastName}{" "}
                          {membership.student.firstName}
                          {phase === "current" && (
                            <Badge
                              variant="default"
                              className="rounded-full px-2 py-0.5 text-xs font-normal"
                            >
                              在籍中
                            </Badge>
                          )}
                          {phase === "upcoming" && (
                            <Badge
                              variant="outline"
                              className="rounded-full border-dashed px-2 py-0.5 text-xs font-normal"
                            >
                              在籍予定
                            </Badge>
                          )}
                          {phase === "past" && (
                            <Badge
                              variant="secondary"
                              className="rounded-full px-2 py-0.5 text-xs font-normal"
                            >
                              終了
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {membership.startDate.toLocaleDateString("ja-JP")}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {membership.endDate
                          ? membership.endDate.toLocaleDateString("ja-JP")
                          : "—"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">
                        {membership.notes || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5 opacity-60 transition-opacity group-hover:opacity-100">
                          <TooltipButton
                            label="個人ページを開く"

                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg transition-colors hover:bg-muted"
                            onClick={() => onViewStudent(membership)}
                          >
                            <User className="h-4 w-4" />
                          </TooltipButton>
                          <TooltipButton
                            label="所属を編集"

                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg transition-colors hover:bg-muted"
                            onClick={() => onEdit(membership)}
                          >
                            <Edit className="h-4 w-4" />
                          </TooltipButton>
                          <TooltipButton
                            label="所属を削除"

                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => onDelete(membership.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </TooltipButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              所属している生徒はいません
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmationModal
        open={bulkDeletion.isOpen}
        onClose={bulkDeletion.close}
        title={`選択された${bulkDeletion.target?.length ?? 0}件の所属を削除しますか？`}
        confirmText="削除"
        variant="destructive"
        icon="trash"
        onConfirm={handleConfirmBulkDelete}
      />
    </div>
  )
}
