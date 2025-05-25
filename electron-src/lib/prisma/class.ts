import { Prisma, Class } from "@prisma/client"
import prisma from "./client"

type ClassWithStudents = Prisma.ClassGetPayload<{ include: { students: true } }>

export const fetchClasses = async (): Promise<ClassWithStudents[]> => {
  try {
    return await prisma.class.findMany({ include: { students: true } })
  } catch (error) {
    console.error("Failed to fetch classes:", error)
    throw error
  }
}

export const createClass = async (
  classData: Prisma.ClassCreateWithoutTeachersInput,
): Promise<ClassWithStudents> => {
  try {
    return await prisma.class.create({
      data: classData,
      include: { students: true },
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
      include: { students: true },
    })
  } catch (error) {
    console.error(`Failed to update class ${id}:`, error)
    throw error
  }
}

export const deleteClass = async (classId: string): Promise<Class | void> => {
  try {
    const studentCount = await prisma.student.count({ where: { classId } })
    if (studentCount > 0) {
      throw new Error(
        `学級を削除できません: ${studentCount} 人の生徒がまだ所属しています。`,
      )
    }
    return await prisma.class.delete({ where: { id: classId } })
  } catch (error) {
    console.error(`Failed to delete class ${classId}:`, error)
    throw error
  }
}
