import { Prisma } from "@prisma/client"
import prisma from "./client"

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
      throw new Error(
        "この学級には現在も所属している生徒がいるため削除できません。",
      )
    }

    await prisma.class.delete({ where: { id } })
  } catch (error) {
    console.error("Failed to delete class:", error)
    throw error
  }
}


// Export the updated types
export { type ClassWithMemberships, type StudentWithMemberships }
