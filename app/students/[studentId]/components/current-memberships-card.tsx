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
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            現在の所属学級
          </CardTitle>
          <Button onClick={onAddMembership} size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            所属追加
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {currentMemberships.length > 0 ? (
          <div className="space-y-3">
            {currentMemberships.map((membership) => (
              <div key={membership.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <h4 className="text-lg font-medium">
                        {membership.class.name}
                      </h4>
                      {membership.class.classCode && (
                        <Badge variant="outline">
                          {membership.class.classCode}
                        </Badge>
                      )}
                      {membership.attendanceNumber && (
                        <Badge variant="secondary">
                          出席番号: {membership.attendanceNumber}
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground space-y-1 text-sm">
                      <p className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        開始日:{" "}
                        {new Date(membership.startDate).toLocaleDateString(
                          "ja-JP"
                        )}
                      </p>
                      {membership.notes && (
                        <p className="bg-muted rounded p-2">
                          {membership.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const membershipWithIds: Membership = {
                          ...membership,
                          studentId: student.id,
                          classId: membership.class.id,
                          student: {
                            id: student.id,
                            studentId: student.studentId,
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
                      size="sm"
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
          <div className="text-muted-foreground py-8 text-center">
            <BookOpen className="mx-auto mb-2 h-12 w-12 opacity-50" />
            <p>現在所属している学級はありません</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
