import { Prisma } from "@prisma/client"
import { ipcRenderer } from "electron"

import { CreateExamArgs } from "../../src/types/electron/examApi"

/** 試験管理のIPC API（CRUD・模範解答・受験生徒管理・学級連携） */
export function createExamApi() {
  return {
    fetchExams: (userId: string) => ipcRenderer.invoke("fetch-exams", userId),
    fetchExamsSummary: (userId: string) =>
      ipcRenderer.invoke("fetch-exams-summary", userId),
    fetchExamById: (examId: string) =>
      ipcRenderer.invoke("fetch-exam-by-id", examId),
    createExam: (props: CreateExamArgs, userId: string) => {
      return ipcRenderer.invoke("create-exam", props, userId)
    },
    updateExam: (examId: string, data: Prisma.ExamUpdateInput) => {
      return ipcRenderer.invoke("update-exam", examId, data)
    },
    deleteExam: (
      examId: string // exam オブジェクトではなく examId を直接渡す
    ) => ipcRenderer.invoke("delete-exam", examId),

    // MasterAnswer related
    uploadMasterAnswers: (
      examId: string,
      filesData: { name: string; type: string; buffer: ArrayBuffer }[]
    ) => ipcRenderer.invoke("upload-master-answers", examId, filesData),
    deleteMasterAnswer: (answerId: string) =>
      ipcRenderer.invoke("delete-master-answer", answerId),
    updateMasterAnswersOrder: (
      answerOrders: { id: string; pageNumber: number }[]
    ) => ipcRenderer.invoke("update-master-answers-order", answerOrders),
    updateMasterImagePageSize: (id: string, pageSize: string) =>
      ipcRenderer.invoke("update-master-image-page-size", id, pageSize),
    getMasterImagesByExamId: (examId: string) =>
      ipcRenderer.invoke("get-master-images-by-exam-id", examId),
    getExamPagesByExamId: (examId: string) =>
      ipcRenderer.invoke("get-exam-pages-by-exam-id", examId),

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
      status: "participating" | "expected" | "absent"
    ) =>
      ipcRenderer.invoke(
        "update-student-exam-status",
        examId,
        studentId,
        status
      ),
    checkGradingDataForStudents: (examId: string, studentIds: string[]) =>
      ipcRenderer.invoke("check-grading-data-for-students", examId, studentIds),
    getClassesNotInExam: (examId: string) =>
      ipcRenderer.invoke("get-classes-not-in-exam", examId),
    getStudentsNotInExam: (examId: string) =>
      ipcRenderer.invoke("get-students-not-in-exam", examId),
    updateStudentOrders: (
      examId: string,
      studentOrders: { studentId: string; customOrder: number }[]
    ) => ipcRenderer.invoke("update-student-orders", examId, studentOrders),
  }
}
