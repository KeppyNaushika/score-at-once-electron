"use client"

import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import type { StudentWithMemberships } from "@/types/prismaExtensions"

interface StudentInfoCardProps {
  student: StudentWithMemberships
}

export function StudentInfoCard({ student }: StudentInfoCardProps) {
  return (
    <Card className="border-border/50 mb-8 shadow-sm">
      <CardHeader>
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
                {student.studentNumber}
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
      </CardHeader>
    </Card>
  )
}
