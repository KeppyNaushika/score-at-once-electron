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
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-2xl">
              {student.lastName} {student.firstName}
              <span className="text-muted-foreground ml-4 text-lg">
                {student.lastNameKana} {student.firstNameKana}
              </span>
            </CardTitle>
            <div className="mt-2 space-y-1">
              <p className="text-muted-foreground">
                学籍番号: <span className="font-mono">{student.studentId}</span>
              </p>
              {student.enrollmentYear && (
                <p className="text-muted-foreground">
                  入学年度: {student.enrollmentYear}年
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={onEditStudent} variant="outline" size="sm">
              <Edit className="mr-2 h-4 w-4" />
              編集
            </Button>
            <Button onClick={onDeleteStudent} variant="outline" size="sm">
              <Trash2 className="mr-2 h-4 w-4 text-red-500" />
              削除
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}
