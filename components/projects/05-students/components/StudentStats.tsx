"use client"

import type { Student } from "@/components/projects/05-students/types"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface StudentStatsProps {
  filteredStudents: Student[]
}

export const StudentStats = ({ filteredStudents }: StudentStatsProps) => {
  const stats = {
    total: filteredStudents.length,
    participating: filteredStudents.filter((s) => s.status === "participating")
      .length,
    expected: filteredStudents.filter((s) => s.status === "expected").length,
    absent: filteredStudents.filter((s) => s.status === "absent").length,
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>受験生徒統計</CardTitle>
        <CardDescription>現在の表示対象の統計情報</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50">
            全体: {stats.total}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-800">
            受験: {stats.participating}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">見込: {stats.expected}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="bg-red-100 text-red-800">
            欠席: {stats.absent}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
