import type { Prisma } from "@prisma/client"

import type { CreateExamArgs } from "../../src/types/electron/examApi"
import type { ExamStudentStatus } from "../../src/types/examStudentStatus.types"
import { invoke } from "./invoke"

/** 試験管理のIPC API（CRUD・模範解答・受験生徒管理・学級連携） */
export function createExamApi() {
  return {
    fetchExamsSummary: (userId: string) =>
      invoke("fetch-exams-summary", userId),
    fetchExamById: (examId: string) => invoke("fetch-exam-by-id", examId),
    getExam: (examId: string) => invoke("get-exam", examId),
    getExamWithPages: (examId: string) => invoke("get-exam-with-pages", examId),
    createExam: (props: CreateExamArgs, userId: string) => {
      return invoke("create-exam", props, userId)
    },
    updateExam: (examId: string, data: Prisma.ExamUpdateInput) => {
      return invoke("update-exam", examId, data)
    },
    deleteExam: (
      examId: string // exam オブジェクトではなく examId を直接渡す
    ) => invoke("delete-exam", examId),

    // 模範解答ページ（ExamPage）。id はすべて ExamPage.id
    uploadMasterAnswers: (
      examId: string,
      filesData: { name: string; type: string; buffer: ArrayBuffer }[]
    ) => invoke("upload-master-answers", examId, filesData),
    replaceMasterAnswerImage: (
      examPageId: string,
      fileData: { name: string; type: string; buffer: ArrayBuffer }
    ) => invoke("replace-master-answer-image", examPageId, fileData),
    deleteMasterAnswer: (examPageId: string) =>
      invoke("delete-master-answer", examPageId),
    updateMasterAnswersOrder: (
      pageOrders: { id: string; pageNumber: number }[]
    ) => invoke("update-master-answers-order", pageOrders),
    updateExamPagePageSize: (examPageId: string, pageSize: string) =>
      invoke("update-exam-page-page-size", examPageId, pageSize),
    getMasterImagesByExamId: (examId: string) =>
      invoke("get-master-images-by-exam-id", examId),
    getExamPagesByExamId: (examId: string) =>
      invoke("get-exam-pages-by-exam-id", examId),
    getStudentAnswerImagesByExamId: (examId: string) =>
      invoke("get-student-answer-images-by-exam-id", examId),

    // Exam-Student relationship
    getStudentsForExam: (examId: string) =>
      invoke("get-students-for-exam", examId),
    addStudentsToExam: (examId: string, studentIds: string[]) =>
      invoke("add-students-to-exam", examId, studentIds),
    removeStudentsFromExam: (examId: string, studentIds: string[]) =>
      invoke("remove-students-from-exam", examId, studentIds),
    updateStudentExamStatus: (
      examId: string,
      studentId: string,
      status: ExamStudentStatus
    ) => invoke("update-student-exam-status", examId, studentId, status),
    checkGradingDataForStudents: (examId: string, studentIds: string[]) =>
      invoke("check-grading-data-for-students", examId, studentIds),
    getClassroomsNotInExam: (examId: string, activeOnly?: boolean) =>
      invoke("get-classrooms-not-in-exam", examId, activeOnly),
    getStudentsNotInExam: (examId: string, activeOnly?: boolean) =>
      invoke("get-students-not-in-exam", examId, activeOnly),
    updateStudentOrders: (
      examId: string,
      studentOrders: { studentId: string; customOrder: number }[]
    ) => invoke("update-student-orders", examId, studentOrders),
  }
}
