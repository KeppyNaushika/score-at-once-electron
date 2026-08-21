"use client"

import type { SelectableStudent } from "@/components/common/student-add-panel/types"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

interface StudentCandidateCardProps {
  student: SelectableStudent
  onSelectionChange: (studentId: string, isSelected: boolean) => void
}

/**
 * 「個別で追加」タブに並ぶ生徒1件。
 *
 * 絞り込みに一致する上段と、絞り込みから外れた選択済みの下段の両方で同じ姿を出すので、
 * 1つにまとめてある（見た目が食い違うと、下段が別物に見えて外し忘れる）。
 */
export function StudentCandidateCard({
  student,
  onSelectionChange,
}: StudentCandidateCardProps) {
  const checkboxId = `add-student-${student.id}`
  return (
    <Card className="p-3">
      <div className="flex items-center space-x-3">
        <Checkbox
          id={checkboxId}
          checked={student.isSelected}
          onCheckedChange={(checked) =>
            onSelectionChange(student.id, checked === true)
          }
        />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <label htmlFor={checkboxId} className="cursor-pointer">
              <div className="font-medium">
                {student.lastName} {student.firstName}
              </div>
              <div className="text-sm text-muted-foreground">
                {student.studentNumber}
              </div>
            </label>
            <div className="text-right">
              <div className="text-sm font-medium">
                {student.memberships[0]?.classroom.name || "未所属"}
              </div>
              {student.memberships[0]?.attendanceNumber != null && (
                <div className="text-xs text-muted-foreground">
                  出席番号: {student.memberships[0].attendanceNumber}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
