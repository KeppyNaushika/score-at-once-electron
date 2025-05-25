import { Prisma } from "@prisma/client"
import prisma from "./client"
import * as XLSX from "xlsx"

type StudentWithClass = Prisma.StudentGetPayload<{ include: { class: true } }>

export const fetchStudents = async (): Promise<StudentWithClass[]> => {
  try {
    return await prisma.student.findMany({ include: { class: true } })
  } catch (error) {
    console.error("Failed to fetch students:", error)
    throw error
  }
}

export const importStudentsFromFile = async (
  filePath: string,
  existingClasses: { id: string; name: string }[],
): Promise<{
  success: boolean
  importedStudents?: StudentWithClass[]
  error?: string
}> => {
  try {
    const workbook = XLSX.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json<any>(worksheet)

    const importedStudents: StudentWithClass[] = []
    const errors: string[] = []

    for (const row of jsonData) {
      const studentIdKey = Object.keys(row).find(
        (k) => k.toLowerCase() === "学籍番号" || k.toLowerCase() === "id",
      )
      const nameKey = Object.keys(row).find(
        (k) => k.toLowerCase() === "氏名" || k.toLowerCase() === "name",
      )
      const classNameKey = Object.keys(row).find(
        (k) => k.toLowerCase() === "学級名" || k.toLowerCase() === "class",
      )

      const studentId = studentIdKey
        ? row[studentIdKey]?.toString().trim()
        : null
      const name = nameKey ? row[nameKey]?.toString().trim() : null
      const className = classNameKey
        ? row[classNameKey]?.toString().trim()
        : null

      if (!studentId || !name || !className) {
        errors.push(
          `行をスキップ: データ不足 (学籍番号: ${studentId || "不明"}, 氏名: ${name || "不明"}, 学級名: ${className || "不明"})`,
        )
        continue
      }

      const classRecord = existingClasses.find((c) => c.name === className)
      if (!classRecord) {
        errors.push(
          `生徒 ${name} をスキップ: 学級 "${className}" が見つかりません。`,
        )
        continue
      }

      try {
        const student = await prisma.student.upsert({
          where: { studentId },
          update: { name, classId: classRecord.id },
          create: { studentId, name, classId: classRecord.id },
          include: { class: true },
        })
        importedStudents.push(student)
      } catch (dbError: any) {
        errors.push(
          `生徒 ${name} (${studentId}) のインポート失敗: ${dbError.message}`,
        )
      }
    }
    if (errors.length > 0) {
      return {
        success: importedStudents.length > 0,
        importedStudents,
        error: errors.join("\n"),
      }
    }
    return { success: true, importedStudents }
  } catch (error: any) {
    return { success: false, error: `ファイルインポート失敗: ${error.message}` }
  }
}
