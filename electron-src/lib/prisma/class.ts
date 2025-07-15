import { Class, Prisma } from "@prisma/client"
import prisma from "./client"

type ClassWithStudents = Prisma.ClassGetPayload<{
  include: {
    memberships: {
      include: {
        student: true
      }
    }
  }
}>

export const fetchClasses = async (): Promise<ClassWithStudents[]> => {
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
            { student: { studentId: "asc" } },
          ],
        },
      },
    })
  } catch (error) {
    console.error("Failed to fetch classes:", error)
    throw error
  }
}

export const createClass = async (
  classData: Prisma.ClassCreateWithoutClassTeachersInput,
): Promise<ClassWithStudents> => {
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
            { student: { studentId: "asc" } },
          ],
        },
      },
    })
  } catch (error) {
    console.error("Failed to create class:", error)
    throw error
  }
}

export const updateClass = async (
  classData: Prisma.ClassUpdateInput & { id: string },
): Promise<ClassWithStudents> => {
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
            { student: { studentId: "asc" } },
          ],
        },
      },
    })
  } catch (error) {
    console.error(`Failed to update class ${id}:`, error)
    throw error
  }
}

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
        `学級を削除できません: ${membershipCount} 人の生徒がまだ所属しています。`,
      )
    }
    return await prisma.class.delete({ where: { id: classId } })
  } catch (error) {
    console.error(`Failed to delete class ${classId}:`, error)
    throw error
  }
}
