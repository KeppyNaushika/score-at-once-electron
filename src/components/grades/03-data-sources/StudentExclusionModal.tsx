"use client"

import { Users } from "lucide-react"
import { useMemo } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useGradeItemExclusions } from "@/hooks/grades/useGradeItemExclusions"
import type { GradeItemWithDetails } from "@/types/grade.types"

interface StudentData {
  id: string
  gradeId: string
  studentId: string
  customOrder: number | null
  student: {
    id: string
    studentNumber: string
    lastName: string
    firstName: string
    memberships: Array<{
      classroomId: string
      attendanceNumber: number | null
      classroom: { id: string; name: string }
    }>
  }
}

interface StudentExclusionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gradeId: string
  gradeItems: GradeItemWithDetails[]
  students: StudentData[]
  classIds: string[]
}

export function StudentExclusionModal({
  open,
  onOpenChange,
  gradeId,
  gradeItems,
  students,
  classIds,
}: StudentExclusionModalProps) {
  const { exclusionSet, loading, isExcluded, toggleExclusion } =
    useGradeItemExclusions(gradeId)

  const classIdSet = useMemo(() => new Set(classIds), [classIds])

  const exclusionCount = exclusionSet.size

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            対象生徒設定
            {exclusionCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {exclusionCount}件除外中
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-muted-foreground">読み込み中...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            対象生徒がいません。
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-white">
                    生徒
                  </TableHead>
                  {gradeItems.map((gi) => (
                    <TableHead key={gi.id} className="text-center">
                      <div className="text-xs">{gi.name}</div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((ps) => {
                  const membership = ps.student.memberships.find((m) =>
                    classIdSet.has(m.classroomId)
                  )
                  return (
                    <TableRow key={ps.studentId}>
                      <TableCell className="sticky left-0 z-10 bg-white">
                        <div className="flex items-center gap-2 text-sm whitespace-nowrap">
                          {membership && (
                            <span className="text-muted-foreground">
                              {membership.classroom.name}
                            </span>
                          )}
                          <span className="text-muted-foreground tabular-nums">
                            {membership?.attendanceNumber ?? "-"}
                          </span>
                          <span>
                            {ps.student.lastName} {ps.student.firstName}
                          </span>
                        </div>
                      </TableCell>
                      {gradeItems.map((gi) => {
                        const excluded = isExcluded(ps.studentId, gi.id)
                        return (
                          <TableCell key={gi.id} className="text-center">
                            <Checkbox
                              checked={!excluded}
                              onCheckedChange={() =>
                                toggleExclusion(ps.studentId, gi.id)
                              }
                            />
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-muted-foreground text-xs">
            チェック = 含む（デフォルト）、チェックなし = 除外
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            閉じる
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
