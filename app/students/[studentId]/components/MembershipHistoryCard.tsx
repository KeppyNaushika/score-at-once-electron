"use client"

import { Clock } from "lucide-react"

import StudentMembershipTimeline from "@/components/student/StudentMembershipTimeline"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type {
  StudentClassMembershipWithDetails,
  StudentWithMemberships,
} from "@/types/prismaExtensions"

interface MembershipHistoryCardProps {
  student: StudentWithMemberships
  onEditMembership: (membership: StudentClassMembershipWithDetails) => void
  onEndMembership: (membershipId: string) => void
}

export function MembershipHistoryCard({
  student,
  onEditMembership,
  onEndMembership,
}: MembershipHistoryCardProps) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          所属履歴
        </CardTitle>
      </CardHeader>
      <CardContent>
        <StudentMembershipTimeline
          memberships={student.memberships.map(
            (m) =>
              ({
                ...m,
                student,
              }) as StudentClassMembershipWithDetails
          )}
          onEditMembership={onEditMembership}
          onEndMembership={onEndMembership}
          showActions={true}
        />
      </CardContent>
    </Card>
  )
}
