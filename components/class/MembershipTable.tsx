"use client"

import { Calendar, Edit, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

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
import { Membership } from "@/hooks/useClassManagement"
import { useTableSort } from "@/hooks/useTableSort"
import { cn } from "@/lib/utils"

interface MembershipTableProps {
  memberships: Membership[]
  onEdit: (membership: Membership) => void
  onDelete: (membershipId: string) => void
  onBulkDelete?: (membershipIds: string[]) => void
}

// ソート用の型
interface MembershipSortable {
  id: string
  studentId: string
  attendanceNumber: number | null
  fullName: string
  startDate: string
  endDate: string | null
  isCurrent: boolean
  original: Membership
}

export default function MembershipTable({
  memberships,
  onEdit,
  onDelete,
  onBulkDelete,
}: MembershipTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // 現在所属中かどうかを判定するヘルパー関数
  const isCurrentMembership = (m: { endDate?: Date | null }) => {
    if (!m.endDate) return true
    return new Date(m.endDate) >= new Date()
  }

  // ソート用のデータ変換
  const sortableData = useMemo<MembershipSortable[]>(() => {
    return memberships.map((m) => ({
      id: m.id,
      studentId: m.student.studentNumber,
      attendanceNumber: m.attendanceNumber ?? null,
      fullName: `${m.student.lastName}${m.student.firstName}`,
      startDate: m.startDate.toISOString(),
      endDate: m.endDate ? m.endDate.toISOString() : null,
      isCurrent: isCurrentMembership(m),
      original: m,
    }))
  }, [memberships])

  // ソート機能
  const { sortedData, sortConfig, requestSort } = useTableSort(sortableData, {
    defaultSort: { key: "attendanceNumber", direction: "asc" },
  })

  // 現在の所属を優先表示（ソート後）
  const displayData = useMemo(() => {
    // デフォルトソートの場合のみ、現在の所属を優先
    if (sortConfig.key === "attendanceNumber" || sortConfig.key === null) {
      return [...sortedData].sort((a, b) => {
        if (a.isCurrent && !b.isCurrent) return -1
        if (!a.isCurrent && b.isCurrent) return 1
        return 0
      })
    }
    return sortedData
  }, [sortedData, sortConfig.key])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(displayData.map((m) => m.id)))
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
              <span className="text-muted-foreground ml-1 text-lg font-normal tabular-nums">
                ({displayData.length}名)
              </span>
            </CardTitle>
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
        </CardHeader>
        <CardContent>
          {displayData.length > 0 ? (
            <div className="border-border/50 overflow-hidden rounded-xl border">
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
                      currentSortKey={sortConfig.key as string | null}
                      currentDirection={sortConfig.direction}
                      onSort={(key) =>
                        requestSort(key as keyof MembershipSortable)
                      }
                    >
                      学籍番号
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="attendanceNumber"
                      currentSortKey={sortConfig.key as string | null}
                      currentDirection={sortConfig.direction}
                      onSort={(key) =>
                        requestSort(key as keyof MembershipSortable)
                      }
                    >
                      出席番号
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="fullName"
                      currentSortKey={sortConfig.key as string | null}
                      currentDirection={sortConfig.direction}
                      onSort={(key) =>
                        requestSort(key as keyof MembershipSortable)
                      }
                    >
                      氏名
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="startDate"
                      currentSortKey={sortConfig.key as string | null}
                      currentDirection={sortConfig.direction}
                      onSort={(key) =>
                        requestSort(key as keyof MembershipSortable)
                      }
                    >
                      開始日
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="endDate"
                      currentSortKey={sortConfig.key as string | null}
                      currentDirection={sortConfig.direction}
                      onSort={(key) =>
                        requestSort(key as keyof MembershipSortable)
                      }
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
                            handleSelectOne(membership.id, checked as boolean)
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
                            className="hover:bg-muted h-8 w-8 rounded-lg transition-colors"
                            onClick={() => onEdit(membership)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-8 w-8 rounded-lg transition-colors"
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
            <div className="text-muted-foreground py-12 text-center">
              所属している生徒はいません
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
