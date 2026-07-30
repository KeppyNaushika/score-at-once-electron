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
import type { GradeItemWithDataSources } from "@/types/grade.types"

/** 成績の名簿1行。除外の書き込み先は人ではなく対象者（id）なので実体で受け取る */
interface ExclusionStudent {
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
  gradeItems: GradeItemWithDataSources[]
  students: ExclusionStudent[]
  classroomIds: string[]
}

export function StudentExclusionModal({
  open,
  onOpenChange,
  gradeId,
  gradeItems,
  students,
  classroomIds,
}: StudentExclusionModalProps) {
  const { exclusionSet, loading, isExcluded, toggleExclusion } =
    useGradeItemExclusions(gradeId)

  const classroomIdSet = useMemo(() => new Set(classroomIds), [classroomIds])

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
                  {gradeItems.map((gradeItem) => (
                    <TableHead key={gradeItem.id} className="text-center">
                      <div className="text-xs">{gradeItem.name}</div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((gradeStudent) => {
                  const membership = gradeStudent.student.memberships.find(
                    (candidate) => classroomIdSet.has(candidate.classroomId)
                  )
                  return (
                    <TableRow key={gradeStudent.id}>
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
                            {gradeStudent.student.lastName}{" "}
                            {gradeStudent.student.firstName}
                          </span>
                        </div>
                      </TableCell>
                      {gradeItems.map((gradeItem) => {
                        const excluded = isExcluded({
                          gradeStudentId: gradeStudent.id,
                          gradeItemId: gradeItem.id,
                        })
                        return (
                          <TableCell key={gradeItem.id} className="text-center">
                            <Checkbox
                              checked={!excluded}
                              onCheckedChange={() =>
                                toggleExclusion({
                                  gradeStudentId: gradeStudent.id,
                                  gradeItemId: gradeItem.id,
                                })
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
