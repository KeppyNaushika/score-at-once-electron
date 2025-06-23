"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Membership } from "@/hooks/useClassManagement"
import { Calendar, Edit, UserMinus } from "lucide-react"

interface MembershipTableProps {
  memberships: Membership[]
  onEdit: (membership: Membership) => void
  onEnd: (membershipId: string) => void
}

export default function MembershipTable({
  memberships,
  onEdit,
  onEnd,
}: MembershipTableProps) {
  const activeMemberships = memberships.filter((m) => !m.endDate)
  const endedMemberships = memberships.filter((m) => m.endDate)

  return (
    <div className="space-y-6">
      {/* 現在の所属 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            現在の所属 ({activeMemberships.length}名)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeMemberships.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>学籍番号</TableHead>
                    <TableHead>氏名</TableHead>
                    <TableHead>開始日</TableHead>
                    <TableHead>種別</TableHead>
                    <TableHead>教科</TableHead>
                    <TableHead>備考</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeMemberships.map((membership) => (
                    <TableRow key={membership.id}>
                      <TableCell className="font-mono">
                        {membership.student.studentId}
                      </TableCell>
                      <TableCell className="font-medium">
                        {membership.student.lastName}{" "}
                        {membership.student.firstName}
                      </TableCell>
                      <TableCell>
                        {membership.startDate.toLocaleDateString("ja-JP")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {membership.membershipType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {membership.subject && (
                          <Badge variant="secondary">
                            {membership.subject}
                          </Badge>
                        )}
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
                    <TableHead>氏名</TableHead>
                    <TableHead>期間</TableHead>
                    <TableHead>種別</TableHead>
                    <TableHead>教科</TableHead>
                    <TableHead>備考</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endedMemberships.map((membership) => (
                    <TableRow key={membership.id} className="opacity-60">
                      <TableCell className="font-mono">
                        {membership.student.studentId}
                      </TableCell>
                      <TableCell className="font-medium">
                        {membership.student.lastName}{" "}
                        {membership.student.firstName}
                      </TableCell>
                      <TableCell>
                        {membership.startDate.toLocaleDateString("ja-JP")} -
                        {membership.endDate?.toLocaleDateString("ja-JP")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {membership.membershipType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {membership.subject && (
                          <Badge variant="secondary">
                            {membership.subject}
                          </Badge>
                        )}
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
