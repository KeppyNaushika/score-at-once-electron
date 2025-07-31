"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Student } from "@/components/projects/05-students/components/project-students-page/types/project-students-types"

interface StudentStatisticsCardsProps {
  students: Student[]
}

export function StudentStatisticsCards({
  students,
}: StudentStatisticsCardsProps) {
  const totalStudents = students.length
  const participatingStudents = students.filter(
    (s) => s.status === "participating",
  ).length
  const expectedStudents = students.filter(
    (s) => s.status === "expected",
  ).length
  const absentStudents = students.filter((s) => s.status === "absent").length

  return (
    <div className="mb-6 grid flex-shrink-0 grid-cols-2 gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">
            総生徒数
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalStudents}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">
            受験者
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {participatingStudents}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">
            欠席者
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {absentStudents}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">
            見込受験
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {expectedStudents}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
