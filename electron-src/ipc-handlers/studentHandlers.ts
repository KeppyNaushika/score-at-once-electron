import { Prisma } from "@prisma/client"
import { dialog } from "electron"
import * as ExcelJS from "exceljs"

import type { StudentStatus } from "@/types/studentStatus.types"

import {
  addStudentsToExam,
  getClassesNotInExam,
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
  getStudentExamResults,
  updateStudent,
} from "../lib/prisma/student"
import {
  addStudentToClass,
  createStudentClassMembership,
  deleteStudentClassMembership,
  endStudentMembership,
  getAllMembershipsByStudentId,
  getCurrentMembershipsByClassId,
  getCurrentMembershipsByStudentId,
  getMembershipsByDateRange,
  updateStudentClassMembership,
} from "../lib/prisma/studentClassMembership"
import {
  applyCellStyle,
  autoFitColumns,
} from "../lib/shared/utilities/excelUtilities"
import { registerHandler, registerSafeHandler } from "./ipcHandlerUtils"

/** 生徒CRUD・学級所属・試験生徒関連・Excelエクスポートに関するIPCチャンネルを登録する */
export function setupStudentHandlers(): void {
  registerHandler("fetch-students", async () => {
    return await fetchStudents()
  })

  registerHandler(
    "create-student",
    async (studentData: Prisma.StudentCreateInput) => {
      return await createStudent(studentData)
    }
  )

  registerHandler(
    "update-student",
    async (id: string, studentData: Prisma.StudentUpdateInput) => {
      return await updateStudent(id, studentData)
    }
  )

  registerHandler("delete-student", async (id: string) => {
    return await deleteStudent(id)
  })

  // Student Class Membership handlers
  registerHandler(
    "create-student-class-membership",
    async (membershipData: Prisma.StudentClassroomMembershipCreateInput) => {
      return await createStudentClassMembership(membershipData)
    }
  )

  registerHandler(
    "update-student-class-membership",
    async (
      id: string,
      membershipData: Prisma.StudentClassroomMembershipUpdateInput
    ) => {
      return await updateStudentClassMembership(id, membershipData)
    }
  )

  registerHandler("delete-student-class-membership", async (id: string) => {
    return await deleteStudentClassMembership(id)
  })

  registerHandler(
    "get-current-memberships-by-student-id",
    async (studentId: string) => {
      return await getCurrentMembershipsByStudentId(studentId)
    }
  )

  registerHandler(
    "get-all-memberships-by-student-id",
    async (studentId: string) => {
      return await getAllMembershipsByStudentId(studentId)
    }
  )

  registerHandler(
    "get-current-memberships-by-class-id",
    async (classroomId: string) => {
      return await getCurrentMembershipsByClassId(classroomId)
    }
  )

  registerHandler(
    "add-student-to-class",
    async (
      studentId: string,
      classroomId: string,
      startDate?: Date,
      attendanceNumber?: number,
      notes?: string
    ) => {
      const dateToUse = startDate ? new Date(startDate) : new Date()

      const result = await addStudentToClass(
        studentId,
        classroomId,
        dateToUse,
        attendanceNumber,
        notes
      )
      return result
    }
  )

  registerHandler(
    "end-student-membership",
    async (membershipId: string, endDate?: Date) => {
      return await endStudentMembership(membershipId, endDate)
    }
  )

  registerHandler(
    "get-memberships-by-date-range",
    async (startDate: Date, endDate?: Date) => {
      return await getMembershipsByDateRange(startDate, endDate)
    }
  )

  // Exam-Student relationship handlers
  registerHandler("get-students-for-exam", async (examId: string) => {
    return await getStudentsForExam(examId)
  })

  registerHandler(
    "add-students-to-exam",
    async (examId: string, studentIds: string[]) => {
      return await addStudentsToExam(examId, studentIds)
    }
  )

  registerHandler(
    "remove-students-from-exam",
    async (examId: string, studentIds: string[]) => {
      return await removeStudentsFromExam(examId, studentIds)
    }
  )

  registerHandler(
    "update-student-exam-status",
    async (examId: string, studentId: string, status: StudentStatus) => {
      return await updateStudentExamStatus(examId, studentId, status)
    }
  )

  registerHandler(
    "get-classes-not-in-exam",
    async (examId: string, activeOnly = true) => {
      return await getClassesNotInExam(examId, activeOnly)
    }
  )

  registerHandler(
    "get-students-not-in-exam",
    async (examId: string, activeOnly = true) => {
      return await getStudentsNotInExam(examId, activeOnly)
    }
  )

  registerSafeHandler(
    "check-grading-data-for-students",
    async (examId: string, studentIds: string[]) => {
      const result = await checkGradingDataForStudents(examId, studentIds)
      return { success: true, ...result }
    }
  )

  registerHandler(
    "update-student-orders",
    async (
      examId: string,
      studentOrders: { studentId: string; customOrder: number }[]
    ) => {
      return await updateStudentOrders(examId, studentOrders)
    }
  )

  registerHandler("get-student-exam-results", async (studentId: string) => {
    return await getStudentExamResults(studentId)
  })

  registerHandler("get-class-exam-results", async (classroomId: string) => {
    const { getClassExamResults } = await import("../lib/prisma/student")
    return await getClassExamResults(classroomId)
  })

  // 生徒データExcelエクスポート（選択された生徒のみ）
  registerSafeHandler(
    "export-students-excel",
    async (selectedStudentIds: string[]) => {
      const allStudents = await fetchStudents()
      const selectedSet = new Set(selectedStudentIds)
      const students = allStudents.filter((student) =>
        selectedSet.has(student.id)
      )

      if (students.length === 0) {
        return { success: false, error: "出力する生徒が選択されていません" }
      }

      const dateStr = new Date().toISOString().slice(0, 10)
      const result = await dialog.showSaveDialog({
        title: "生徒一覧のExcel出力先を選択",
        defaultPath: `生徒一覧_${dateStr}.xlsx`,
        filters: [{ name: "Excelファイル", extensions: ["xlsx"] }],
      })

      if (result.canceled || !result.filePath) {
        return { success: false, error: "出力がキャンセルされました" }
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

      return { success: true, outputPath: result.filePath }
    },
    "不明なエラーが発生しました"
  )

  // 学級データExcelエクスポート（選択された学級の所属データ）
  registerSafeHandler(
    "export-classes-excel",
    async (selectedClassIds: string[]) => {
      const { fetchClasses } = await import("../lib/prisma/class")
      const allClasses = await fetchClasses()
      const selectedSet = new Set(selectedClassIds)
      const classes = allClasses.filter((classroom) =>
        selectedSet.has(classroom.id)
      )

      if (classes.length === 0) {
        return { success: false, error: "出力する学級が選択されていません" }
      }

      const dateStr = new Date().toISOString().slice(0, 10)
      const result = await dialog.showSaveDialog({
        title: "学級データのExcel出力先を選択",
        defaultPath: `学級データ_${dateStr}.xlsx`,
        filters: [{ name: "Excelファイル", extensions: ["xlsx"] }],
      })

      if (result.canceled || !result.filePath) {
        return { success: false, error: "出力がキャンセルされました" }
      }

      // 全生徒を取得（学籍番号逆引き用）
      const allStudents = await fetchStudents()
      const studentMap = new Map(
        allStudents.map((student) => [student.id, student])
      )

      const workbook = new ExcelJS.Workbook()

      // 学級ごとにシートを作成
      for (const classroom of classes) {
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

      return { success: true, outputPath: result.filePath }
    },
    "不明なエラーが発生しました"
  )
}
