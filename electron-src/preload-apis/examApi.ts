import type { Prisma } from "@prisma/client"
import { ipcRenderer } from "electron"

import type { CreateExamArgs } from "../../src/types/electron/examApi"
import type { ExamStudentStatus } from "../../src/types/examStudentStatus.types"

/** 試験管理のIPC API（CRUD・模範解答・受験生徒管理・学級連携） */
export function createExamApi() {
  return {
    fetchExamsSummary: (userId: string) =>
      ipcRenderer.invoke("fetch-exams-summary", userId),
    fetchExamById: (examId: string) =>
      ipcRenderer.invoke("fetch-exam-by-id", examId),
    getExam: (examId: string) => ipcRenderer.invoke("get-exam", examId),
    getExamWithPages: (examId: string) =>
      ipcRenderer.invoke("get-exam-with-pages", examId),
    createExam: (props: CreateExamArgs, userId: string) => {
      return ipcRenderer.invoke("create-exam", props, userId)
    },
    updateExam: (examId: string, data: Prisma.ExamUpdateInput) => {
      return ipcRenderer.invoke("update-exam", examId, data)
    },
    deleteExam: (
      examId: string // exam オブジェクトではなく examId を直接渡す
    ) => ipcRenderer.invoke("delete-exam", examId),

    // 模範解答ページ（ExamPage）。id はすべて ExamPage.id
    uploadMasterAnswers: (
      examId: string,
      filesData: { name: string; type: string; buffer: ArrayBuffer }[]
    ) => ipcRenderer.invoke("upload-master-answers", examId, filesData),
    replaceMasterAnswerImage: (
      examPageId: string,
      fileData: { name: string; type: string; buffer: ArrayBuffer }
    ) =>
      ipcRenderer.invoke("replace-master-answer-image", examPageId, fileData),
    deleteMasterAnswer: (examPageId: string) =>
      ipcRenderer.invoke("delete-master-answer", examPageId),
    updateMasterAnswersOrder: (
      pageOrders: { id: string; pageNumber: number }[]
    ) => ipcRenderer.invoke("update-master-answers-order", pageOrders),
    updateExamPagePageSize: (examPageId: string, pageSize: string) =>
      ipcRenderer.invoke("update-exam-page-page-size", examPageId, pageSize),
    getMasterImagesByExamId: (examId: string) =>
      ipcRenderer.invoke("get-master-images-by-exam-id", examId),
    getExamPagesByExamId: (examId: string) =>
      ipcRenderer.invoke("get-exam-pages-by-exam-id", examId),
    getStudentAnswerImagesByExamId: (examId: string) =>
      ipcRenderer.invoke("get-student-answer-images-by-exam-id", examId),

    // Exam-Student relationship
    getStudentsForExam: (examId: string) =>
      ipcRenderer.invoke("get-students-for-exam", examId),
    addStudentsToExam: (examId: string, studentIds: string[]) =>
      ipcRenderer.invoke("add-students-to-exam", examId, studentIds),
    removeStudentsFromExam: (examId: string, studentIds: string[]) =>
      ipcRenderer.invoke("remove-students-from-exam", examId, studentIds),
    updateStudentExamStatus: (
      examId: string,
      studentId: string,
      status: ExamStudentStatus
    ) =>
      ipcRenderer.invoke(
        "update-student-exam-status",
        examId,
        studentId,
        status
      ),
    checkGradingDataForStudents: (examId: string, studentIds: string[]) =>
      ipcRenderer.invoke("check-grading-data-for-students", examId, studentIds),
    getClassroomsNotInExam: (examId: string, activeOnly?: boolean) =>
      ipcRenderer.invoke("get-classrooms-not-in-exam", examId, activeOnly),
    getStudentsNotInExam: (examId: string, activeOnly?: boolean) =>
      ipcRenderer.invoke("get-students-not-in-exam", examId, activeOnly),
    updateStudentOrders: (
      examId: string,
      studentOrders: { studentId: string; customOrder: number }[]
    ) => ipcRenderer.invoke("update-student-orders", examId, studentOrders),
  }
}
