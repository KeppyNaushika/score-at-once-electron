"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"

import { StudentAddPanel } from "@/components/common/student-add-panel/components/StudentAddPanel"
import type {
  AddPanelClassroomItem,
  StudentAddPanelAdapter,
} from "@/components/common/student-add-panel/types"
import type { ExamStudentAddModalProps } from "@/components/exams/05-students/components/exam-student-add-modal/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  addStudentsToExamMutation,
  classroomsNotInExamQuery,
  examStudentsQuery,
  studentsNotInExamQuery,
  updateExamStudentOrdersMutation,
} from "@/queries/exam"
import { addStudentsFromClassroomToExamMutation } from "@/queries/examClassroom"

/**
 * 試験への生徒追加モーダル
 *
 * 共通 StudentAddPanel を試験用 adapter で駆動する。学級追加はサーバ集約の
 * examClassroom.addStudentsFromClassroom（ExamClassroom作成＋customOrder連番）に委譲する。
 */
export function ExamStudentAddModalContainer({
  isOpen,
  onClose,
  examId,
  onStudentsAdded,
}: ExamStudentAddModalProps) {
  const queryClient = useQueryClient()
  const addStudentsFromClassroom = useMutation(
    addStudentsFromClassroomToExamMutation(examId)
  )
  const addStudentsToExam = useMutation(addStudentsToExamMutation(examId))
  const updateExamStudentOrders = useMutation(
    updateExamStudentOrdersMutation(examId)
  )

  const adapter = useMemo<StudentAddPanelAdapter>(
    () => ({
      scopeId: examId,
      fetchAvailableClassrooms: async (activeOnly) => {
        const classrooms = await queryClient.fetchQuery(
          classroomsNotInExamQuery(examId, activeOnly)
        )
        return classrooms.map((classroom): AddPanelClassroomItem => ({
          id: classroom.id,
          name: classroom.name,
          studentCount: classroom.studentCount,
          studentNames: classroom.studentNames,
        }))
      },
      fetchAvailableStudents: async (activeOnly) =>
        // 候補は境界が返す行（Student＋所属＋学級）をそのまま渡す
        queryClient.fetchQuery(studentsNotInExamQuery(examId, activeOnly)),
      addClassrooms: async (orderedClassroomIds, activeOnly) => {
        // 選択順に逐次追加（サーバが customOrder を末尾連番で付与）
        for (const classroomId of orderedClassroomIds) {
          await addStudentsFromClassroom.mutateAsync({
            classroomId,
            activeOnly,
          })
        }
      },
      addStudents: async (studentIds) => {
        await addStudentsToExam.mutateAsync(studentIds)

        // 既存生徒の末尾に customOrder を付与
        const existing = await queryClient.fetchQuery(examStudentsQuery(examId))
        const others = existing.filter(
          (examStudent) => !studentIds.includes(examStudent.studentId)
        )
        const maxOrder = others.reduce(
          (max, examStudent) =>
            examStudent.customOrder != null
              ? Math.max(max, examStudent.customOrder)
              : max,
          -1
        )
        const startOrder = maxOrder + 1
        const studentOrders = studentIds.map((studentId, index) => ({
          studentId,
          customOrder: startOrder + index,
        }))
        await updateExamStudentOrders.mutateAsync(studentOrders)
      },
    }),
    [
      examId,
      queryClient,
      addStudentsFromClassroom,
      addStudentsToExam,
      updateExamStudentOrders,
    ]
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
