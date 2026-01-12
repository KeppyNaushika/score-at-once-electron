"use client"

import {
  Membership,
  StudentWithMemberships,
} from "@/app/students/[studentId]/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, Calendar, Clock, Edit, PlusCircle } from "lucide-react"

interface CurrentMembershipsCardProps {
  student: StudentWithMemberships
  onAddMembership: () => void
  onEditMembership: (membership: Membership) => void
  onEndMembership: (membershipId: string) => void
}

export function CurrentMembershipsCard({
  student,
  onAddMembership,
  onEditMembership,
  onEndMembership,
}: CurrentMembershipsCardProps) {
  const now = new Date()
  const currentMemberships = student.memberships.filter(
    (m) => !m.endDate || new Date(m.endDate) >= now
  )

  return (
    <Card className="border-border/50 mb-8 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            現在の所属学級
          </CardTitle>
          <Button onClick={onAddMembership} className="rounded-lg">
            <PlusCircle className="mr-2 h-4 w-4" />
            所属追加
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {currentMemberships.length > 0 ? (
          <div className="space-y-4">
            {currentMemberships.map((membership) => (
              <div
                key={membership.id}
                className="border-border/50 bg-muted/5 hover:bg-muted/20 rounded-xl border p-5 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <h4 className="text-lg font-medium">
                        {membership.class.name}
                      </h4>
                      {membership.class.classCode && (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-normal"
                        >
                          {membership.class.classCode}
                        </Badge>
                      )}
                      {membership.attendanceNumber && (
                        <Badge
                          variant="secondary"
                          className="rounded-full px-2.5 py-0.5 text-xs font-normal"
                        >
                          出席番号 {membership.attendanceNumber}
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground space-y-2 text-sm">
                      <p className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>開始日</span>
                        <span className="tabular-nums">
                          {new Date(membership.startDate).toLocaleDateString(
                            "ja-JP"
                          )}
                        </span>
                      </p>
                      {membership.notes && (
                        <p className="bg-muted/50 rounded-lg p-3 text-sm">
                          {membership.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-muted h-8 w-8 rounded-lg transition-colors"
                      onClick={() => {
                        const membershipWithIds: Membership = {
                          ...membership,
                          studentId: student.id,
                          classId: membership.class.id,
                          student: {
                            id: student.id,
                            studentNumber: student.studentNumber,
                            lastName: student.lastName,
                            firstName: student.firstName,
                            lastNameKana: student.lastNameKana,
                            firstNameKana: student.firstNameKana,
                          },
                        }
                        onEditMembership(membershipWithIds)
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:bg-muted h-8 w-8 rounded-lg transition-colors"
                      onClick={() => onEndMembership(membership.id)}
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground py-12 text-center">
            <BookOpen className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>現在所属している学級はありません</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
