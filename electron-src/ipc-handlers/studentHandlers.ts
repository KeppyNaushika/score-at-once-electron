import type { Prisma } from "@prisma/client"
import { dialog } from "electron"
import * as ExcelJS from "exceljs"

import type { ExamStudentStatus } from "@/types/examStudentStatus.types"

import { fetchClassrooms } from "../lib/prisma/classroom"
import {
  addStudentsToExam,
  getClassroomsNotInExam,
  getStudentsForExam,
  getStudentsNotInExam,
  removeStudentsFromExam,
  updateStudentExamStatus,
  updateStudentOrders,
} from "../lib/prisma/examStudent"
import { checkGradingDataForStudents } from "../lib/prisma/gradingData"
import {
  createStudent,
  deleteStudent,
  fetchStudents,
  getClassroomExamResults,
  getStudentExamResults,
  updateStudent,
} from "../lib/prisma/student"
import {
  addStudentToClassroom,
  deleteStudentClassroomMembership,
  endStudentMembership,
  updateStudentClassroomMembership,
} from "../lib/prisma/studentClassroomMembership"
import {
  applyCellStyle,
  autoFitColumns,
} from "../lib/shared/utilities/excelUtilities"
import { type HandlerMap } from "./ipcHandlerUtils"

/** 生徒CRUD・学級所属・試験生徒関連・Excelエクスポートに関するIPCチャンネルを登録する */
export const studentHandlers = {
  "fetch-students": async () => {
    return await fetchStudents()
  },

  "create-student": async (studentData: Prisma.StudentCreateInput) => {
    return await createStudent(studentData)
  },

  "update-student": async (
    id: string,
    studentData: Prisma.StudentUpdateInput
  ) => {
    return await updateStudent(id, studentData)
  },

  "delete-student": async (id: string) => {
    return await deleteStudent(id)
  },

  // Student Classroom Membership handlers
  "update-student-class-membership": async (
    id: string,
    membershipData: Prisma.StudentClassroomMembershipUpdateInput
  ) => {
    return await updateStudentClassroomMembership(id, membershipData)
  },

  "delete-student-class-membership": async (id: string) => {
    return await deleteStudentClassroomMembership(id)
  },

  "add-student-to-class": async (
    studentId: string,
    classroomId: string,
    startDate?: Date,
    attendanceNumber?: number,
    notes?: string
  ) => {
    const dateToUse = startDate ? new Date(startDate) : new Date()

    const result = await addStudentToClassroom(
      studentId,
      classroomId,
      dateToUse,
      attendanceNumber,
      notes
    )
    return result
  },

  "end-student-membership": async (membershipId: string, endDate?: Date) => {
    return await endStudentMembership(membershipId, endDate)
  },

  // Exam-Student relationship handlers
  "get-students-for-exam": async (examId: string) => {
    return await getStudentsForExam(examId)
  },

  "add-students-to-exam": async (examId: string, studentIds: string[]) => {
    return await addStudentsToExam(examId, studentIds)
  },

  "remove-students-from-exam": async (examId: string, studentIds: string[]) => {
    return await removeStudentsFromExam(examId, studentIds)
  },

  "update-student-exam-status": async (
    examId: string,
    studentId: string,
    status: ExamStudentStatus
  ) => {
    return await updateStudentExamStatus(examId, studentId, status)
  },

  "get-classrooms-not-in-exam": async (
    examId: string,
    activeOnly: boolean = true
  ) => {
    return await getClassroomsNotInExam(examId, activeOnly)
  },

  "get-students-not-in-exam": async (
    examId: string,
    activeOnly: boolean = true
  ) => {
    return await getStudentsNotInExam(examId, activeOnly)
  },

  "check-grading-data-for-students": (examId: string, studentIds: string[]) =>
    checkGradingDataForStudents(examId, studentIds),

  "update-student-orders": async (
    examId: string,
    studentOrders: { studentId: string; customOrder: number }[]
  ) => {
    return await updateStudentOrders(examId, studentOrders)
  },

  "get-student-exam-results": async (studentId: string) => {
    return await getStudentExamResults(studentId)
  },

  "get-class-exam-results": async (classroomId: string) => {
    return await getClassroomExamResults(classroomId)
  },

  // 生徒データExcelエクスポート（選択された生徒のみ）
  "export-students-excel": async (selectedStudentIds: string[]) => {
    const allStudents = await fetchStudents()
    const selectedSet = new Set(selectedStudentIds)
    const students = allStudents.filter((student) =>
      selectedSet.has(student.id)
    )

    if (students.length === 0) {
      throw new Error("出力する生徒が選択されていません")
    }

    const dateStr = new Date().toISOString().slice(0, 10)
    const result = await dialog.showSaveDialog({
      title: "生徒一覧のExcel出力先を選択",
      defaultPath: `生徒一覧_${dateStr}.xlsx`,
      filters: [{ name: "Excelファイル", extensions: ["xlsx"] }],
    })

    // キャンセルは失敗ではないので値で返す
    if (result.canceled || !result.filePath) {
      return { canceled: true as const }
    }

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("生徒一覧")

    // ヘッダー行（インポートと同じカラム・順序）
    const headerRow = worksheet.addRow([
      "学籍番号",
      "姓",
      "名",
      "姓カナ",
      "名カナ",
      "入学年度",
    ])
    headerRow.eachCell((cell) => applyCellStyle(cell, "header"))

    // データ行（学籍番号順）
    const sorted = [...students].sort((studentA, studentB) =>
      studentA.studentNumber.localeCompare(studentB.studentNumber, "ja")
    )

    for (const student of sorted) {
      const row = worksheet.addRow([
        student.studentNumber,
        student.lastName,
        student.firstName,
        student.lastNameKana,
        student.firstNameKana,
        student.enrollmentYear ?? "",
      ])
      row.eachCell((cell) => applyCellStyle(cell, "data"))
    }

    autoFitColumns(worksheet)
    await workbook.xlsx.writeFile(result.filePath)

    return { canceled: false as const, outputPath: result.filePath }
  },

  // 学級データExcelエクスポート（選択された学級の所属データ）
  "export-classrooms-excel": async (selectedClassroomIds: string[]) => {
    const allClassrooms = await fetchClassrooms()
    const selectedSet = new Set(selectedClassroomIds)
    const classrooms = allClassrooms.filter((classroom) =>
      selectedSet.has(classroom.id)
    )

    if (classrooms.length === 0) {
      throw new Error("出力する学級が選択されていません")
    }

    const dateStr = new Date().toISOString().slice(0, 10)
    const result = await dialog.showSaveDialog({
      title: "学級データのExcel出力先を選択",
      defaultPath: `学級データ_${dateStr}.xlsx`,
      filters: [{ name: "Excelファイル", extensions: ["xlsx"] }],
    })

    // キャンセルは失敗ではないので値で返す
    if (result.canceled || !result.filePath) {
      return { canceled: true as const }
    }

    // 全生徒を取得（学籍番号逆引き用）
    const allStudents = await fetchStudents()
    const studentMap = new Map(
      allStudents.map((student) => [student.id, student])
    )

    const workbook = new ExcelJS.Workbook()

    // 学級ごとにシートを作成
    for (const classroom of classrooms) {
      const sheetName = classroom.name
        .replace(/[\\/:*?"<>|]/g, "_")
        .slice(0, 31)
      const worksheet = workbook.addWorksheet(sheetName)

      // ヘッダー行（学級インポートと同じカラム・順序）
      const headerRow = worksheet.addRow([
        "学籍番号",
        "出席番号",
        "開始日",
        "終了日",
      ])
      headerRow.eachCell((cell) => applyCellStyle(cell, "header"))

      // 所属データ（出席番号順）
      const sortedMemberships = [...classroom.memberships].sort(
        (membershipA, membershipB) => {
          const numberA = membershipA.attendanceNumber ?? Infinity
          const numberB = membershipB.attendanceNumber ?? Infinity
          return numberA - numberB
        }
      )

      for (const membership of sortedMemberships) {
        const student = studentMap.get(membership.student.id)
        const studentNumber = student?.studentNumber ?? membership.student.id
        const row = worksheet.addRow([
          studentNumber,
          membership.attendanceNumber ?? "",
          membership.startDate
            ? new Date(membership.startDate).toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "numeric",
                day: "numeric",
              })
            : "",
          membership.endDate
            ? new Date(membership.endDate).toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "numeric",
                day: "numeric",
              })
            : "",
        ])
        row.eachCell((cell) => applyCellStyle(cell, "data"))
      }

      autoFitColumns(worksheet)
    }

    await workbook.xlsx.writeFile(result.filePath)

    return { canceled: false as const, outputPath: result.filePath }
  },
} satisfies HandlerMap
