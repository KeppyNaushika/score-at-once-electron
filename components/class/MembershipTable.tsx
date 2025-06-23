"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Membership } from "@/hooks/useClassManagement"
import { Calendar, Edit, Trash2 } from "lucide-react"
import { useState } from "react"

interface MembershipTableProps {
  memberships: Membership[]
  onEdit: (membership: Membership) => void
  onDelete: (membershipId: string) => void
  onBulkDelete?: (membershipIds: string[]) => void
}

export default function MembershipTable({
  memberships,
  onEdit,
  onDelete,
  onBulkDelete,
}: MembershipTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // すべての所属を現在の所属を優先してソート
  const sortedMemberships = memberships
    .sort((a, b) => {
      // 現在の所属（endDateがnull）を先に表示
      if (!a.endDate && b.endDate) return -1
      if (a.endDate && !b.endDate) return 1
      
      // 両方とも現在の所属または両方とも終了した所属の場合、出席番号順
      if (a.attendanceNumber && b.attendanceNumber) {
        return a.attendanceNumber - b.attendanceNumber
      }
      if (a.attendanceNumber) return -1
      if (b.attendanceNumber) return 1
      return 0
    })

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(sortedMemberships.map(m => m.id)))
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
      if (window.confirm(`選択された${selectedIds.size}件の所属を削除しますか？`)) {
        onBulkDelete(Array.from(selectedIds))
        setSelectedIds(new Set())
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* 全所属一覧 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              所属一覧 ({sortedMemberships.length}名)
            </CardTitle>
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                選択した{selectedIds.size}件を削除
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {sortedMemberships.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedIds.size === sortedMemberships.length && sortedMemberships.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>学籍番号</TableHead>
                    <TableHead>出席番号</TableHead>
                    <TableHead>氏名</TableHead>
                    <TableHead>開始日</TableHead>
                    <TableHead>終了日</TableHead>
                    <TableHead>備考</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedMemberships.map((membership) => (
                    <TableRow 
                      key={membership.id}
                      className={membership.endDate ? "opacity-60" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(membership.id)}
                          onCheckedChange={(checked) => handleSelectOne(membership.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-mono">
                        {membership.student.studentId}
                      </TableCell>
                      <TableCell className="text-center">
                        {membership.attendanceNumber || "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {membership.student.lastName}{" "}
                          {membership.student.firstName}
                          {!membership.endDate && (
                            <Badge variant="default" className="text-xs">
                              在籍中
                            </Badge>
                          )}
                          {membership.endDate && (
                            <Badge variant="secondary" className="text-xs">
                              終了
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {membership.startDate.toLocaleDateString("ja-JP")}
                      </TableCell>
                      <TableCell>
                        {membership.endDate ? membership.endDate.toLocaleDateString("ja-JP") : "-"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {membership.notes}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onEdit(membership)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
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
            <div className="text-muted-foreground py-8 text-center">
              所属している生徒はいません
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
