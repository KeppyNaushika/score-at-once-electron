import { Prisma } from "@prisma/client"
import { dialog } from "electron"
import * as ExcelJS from "exceljs"

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
    async (membershipData: Prisma.StudentClassMembershipCreateInput) => {
      return await createStudentClassMembership(membershipData)
    }
  )

  registerHandler(
    "update-student-class-membership",
    async (
      id: string,
      membershipData: Prisma.StudentClassMembershipUpdateInput
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
    async (classId: string) => {
      return await getCurrentMembershipsByClassId(classId)
    }
  )

  registerHandler(
    "add-student-to-class",
    async (
      studentId: string,
      classId: string,
      startDate?: Date,
      attendanceNumber?: number,
      notes?: string
    ) => {
      const dateToUse = startDate ? new Date(startDate) : new Date()

      const result = await addStudentToClass(
        studentId,
        classId,
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
    async (
      examId: string,
      studentId: string,
      status: "participating" | "expected" | "absent"
    ) => {
      return await updateStudentExamStatus(examId, studentId, status)
    }
  )

  registerHandler("get-classes-not-in-exam", async (examId: string) => {
    return await getClassesNotInExam(examId)
  })

  registerHandler("get-students-not-in-exam", async (examId: string) => {
    return await getStudentsNotInExam(examId)
  })

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

  // 生徒データExcelエクスポート（選択された生徒のみ）
  registerSafeHandler(
    "export-students-excel",
    async (selectedStudentIds: string[]) => {
      const allStudents = await fetchStudents()
      const selectedSet = new Set(selectedStudentIds)
      const students = allStudents.filter((s) => selectedSet.has(s.id))

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
      const sorted = [...students].sort((a, b) =>
        a.studentNumber.localeCompare(b.studentNumber, "ja")
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
      const { fetchClasses } = await import("../lib/prisma/student")
      const allClasses = await fetchClasses()
      const selectedSet = new Set(selectedClassIds)
      const classes = allClasses.filter((c) => selectedSet.has(c.id))

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
      const studentMap = new Map(allStudents.map((s) => [s.id, s]))

      const workbook = new ExcelJS.Workbook()

      // 学級ごとにシートを作成
      for (const cls of classes) {
        const sheetName = cls.name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 31)
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
        const sortedMemberships = [...cls.memberships].sort((a, b) => {
          const aNum = a.attendanceNumber ?? Infinity
          const bNum = b.attendanceNumber ?? Infinity
          return aNum - bNum
        })

        for (const m of sortedMemberships) {
          const student = studentMap.get(m.student.id)
          const studentNumber = student?.studentNumber ?? m.student.id
          const row = worksheet.addRow([
            studentNumber,
            m.attendanceNumber ?? "",
            m.startDate
              ? new Date(m.startDate).toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "numeric",
                  day: "numeric",
                })
              : "",
            m.endDate
              ? new Date(m.endDate).toLocaleDateString("ja-JP", {
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
