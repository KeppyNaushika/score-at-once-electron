"use client"

import {
  Membership,
  StudentWithMemberships,
} from "@/app/students/[studentId]/types"
import StudentMembershipTimeline from "@/components/student/StudentMembershipTimeline"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock } from "lucide-react"

interface MembershipHistoryCardProps {
  student: StudentWithMemberships
  onEditMembership: (membership: Membership) => void
  onEndMembership: (membershipId: string) => void
}

export function MembershipHistoryCard({
  student,
  onEditMembership,
  onEndMembership,
}: MembershipHistoryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          所属履歴
        </CardTitle>
      </CardHeader>
      <CardContent>
        <StudentMembershipTimeline
          memberships={student.memberships.map((m) => ({
            ...m,
            studentId: student.id,
            classId: m.class.id,
            student: {
              id: student.id,
              studentId: student.studentId,
              lastName: student.lastName,
              firstName: student.firstName,
              lastNameKana: student.lastNameKana,
              firstNameKana: student.firstNameKana,
            },
          }))}
          onEditMembership={onEditMembership}
          onEndMembership={onEndMembership}
          showActions={true}
        />
      </CardContent>
    </Card>
  )
}
