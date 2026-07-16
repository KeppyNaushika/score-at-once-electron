"use client"

import { ExamStudentAddModalContainer } from "@/components/exams/05-students/components/exam-student-add-modal/components/ExamStudentAddModalContainer"
import type { ExamStudentAddModalProps } from "@/components/exams/05-students/components/exam-student-add-modal/types"

export default function ExamStudentAddModal(props: ExamStudentAddModalProps) {
  return <ExamStudentAddModalContainer {...props} />
}
