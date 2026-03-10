import { Prisma } from "@prisma/client"
import { dialog, ipcMain } from "electron"
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

export function setupStudentHandlers(): void {
  ipcMain.handle("fetch-students", async () => {
    try {
      return await fetchStudents()
    } catch (err) {
      console.error("Error fetching students:", err)
      throw err
    }
  })

  ipcMain.handle(
    "create-student",
    async (_event, studentData: Prisma.StudentCreateInput) => {
      try {
        return await createStudent(studentData)
      } catch (err) {
        console.error("Error creating student:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "update-student",
    async (_event, id: string, studentData: Prisma.StudentUpdateInput) => {
      try {
        return await updateStudent(id, studentData)
      } catch (err) {
        console.error("Error updating student:", err)
        throw err
      }
    }
  )

  ipcMain.handle("delete-student", async (_event, id: string) => {
    try {
      return await deleteStudent(id)
    } catch (err) {
      console.error("Error deleting student:", err)
      throw err
    }
  })

  // Student Class Membership handlers
  ipcMain.handle(
    "create-student-class-membership",
    async (
      _event,
      membershipData: Prisma.StudentClassMembershipCreateInput
    ) => {
      try {
        return await createStudentClassMembership(membershipData)
      } catch (err) {
        console.error("Error creating student class membership:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "update-student-class-membership",
    async (
      _event,
      id: string,
      membershipData: Prisma.StudentClassMembershipUpdateInput
    ) => {
      try {
        return await updateStudentClassMembership(id, membershipData)
      } catch (err) {
        console.error("Error updating student class membership:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "delete-student-class-membership",
    async (_event, id: string) => {
      try {
        return await deleteStudentClassMembership(id)
      } catch (err) {
        console.error("Error deleting student class membership:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "get-current-memberships-by-student-id",
    async (_event, studentId: string) => {
      try {
        return await getCurrentMembershipsByStudentId(studentId)
      } catch (err) {
        console.error("Error getting current memberships by student ID:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "get-all-memberships-by-student-id",
    async (_event, studentId: string) => {
      try {
        return await getAllMembershipsByStudentId(studentId)
      } catch (err) {
        console.error("Error getting all memberships by student ID:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "get-current-memberships-by-class-id",
    async (_event, classId: string) => {
      try {
        return await getCurrentMembershipsByClassId(classId)
      } catch (err) {
        console.error("Error getting current memberships by class ID:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "add-student-to-class",
    async (
      _event,
      studentId: string,
      classId: string,
      startDate?: Date,
      attendanceNumber?: number,
      notes?: string
    ) => {
      try {
        const dateToUse = startDate ? new Date(startDate) : new Date()

        const result = await addStudentToClass(
          studentId,
          classId,
          dateToUse,
          attendanceNumber,
          notes
        )
        return result
      } catch (err) {
        console.error("Error adding student to class:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "end-student-membership",
    async (_event, membershipId: string, endDate?: Date) => {
      try {
        return await endStudentMembership(membershipId, endDate)
      } catch (err) {
        console.error("Error ending student membership:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "get-memberships-by-date-range",
    async (_event, startDate: Date, endDate?: Date) => {
      try {
        return await getMembershipsByDateRange(startDate, endDate)
      } catch (err) {
        console.error("Error getting memberships by date range:", err)
        throw err
      }
    }
  )

  // Exam-Student relationship handlers
  ipcMain.handle("get-students-for-exam", async (_event, examId: string) => {
    try {
      return await getStudentsForExam(examId)
    } catch (err) {
      console.error("Error getting students for exam:", err)
      throw err
    }
  })

  ipcMain.handle(
    "add-students-to-exam",
    async (_event, examId: string, studentIds: string[]) => {
      try {
        return await addStudentsToExam(examId, studentIds)
      } catch (err) {
        console.error("Error adding students to exam:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "remove-students-from-exam",
    async (_event, examId: string, studentIds: string[]) => {
      try {
        return await removeStudentsFromExam(examId, studentIds)
      } catch (err) {
        console.error("Error removing students from exam:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "update-student-exam-status",
    async (
      _event,
      examId: string,
      studentId: string,
      status: "participating" | "expected" | "absent"
    ) => {
      try {
        return await updateStudentExamStatus(examId, studentId, status)
      } catch (err) {
        console.error("Error updating student exam status:", err)
        throw err
      }
    }
  )

  ipcMain.handle("get-classes-not-in-exam", async (_event, examId: string) => {
    try {
      return await getClassesNotInExam(examId)
    } catch (err) {
      console.error("Error getting classes not in exam:", err)
      throw err
    }
  })

  ipcMain.handle("get-students-not-in-exam", async (_event, examId: string) => {
    try {
      return await getStudentsNotInExam(examId)
    } catch (err) {
      console.error("Error getting students not in exam:", err)
      throw err
    }
  })

  ipcMain.handle(
    "check-grading-data-for-students",
    async (_event, examId: string, studentIds: string[]) => {
      try {
        const result = await checkGradingDataForStudents(examId, studentIds)
        return { success: true, ...result }
      } catch (err) {
        console.error("Error checking grading data for students:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        }
      }
    }
  )

  ipcMain.handle(
    "update-student-orders",
    async (
      _event,
      examId: string,
      studentOrders: { studentId: string; customOrder: number }[]
    ) => {
      try {
        return await updateStudentOrders(examId, studentOrders)
      } catch (err) {
        console.error("Error updating student orders:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "get-student-exam-results",
    async (_event, studentId: string) => {
      try {
        return await getStudentExamResults(studentId)
      } catch (err) {
        console.error("Error getting student exam results:", err)
        throw err
      }
    }
  )

  // 生徒データExcelエクスポート（選択された生徒のみ）
  ipcMain.handle(
    "export-students-excel",
    async (_event, selectedStudentIds: string[]) => {
      try {
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
      } catch (err) {
        console.error("Error exporting students Excel:", err)
        return {
          success: false,
          error:
            err instanceof Error ? err.message : "不明なエラーが発生しました",
        }
      }
    }
  )

  // 学級データExcelエクスポート（選択された学級の所属データ）
  ipcMain.handle(
    "export-classes-excel",
    async (_event, selectedClassIds: string[]) => {
      try {
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
      } catch (err) {
        console.error("Error exporting classes Excel:", err)
        return {
          success: false,
          error:
            err instanceof Error ? err.message : "不明なエラーが発生しました",
        }
      }
    }
  )
}
