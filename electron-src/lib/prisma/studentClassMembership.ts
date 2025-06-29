import { Prisma } from "@prisma/client"
import prisma from "./client"

type StudentClassMembershipWithDetails =
  Prisma.StudentClassMembershipGetPayload<{
    include: {
      student: true
      class: true
    }
  }>

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
        endDate: null // 現在所属中のみ
      }
    }
  }
}>

export const createStudentClassMembership = async (
  membershipData: Prisma.StudentClassMembershipCreateInput,
): Promise<StudentClassMembershipWithDetails> => {
  try {
    return await prisma.studentClassMembership.create({
      data: membershipData,
      include: {
        student: true,
        class: true,
      },
    })
  } catch (error) {
    console.error("Failed to create student class membership:", error)
    throw error
  }
}

export const updateStudentClassMembership = async (
  id: string,
  membershipData: Prisma.StudentClassMembershipUpdateInput,
): Promise<StudentClassMembershipWithDetails> => {
  try {
    return await prisma.studentClassMembership.update({
      where: { id },
      data: membershipData,
      include: {
        student: true,
        class: true,
      },
    })
  } catch (error) {
    console.error("Failed to update student class membership:", error)
    throw error
  }
}

export const deleteStudentClassMembership = async (
  id: string,
): Promise<void> => {
  try {
    await prisma.studentClassMembership.delete({ where: { id } })
  } catch (error) {
    console.error("Failed to delete student class membership:", error)
    throw error
  }
}

// 学生の現在の所属クラス一覧を取得
export const getCurrentMembershipsByStudentId = async (
  studentId: string,
): Promise<StudentClassMembershipWithDetails[]> => {
  try {
    return await prisma.studentClassMembership.findMany({
      where: {
        studentId,
        endDate: null, // 現在所属中
      },
      include: {
        student: true,
        class: true,
      },
      orderBy: {
        startDate: "desc",
      },
    })
  } catch (error) {
    console.error("Failed to fetch current memberships by student ID:", error)
    throw error
  }
}

// 学生の全所属履歴を取得
export const getAllMembershipsByStudentId = async (
  studentId: string,
): Promise<StudentClassMembershipWithDetails[]> => {
  try {
    return await prisma.studentClassMembership.findMany({
      where: { studentId },
      include: {
        student: true,
        class: true,
      },
      orderBy: {
        startDate: "desc",
      },
    })
  } catch (error) {
    console.error("Failed to fetch all memberships by student ID:", error)
    throw error
  }
}

// クラスの現在の所属学生一覧を取得（出席番号順）
export const getCurrentMembershipsByClassId = async (
  classId: string,
): Promise<StudentClassMembershipWithDetails[]> => {
  try {
    return await prisma.studentClassMembership.findMany({
      where: {
        classId,
        endDate: null, // 現在所属中
      },
      include: {
        student: true,
        class: true,
      },
      orderBy: [{ attendanceNumber: "asc" }, { student: { studentId: "asc" } }],
    })
  } catch (error) {
    console.error("Failed to fetch current memberships by class ID:", error)
    throw error
  }
}

// 学生をクラスに追加（新規所属）
export const addStudentToClass = async (
  studentId: string,
  classId: string,
  startDate: Date = new Date(),
  attendanceNumber?: number,
  notes?: string,
): Promise<StudentClassMembershipWithDetails> => {
  try {
    const result = await createStudentClassMembership({
      student: { connect: { id: studentId } },
      class: { connect: { id: classId } },
      startDate,
      attendanceNumber,
      notes,
    })

    return result
  } catch (error) {
    console.error("Failed to add student to class:", error)
    throw error
  }
}

// 学生のクラス所属を終了
export const endStudentMembership = async (
  membershipId: string,
  endDate: Date = new Date(),
): Promise<StudentClassMembershipWithDetails> => {
  try {
    return await updateStudentClassMembership(membershipId, {
      endDate,
    })
  } catch (error) {
    console.error("Failed to end student membership:", error)
    throw error
  }
}

// 特定期間の所属情報を取得
export const getMembershipsByDateRange = async (
  startDate: Date,
  endDate?: Date,
): Promise<StudentClassMembershipWithDetails[]> => {
  try {
    const whereCondition: Prisma.StudentClassMembershipWhereInput = {
      OR: [
        {
          // 期間内に開始したもの
          startDate: {
            gte: startDate,
            ...(endDate && { lte: endDate }),
          },
        },
        {
          // 期間をまたいで継続中のもの
          startDate: { lte: startDate },
          OR: [{ endDate: null }, { endDate: { gte: startDate } }],
        },
      ],
    }

    return await prisma.studentClassMembership.findMany({
      where: whereCondition,
      include: {
        student: true,
        class: true,
      },
      orderBy: [{ student: { studentId: "asc" } }, { startDate: "desc" }],
    })
  } catch (error) {
    console.error("Failed to fetch memberships by date range:", error)
    throw error
  }
}

export {
  type StudentClassMembershipWithDetails,
  type StudentWithMemberships,
  type ClassWithMemberships,
}
