import { Prisma } from "@prisma/client"
import prisma from "./client"
import * as XLSX from "xlsx"

type StudentWithMemberships = Prisma.StudentGetPayload<{
  include: {
    memberships: {
      include: {
        class: true
      }
      orderBy: {
        startDate: "desc"
      }
    }
  }
}>

type ClassWithMemberships = Prisma.ClassGetPayload<{
  include: {
    memberships: {
      include: {
        student: true
      }
      where: {
        endDate: null // 現在所属中の学生のみ
      }
    }
  }
}>

export const fetchStudents = async (): Promise<StudentWithMemberships[]> => {
  try {
    const students = await prisma.student.findMany({
      include: {
        memberships: {
          include: {
            class: true,
          },
          // すべてのメンバーシップを取得（現在・過去両方）
          orderBy: {
            startDate: "desc",
          },
        },
      },
    })
    return students
  } catch (error) {
    console.error("Failed to fetch students:", error)
    throw error
  }
}

export const createStudent = async (
  studentData: Prisma.StudentCreateInput,
): Promise<StudentWithMemberships> => {
  try {
    return await prisma.student.create({
      data: studentData,
      include: {
        memberships: {
          include: {
            class: true,
          },
          where: {
            endDate: null,
          },
          orderBy: {
            startDate: "desc",
          },
        },
      },
    })
  } catch (error) {
    console.error("Failed to create student:", error)
    throw error
  }
}

export const updateStudent = async (
  id: string,
  studentData: Prisma.StudentUpdateInput,
): Promise<StudentWithMemberships> => {
  try {
    return await prisma.student.update({
      where: { id },
      data: studentData,
      include: {
        memberships: {
          include: {
            class: true,
          },
          where: {
            endDate: null,
          },
          orderBy: {
            startDate: "desc",
          },
        },
      },
    })
  } catch (error) {
    console.error("Failed to update student:", error)
    throw error
  }
}

export const deleteStudent = async (id: string): Promise<void> => {
  try {
    await prisma.student.delete({ where: { id } })
  } catch (error) {
    console.error("Failed to delete student:", error)
    throw error
  }
}

export const fetchClasses = async (): Promise<ClassWithMemberships[]> => {
  try {
    return await prisma.class.findMany({
      include: {
        memberships: {
          include: {
            student: true,
          },
          where: {
            endDate: null, // 現在所属中の学生のみ
          },
        },
      },
    })
  } catch (error) {
    console.error("Failed to fetch classes:", error)
    throw error
  }
}

export const createClass = async (
  classData: Prisma.ClassCreateInput,
): Promise<ClassWithMemberships> => {
  try {
    return await prisma.class.create({
      data: classData,
      include: {
        memberships: {
          include: {
            student: true,
          },
          where: {
            endDate: null,
          },
        },
      },
    })
  } catch (error) {
    console.error("Failed to create class:", error)
    throw error
  }
}

export const updateClass = async (
  id: string,
  classData: Prisma.ClassUpdateInput,
): Promise<ClassWithMemberships> => {
  try {
    return await prisma.class.update({
      where: { id },
      data: classData,
      include: {
        memberships: {
          include: {
            student: true,
          },
          where: {
            endDate: null,
          },
        },
      },
    })
  } catch (error) {
    console.error("Failed to update class:", error)
    throw error
  }
}

export const deleteClass = async (id: string): Promise<void> => {
  try {
    // Check if class has current students before deleting
    const classWithMemberships = await prisma.class.findUnique({
      where: { id },
      include: {
        memberships: {
          where: {
            endDate: null, // 現在所属中の学生をチェック
          },
        },
      },
    })
    
    if (classWithMemberships && classWithMemberships.memberships.length > 0) {
      throw new Error("この学級には現在も所属している生徒がいるため削除できません。")
    }
    
    await prisma.class.delete({ where: { id } })
  } catch (error) {
    console.error("Failed to delete class:", error)
    throw error
  }
}

export const importStudentsFromFile = async (
  filePath: string,
  existingClasses: { id: string; name: string }[],
): Promise<{
  success: boolean
  importedStudents?: StudentWithMemberships[]
  error?: string
}> => {
  try {
    const workbook = XLSX.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json<any>(worksheet)

    const importedStudents: StudentWithMemberships[] = []
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
      const enrollmentYearKey = Object.keys(row).find(
        (k) => k.toLowerCase() === "入学年度" || k.toLowerCase() === "year",
      )

      const studentId = studentIdKey
        ? row[studentIdKey]?.toString().trim()
        : null
      const name = nameKey ? row[nameKey]?.toString().trim() : null
      const className = classNameKey
        ? row[classNameKey]?.toString().trim()
        : null
      const enrollmentYear = enrollmentYearKey
        ? parseInt(row[enrollmentYearKey]?.toString().trim())
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
        // Transaction を使用して学生作成と所属関係作成を同時に行う
        const result = await prisma.$transaction(async (tx) => {
          // 学生を作成または更新
          const student = await tx.student.upsert({
            where: { studentId },
            update: { 
              lastName: name?.split(/\s+/)[0] || "",
              firstName: name?.split(/\s+/).slice(1).join(" ") || "",
              lastNameKana: "",
              firstNameKana: "",
              enrollmentYear: enrollmentYear || undefined,
            },
            create: { 
              studentId, 
              lastName: name?.split(/\s+/)[0] || "",
              firstName: name?.split(/\s+/).slice(1).join(" ") || "",
              lastNameKana: "",
              firstNameKana: "",
              enrollmentYear: enrollmentYear || undefined,
            },
          })

          // 現在の所属関係をチェック
          const existingMembership = await tx.studentClassMembership.findFirst({
            where: {
              studentId: student.id,
              classId: classRecord.id,
              endDate: null,
            },
          })

          // まだこのクラスに所属していない場合は新しい所属関係を作成
          if (!existingMembership) {
            await tx.studentClassMembership.create({
              data: {
                studentId: student.id,
                classId: classRecord.id,
                startDate: new Date(),
              },
            })
          }

          // 結果を返す前に関連データを含めて取得
          return await tx.student.findUnique({
            where: { id: student.id },
            include: {
              memberships: {
                include: {
                  class: true,
                },
                where: {
                  endDate: null,
                },
                orderBy: {
                  startDate: "desc",
                },
              },
            },
          })
        })

        if (result) {
          importedStudents.push(result)
        }
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

// Export the updated types
export {
  type StudentWithMemberships,
  type ClassWithMemberships,
}
