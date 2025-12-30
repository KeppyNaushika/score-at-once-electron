"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Clock, Edit, Users } from "lucide-react"

const formatDate = (date: Date) => {
  return new Date(date)
    .toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\//g, "/")
}

interface Membership {
  id: string
  studentId: string
  classId: string
  startDate: Date
  endDate?: Date | null
  attendanceNumber?: number | null
  notes?: string | null
  student: {
    id: string
    studentId: string
    lastName: string
    firstName: string
    lastNameKana: string
    firstNameKana: string
  }
  class: {
    id: string
    name: string
    classCode?: string | null
    isVisible?: boolean
  }
}

interface StudentMembershipTimelineProps {
  memberships: Membership[]
  onEditMembership: (membership: Membership) => void
  onEndMembership: (membershipId: string) => void
  showActions?: boolean
}

export default function StudentMembershipTimeline({
  memberships,
  onEditMembership,
  onEndMembership,
  showActions = true,
}: StudentMembershipTimelineProps) {
  const sortedMemberships = [...memberships].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  )

  if (memberships.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-8 text-center">
          学級所属履歴がありません
        </CardContent>
      </Card>
    )
  }

  // 現在所属中かどうかを判定するヘルパー関数
  const isCurrentMembership = (m: { endDate?: Date | null }) => {
    if (!m.endDate) return true
    return new Date(m.endDate) >= new Date()
  }

  return (
    <div className="space-y-4">
      {sortedMemberships.map((membership, index) => {
        const isActive = isCurrentMembership(membership)
        const duration = membership.endDate
          ? `${formatDate(new Date(membership.startDate))} - ${formatDate(new Date(membership.endDate))}`
          : `${formatDate(new Date(membership.startDate))} - 現在`

        return (
          <Card
            key={membership.id}
            className={`relative ${isActive ? "ring-2 ring-blue-500" : ""}`}
          >
            {isActive && (
              <div className="absolute -top-2 -right-2">
                <Badge variant="default" className="bg-blue-500">
                  所属中
                </Badge>
              </div>
            )}

            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  {membership.class.name}
                </CardTitle>
                {showActions && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditMembership(membership)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEndMembership(membership.id)}
                      >
                        <Clock className="mr-1 h-4 w-4" />
                        所属終了
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                {duration}
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="mb-3 flex flex-wrap gap-2">
                {membership.attendanceNumber && (
                  <Badge variant="secondary">
                    出席番号: {membership.attendanceNumber}
                  </Badge>
                )}
              </div>

              {membership.notes && (
                <div className="text-muted-foreground rounded bg-gray-50 p-2 text-sm">
                  {membership.notes}
                </div>
              )}
            </CardContent>

            {/* タイムライン接続線 */}
            {index < sortedMemberships.length - 1 && (
              <div className="absolute -bottom-4 left-1/2 h-4 w-0.5 -translate-x-1/2 transform bg-gray-300"></div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
