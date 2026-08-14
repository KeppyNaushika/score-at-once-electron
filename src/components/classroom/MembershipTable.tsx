"use client"

import { Calendar, Edit, Trash2, User } from "lucide-react"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SortableTableHead } from "@/components/ui/SortableTableHead"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTableSort } from "@/hooks/useTableSort"
import { isCurrentMembership } from "@/lib/membership"
import { cn } from "@/lib/utils"
import type { ClassroomMembership } from "@/types/prismaExtensions"

interface ClassroomMembershipTableProps {
  memberships: ClassroomMembership[]
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
  isCurrent: boolean
  original: ClassroomMembership
}

export default function ClassroomMembershipTable({
  memberships,
  onEdit,
  onViewStudent,
  onDelete,
  onBulkDelete,
}: ClassroomMembershipTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<"current" | "ended" | "all">(
    "current"
  )

  // ソート用のデータ変換
  const sortableData = useMemo<ClassroomMembershipSortable[]>(() => {
    return memberships.map((membership) => ({
      id: membership.id,
      studentId: membership.student.studentNumber,
      attendanceNumber: membership.attendanceNumber ?? null,
      fullName: `${membership.student.lastName}${membership.student.firstName}`,
      startDate: membership.startDate.toISOString(),
      endDate: membership.endDate ? membership.endDate.toISOString() : null,
      isCurrent: isCurrentMembership(membership),
      original: membership,
    }))
  }, [memberships])

  // ソート機能
  const { sortedData, sortConfig, requestSort } = useTableSort(sortableData, {
    defaultSort: { key: "attendanceNumber", direction: "asc" },
  })

  // ステータスフィルター適用（既定は在籍中のみ）
  const filteredData = useMemo(() => {
    if (statusFilter === "current") {
      return sortedData.filter((membership) => membership.isCurrent)
    }
    if (statusFilter === "ended") {
      return sortedData.filter((membership) => !membership.isCurrent)
    }
    return sortedData
  }, [sortedData, statusFilter])

  // 現在の所属を優先表示（ソート後）
  const displayData = useMemo(() => {
    // デフォルトソートの場合のみ、現在の所属を優先
    if (sortConfig.key === "attendanceNumber" || sortConfig.key === null) {
      return [...filteredData].sort((membershipA, membershipB) => {
        if (membershipA.isCurrent && !membershipB.isCurrent) return -1
        if (!membershipA.isCurrent && membershipB.isCurrent) return 1
        return 0
      })
    }
    return filteredData
  }, [filteredData, sortConfig.key])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(displayData.map((membership) => membership.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedIds(newSelected)
  }

  const handleBulkDelete = () => {
    if (selectedIds.size > 0 && onBulkDelete) {
      if (
        window.confirm(`選択された${selectedIds.size}件の所属を削除しますか？`)
      ) {
        onBulkDelete(Array.from(selectedIds))
        setSelectedIds(new Set())
      }
    }
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
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as "current" | "ended" | "all")
                  setSelectedIds(new Set())
                }}
              >
                <SelectTrigger className="w-36 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">在籍中のみ</SelectItem>
                  <SelectItem value="ended">終了済みのみ</SelectItem>
                  <SelectItem value="all">すべて</SelectItem>
                </SelectContent>
              </Select>
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
                  {displayData.map(({ original: membership, isCurrent }) => (
                    <TableRow
                      key={membership.id}
                      className={cn(
                        "group",
                        !isCurrent && "bg-muted/20 opacity-50"
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
                          {isCurrent ? (
                            <Badge
                              variant="default"
                              className="rounded-full px-2 py-0.5 text-xs font-normal"
                            >
                              在籍中
                            </Badge>
                          ) : (
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg transition-colors hover:bg-muted"
                            onClick={() => onViewStudent(membership)}
                            title="個人ページを開く"
                          >
                            <User className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg transition-colors hover:bg-muted"
                            onClick={() => onEdit(membership)}
                            title="所属を編集"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => onDelete(membership.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
    </div>
  )
}
