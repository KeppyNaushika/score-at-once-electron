import { Class, Prisma } from "@prisma/client"

import prisma from "./client"

type ClassWithMemberships = Prisma.ClassGetPayload<{
  include: {
    memberships: {
      include: {
        student: true
      }
    }
  }
}>

/** 全学級を取得する（memberships.student リレーション含む、出席番号順） */
export const fetchClasses = async (): Promise<ClassWithMemberships[]> => {
  try {
    return await prisma.class.findMany({
      include: {
        memberships: {
          include: {
            student: true,
          },
          orderBy: [
            { endDate: "asc" }, // null values first (current memberships)
            { attendanceNumber: "asc" },
            { student: { studentNumber: "asc" } },
          ],
        },
      },
    })
  } catch (error) {
    console.error("Failed to fetch classes:", error)
    throw error
  }
}

/** 学級を新規作成する（memberships.student リレーション含む） */
export const createClass = async (
  classData: Prisma.ClassCreateInput
): Promise<ClassWithMemberships> => {
  try {
    return await prisma.class.create({
      data: classData,
      include: {
        memberships: {
          include: {
            student: true,
          },
          orderBy: [
            { endDate: "asc" }, // null values first (current memberships)
            { attendanceNumber: "asc" },
            { student: { studentNumber: "asc" } },
          ],
        },
      },
    })
  } catch (error) {
    console.error("Failed to create class:", error)
    throw error
  }
}

/** 学級情報を更新する（memberships.student リレーション含む） */
export const updateClass = async (
  classData: Prisma.ClassUpdateInput & { id: string }
): Promise<ClassWithMemberships> => {
  const { id, ...data } = classData
  try {
    return await prisma.class.update({
      where: { id },
      data,
      include: {
        memberships: {
          include: {
            student: true,
          },
          orderBy: [
            { endDate: "asc" }, // null values first (current memberships)
            { attendanceNumber: "asc" },
            { student: { studentNumber: "asc" } },
          ],
        },
      },
    })
  } catch (error) {
    console.error(`Failed to update class ${id}:`, error)
    throw error
  }
}

/** 学級を削除する（現在所属中の生徒がいる場合はエラー） */
export const deleteClass = async (classId: string): Promise<Class | void> => {
  try {
    // Check for current memberships instead of students directly
    const membershipCount = await prisma.studentClassMembership.count({
      where: {
        classId,
        endDate: null, // current memberships only
      },
    })
    if (membershipCount > 0) {
      throw new Error(
        `学級を削除できません: ${membershipCount} 人の生徒がまだ所属しています。`
      )
    }
    return await prisma.class.delete({ where: { id: classId } })
  } catch (error) {
    console.error(`Failed to delete class ${classId}:`, error)
    throw error
  }
}
