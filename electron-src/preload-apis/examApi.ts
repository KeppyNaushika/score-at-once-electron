import type { Prisma } from "@prisma/client"

import type { CreateExamArgs } from "../../src/types/prismaExtensions"
import { bind, invoke } from "./invoke"

/** 試験管理のIPC API（CRUD・模範解答・受験生徒管理・学級連携） */
export function createExamApi() {
  return {
    fetchExamsSummary: bind("fetch-exams-summary"),
    fetchExamById: bind("fetch-exam-by-id"),
    getExam: bind("get-exam"),
    getExamWithPages: bind("get-exam-with-pages"),
    createExam: (props: CreateExamArgs, userId: string) => {
      return invoke("create-exam", props, userId)
    },
    updateExam: (examId: string, data: Prisma.ExamUpdateInput) => {
      return invoke("update-exam", examId, data)
    },
    deleteExam: bind("delete-exam"),

    // 模範解答ページ（ExamPage）。id はすべて ExamPage.id
    uploadMasterAnswers: bind("upload-master-answers"),
    replaceMasterAnswerImage: bind("replace-master-answer-image"),
    deleteMasterAnswer: bind("delete-master-answer"),
    moveExamPage: bind("move-exam-page"),
    updateExamPagePageSize: bind("update-exam-page-page-size"),
    getMasterImagesByExamId: bind("get-master-images-by-exam-id"),
    getExamPagesByExamId: bind("get-exam-pages-by-exam-id"),
    getStudentAnswerImagesByExamId: bind(
      "get-student-answer-images-by-exam-id"
    ),

    // Exam-Student relationship
    getStudentsForExam: bind("get-students-for-exam"),
    addStudentsToExam: bind("add-students-to-exam"),
    removeStudentsFromExam: bind("remove-students-from-exam"),
    updateStudentExamStatus: bind("update-student-exam-status"),
    checkGradingDataForStudents: bind("check-grading-data-for-students"),
    getClassroomsNotInExam: bind("get-classrooms-not-in-exam"),
    getStudentsNotInExam: bind("get-students-not-in-exam"),
    updateStudentOrders: bind("update-student-orders"),
  }
}
