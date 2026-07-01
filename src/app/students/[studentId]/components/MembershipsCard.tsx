"use client"

import { Clock, Edit, PlusCircle, Users } from "lucide-react"
import { useMemo } from "react"

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
import { isCurrentMembership } from "@/lib/membership"
import type {
  StudentClassMembershipWithDetails,
  StudentWithMemberships,
} from "@/types/prismaExtensions"

interface MembershipsCardProps {
  student: StudentWithMemberships
  onAddMembership: () => void
  onEditMembership: (membership: StudentClassMembershipWithDetails) => void
  onEndMembership: (membershipId: string) => void
}

const formatDate = (date: Date) => new Date(date).toLocaleDateString("ja-JP")

export function MembershipsCard({
  student,
  onAddMembership,
  onEditMembership,
  onEndMembership,
}: MembershipsCardProps) {
  const sortedMemberships = useMemo(() => {
    return [...student.memberships].sort((a, b) => {
      const aCurrent = isCurrentMembership(a)
      const bCurrent = isCurrentMembership(b)
      if (aCurrent && !bCurrent) return -1
      if (!aCurrent && bCurrent) return 1
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    })
  }, [student.memberships])

  return (
    <Card className="border-border/50 mb-8 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            学級所属
            <span className="text-muted-foreground ml-1 text-lg font-normal tabular-nums">
              ({student.memberships.length}件)
            </span>
          </CardTitle>
          <Button
            onClick={onAddMembership}
            variant="outline"
            className="rounded-lg"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            所属追加
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {sortedMemberships.length > 0 ? (
          <div className="border-border/50 overflow-hidden rounded-xl border">
            <Table>
              <TableHeader className="bg-card">
                <TableRow className="hover:bg-transparent">
                  <TableHead>学級名</TableHead>
                  <TableHead className="w-24">出席番号</TableHead>
                  <TableHead className="w-36">開始日</TableHead>
                  <TableHead className="w-36">終了日</TableHead>
                  <TableHead>備考</TableHead>
                  <TableHead className="w-20 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMemberships.map((membership) => {
                  const isCurrent = isCurrentMembership(membership)

                  return (
                    <TableRow
                      key={membership.id}
                      className={`group ${!isCurrent ? "opacity-50" : ""}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {membership.classroom.name}
                          </span>
                          {membership.classroom.classCode && (
                            <Badge
                              variant="outline"
                              className="rounded-full px-2 py-0.5 text-xs font-normal"
                            >
                              {membership.classroom.classCode}
                            </Badge>
                          )}
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
                        {membership.attendanceNumber || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatDate(membership.startDate)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {membership.endDate
                          ? formatDate(membership.endDate)
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
                            onClick={() =>
                              onEditMembership({
                                ...membership,
                                student,
                              } as StudentClassMembershipWithDetails)
                            }
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {isCurrent && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:bg-muted h-8 w-8 rounded-lg transition-colors"
                              onClick={() => onEndMembership(membership.id)}
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-muted-foreground py-12 text-center">
            <Users className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>学級所属がありません</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
