"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
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
import {
  buildGradeExclusionKey,
  type GradeItemExclusionRow,
  gradeItemExclusionsQuery,
  type GradeStudentRow,
  setGradeItemExclusionMutation,
} from "@/queries/grade"
import type { GradeItemWithDataSources } from "@/types/grade.types"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_EXCLUSIONS: GradeItemExclusionRow[] = []

interface StudentExclusionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gradeId: string
  gradeItems: GradeItemWithDataSources[]
  students: GradeStudentRow[]
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
  const { data: exclusions = EMPTY_EXCLUSIONS, isPending: loading } = useQuery(
    gradeItemExclusionsQuery(gradeId)
  )
  // 引きやすい形へ畳むのは表示側の計算。取得は行のまま持つ
  const exclusionSet = useMemo(
    () => new Set(exclusions.map(buildGradeExclusionKey)),
    [exclusions]
  )
  const setExclusion = useMutation(setGradeItemExclusionMutation(gradeId))

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
          <div className="py-8 text-center text-sm text-muted-foreground">
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
                        const target = {
                          gradeStudentId: gradeStudent.id,
                          gradeItemId: gradeItem.id,
                        }
                        const excluded = exclusionSet.has(
                          buildGradeExclusionKey(target)
                        )
                        return (
                          <TableCell key={gradeItem.id} className="text-center">
                            <Checkbox
                              checked={!excluded}
                              onCheckedChange={() =>
                                setExclusion.mutate({
                                  target,
                                  excluded: !excluded,
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
          <p className="text-xs text-muted-foreground">
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
