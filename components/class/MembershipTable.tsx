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
import { Calendar, Edit, Trash2, UserMinus } from "lucide-react"
import { useState } from "react"

interface MembershipTableProps {
  memberships: Membership[]
  onEdit: (membership: Membership) => void
  onEnd: (membershipId: string) => void
  onBulkEnd?: (membershipIds: string[]) => void
}

export default function MembershipTable({
  memberships,
  onEdit,
  onEnd,
  onBulkEnd,
}: MembershipTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // 現在の所属を出席番号順にソート
  const activeMemberships = memberships
    .filter((m) => !m.endDate)
    .sort((a, b) => {
      if (a.attendanceNumber && b.attendanceNumber) {
        return a.attendanceNumber - b.attendanceNumber
      }
      if (a.attendanceNumber) return -1
      if (b.attendanceNumber) return 1
      return 0
    })
  const endedMemberships = memberships.filter((m) => m.endDate)

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(activeMemberships.map(m => m.id)))
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
    if (selectedIds.size > 0 && onBulkEnd) {
      if (window.confirm(`選択された${selectedIds.size}件の所属を終了しますか？`)) {
        onBulkEnd(Array.from(selectedIds))
        setSelectedIds(new Set())
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* 現在の所属 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              現在の所属 ({activeMemberships.length}名)
            </CardTitle>
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                選択した{selectedIds.size}件を終了
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {activeMemberships.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedIds.size === activeMemberships.length && activeMemberships.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>学籍番号</TableHead>
                    <TableHead>出席番号</TableHead>
                    <TableHead>氏名</TableHead>
                    <TableHead>開始日</TableHead>
                    <TableHead>備考</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeMemberships.map((membership) => (
                    <TableRow key={membership.id}>
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
                        {membership.student.lastName}{" "}
                        {membership.student.firstName}
                      </TableCell>
                      <TableCell>
                        {membership.startDate.toLocaleDateString("ja-JP")}
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
                            onClick={() => onEnd(membership.id)}
                          >
                            <UserMinus className="h-4 w-4" />
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
              現在所属している生徒はいません
            </div>
          )}
        </CardContent>
      </Card>

      {/* 終了した所属 */}
      {endedMemberships.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              終了した所属 ({endedMemberships.length}名)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>学籍番号</TableHead>
                    <TableHead>出席番号</TableHead>
                    <TableHead>氏名</TableHead>
                    <TableHead>期間</TableHead>
                    <TableHead>備考</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endedMemberships.map((membership) => (
                    <TableRow key={membership.id} className="opacity-60">
                      <TableCell className="font-mono">
                        {membership.student.studentId}
                      </TableCell>
                      <TableCell className="text-center">
                        {membership.attendanceNumber || "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {membership.student.lastName}{" "}
                        {membership.student.firstName}
                      </TableCell>
                      <TableCell>
                        {membership.startDate.toLocaleDateString("ja-JP")} -
                        {membership.endDate?.toLocaleDateString("ja-JP")}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {membership.notes}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
