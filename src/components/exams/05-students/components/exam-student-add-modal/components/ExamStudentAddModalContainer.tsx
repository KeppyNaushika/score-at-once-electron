"use client"

import { useMemo } from "react"

import { StudentAddPanel } from "@/components/common/student-add-panel/components/StudentAddPanel"
import type {
  AddPanelClassItem,
  AddPanelStudentItem,
  StudentAddPanelAdapter,
} from "@/components/common/student-add-panel/types/studentAddPanelTypes"
import type { ExamStudentAddModalProps } from "@/components/exams/05-students/components/exam-student-add-modal/types/examStudentAddTypes"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * 試験への生徒追加モーダル
 *
 * 共通 StudentAddPanel を試験用 adapter で駆動する。学級追加はサーバ集約の
 * examClass.addStudentsFromClass（ExamClass作成＋customOrder連番）に委譲する。
 */
export function ExamStudentAddModalContainer({
  isOpen,
  onClose,
  examId,
  onStudentsAdded,
}: ExamStudentAddModalProps) {
  const adapter = useMemo<StudentAddPanelAdapter>(
    () => ({
      fetchAvailableClasses: async (activeOnly) => {
        const result = await window.electronAPI.getClassesNotInExam(
          examId,
          activeOnly
        )
        if (!result.success || !result.classes) return []
        return result.classes.map((classroom): AddPanelClassItem => ({
          id: classroom.id,
          name: classroom.name,
          studentCount: classroom.studentCount,
          studentNames: classroom.studentNames,
        }))
      },
      fetchAvailableStudents: async (activeOnly) => {
        const result = await window.electronAPI.getStudentsNotInExam(
          examId,
          activeOnly
        )
        if (!result.success || !result.students) return []
        return result.students.map((student): AddPanelStudentItem => ({
          id: student.id,
          studentNumber: student.studentNumber,
          lastName: student.lastName,
          firstName: student.firstName,
          lastNameKana: student.lastNameKana,
          firstNameKana: student.firstNameKana,
          memberships: student.memberships.map((membership) => ({
            attendanceNumber: membership.attendanceNumber,
            classroom: {
              id: membership.classroom.id,
              name: membership.classroom.name,
            },
          })),
        }))
      },
      addClasses: async (orderedClassIds, activeOnly) => {
        // 選択順に逐次追加（サーバが customOrder を末尾連番で付与）
        for (const classroomId of orderedClassIds) {
          const result =
            await window.electronAPI.examClass.addStudentsFromClass(
              examId,
              classroomId,
              activeOnly
            )
          if (!result) {
            throw new Error(`学級 ${classroomId} の追加に失敗しました`)
          }
        }
      },
      addStudents: async (studentIds) => {
        const result = await window.electronAPI.addStudentsToExam(
          examId,
          studentIds
        )
        if (!result.success) {
          throw new Error(result.error || "生徒の追加に失敗しました")
        }

        // 既存生徒の末尾に customOrder を付与
        const existing = await window.electronAPI.getStudentsForExam(examId)
        let startOrder = 0
        if (existing.success && existing.students) {
          const others = existing.students.filter(
            (student) => !studentIds.includes(student.id)
          )
          const maxOrder = others.reduce(
            (max, student) =>
              student.customOrder != null
                ? Math.max(max, student.customOrder)
                : max,
            -1
          )
          startOrder = maxOrder + 1
        }
        const studentOrders = studentIds.map((studentId, index) => ({
          studentId,
          customOrder: startOrder + index,
        }))
        await window.electronAPI.updateStudentOrders(examId, studentOrders)
      },
    }),
    [examId]
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex h-[85vh] w-[92vw] max-w-5xl flex-col overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>受験生徒の追加</DialogTitle>
          <DialogDescription>
            学級単位での一括追加、または個別生徒の選択追加が可能です。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden">
          <StudentAddPanel
            adapter={adapter}
            onAdded={onStudentsAdded}
            fillHeight
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            閉じる
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
