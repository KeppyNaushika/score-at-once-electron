"use client"

import { StudentWithMemberships } from "@/app/students/[studentId]/types"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Edit, Trash2 } from "lucide-react"

interface StudentInfoCardProps {
  student: StudentWithMemberships
  onEditStudent: () => void
  onDeleteStudent: () => void
}

export function StudentInfoCard({
  student,
  onEditStudent,
  onDeleteStudent,
}: StudentInfoCardProps) {
  return (
    <Card className="border-border/50 mb-8 shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {student.lastName} {student.firstName}
              <span className="text-muted-foreground ml-4 text-lg font-normal">
                {student.lastNameKana} {student.firstNameKana}
              </span>
            </CardTitle>
            <div className="mt-3 space-y-1.5">
              <p className="text-muted-foreground flex items-center gap-2">
                <span>学籍番号</span>
                <span className="bg-muted/50 rounded-lg px-2.5 py-1 font-mono text-sm">
                  {student.studentId}
                </span>
              </p>
              {student.enrollmentYear && (
                <p className="text-muted-foreground flex items-center gap-2">
                  <span>入学年度</span>
                  <span className="bg-muted/50 rounded-lg px-2.5 py-1 text-sm tabular-nums">
                    {student.enrollmentYear}年
                  </span>
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2.5">
            <Button
              onClick={onEditStudent}
              variant="outline"
              className="h-9 rounded-lg"
            >
              <Edit className="mr-2 h-4 w-4" />
              編集
            </Button>
            <Button
              onClick={onDeleteStudent}
              variant="ghost"
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-9 rounded-lg transition-colors"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              削除
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}
