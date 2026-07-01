import { Prisma } from "@prisma/client"

import { recordAuditLog } from "./auditLog"
import prisma from "./client"

type StudentClassMembershipWithDetails =
  Prisma.StudentClassMembershipGetPayload<{
    include: {
      student: true
      classroom: true
    }
  }>

type StudentWithMemberships = Prisma.StudentGetPayload<{
  include: {
    memberships: {
      include: {
        classroom: true
      }
      orderBy: {
        startDate: "desc"
      }
    }
  }
}>

type ClassWithMemberships = Prisma.ClassroomGetPayload<{
  include: {
    memberships: {
      include: {
        student: true
      }
    }
  }
}>

/** 生徒の学級所属レコードを作成する（student・class含む） */
export const createStudentClassMembership = async (
  membershipData: Prisma.StudentClassMembershipCreateInput
): Promise<StudentClassMembershipWithDetails> => {
  try {
    return await prisma.studentClassMembership.create({
      data: membershipData,
      include: {
        student: true,
        classroom: true,
      },
    })
  } catch (error) {
    console.error("Failed to create student class membership:", error)
    throw error
  }
}

/** 生徒の学級所属レコードを更新する（student・class含む） */
export const updateStudentClassMembership = async (
  id: string,
  membershipData: Prisma.StudentClassMembershipUpdateInput
): Promise<StudentClassMembershipWithDetails> => {
  try {
    return await prisma.studentClassMembership.update({
      where: { id },
      data: membershipData,
      include: {
        student: true,
        classroom: true,
      },
    })
  } catch (error) {
    console.error("Failed to update student class membership:", error)
    throw error
  }
}

/** 生徒の学級所属レコードを削除する */
export const deleteStudentClassMembership = async (
  id: string
): Promise<void> => {
  try {
    const before = await prisma.studentClassMembership.findUnique({
      where: { id },
      select: {
        classroomId: true,
        classroom: { select: { name: true } },
        student: { select: { lastName: true, firstName: true } },
      },
    })

    await prisma.studentClassMembership.delete({ where: { id } })

    await recordAuditLog({
      action: "class.membership.remove",
      entityType: "StudentClassMembership",
      entityId: id,
      scopeId: before?.classroomId ?? null,
      scopeLabel: before?.classroom.name ?? null,
      target: before
        ? `${before.student.lastName} ${before.student.firstName}`.trim()
        : null,
    })
  } catch (error) {
    console.error("Failed to delete student class membership:", error)
    throw error
  }
}

/** 生徒の現在所属中の学級一覧を取得する（endDateがnullのもの、student・class含む） */
export const getCurrentMembershipsByStudentId = async (
  studentId: string
): Promise<StudentClassMembershipWithDetails[]> => {
  try {
    return await prisma.studentClassMembership.findMany({
      where: {
        studentId,
        endDate: null, // 現在所属中
      },
      include: {
        student: true,
        classroom: true,
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

/** 生徒の全所属履歴を取得する（過去分含む、student・class含む） */
export const getAllMembershipsByStudentId = async (
  studentId: string
): Promise<StudentClassMembershipWithDetails[]> => {
  try {
    return await prisma.studentClassMembership.findMany({
      where: { studentId },
      include: {
        student: true,
        classroom: true,
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

/** 学級の現在所属中の生徒一覧を取得する（出席番号順、student・class含む） */
export const getCurrentMembershipsByClassId = async (
  classroomId: string
): Promise<StudentClassMembershipWithDetails[]> => {
  try {
    return await prisma.studentClassMembership.findMany({
      where: {
        classroomId,
        endDate: null, // 現在所属中
      },
      include: {
        student: true,
        classroom: true,
      },
      orderBy: [
        { attendanceNumber: "asc" },
        { student: { studentNumber: "asc" } },
      ],
    })
  } catch (error) {
    console.error("Failed to fetch current memberships by class ID:", error)
    throw error
  }
}

/** 生徒を学級に追加する（新規所属レコード作成、student・class含む）
 *  同一生徒・同一学級のアクティブな所属（endDate: null）があれば
 *  自動的に終了してから新規作成する。
 */
export const addStudentToClass = async (
  studentId: string,
  classroomId: string,
  startDate: Date = new Date(),
  attendanceNumber?: number,
  notes?: string
): Promise<StudentClassMembershipWithDetails> => {
  try {
    const existingActive = await prisma.studentClassMembership.findMany({
      where: {
        studentId,
        classroomId,
        endDate: null,
      },
    })
    for (const membership of existingActive) {
      await endStudentMembership(membership.id, startDate)
    }

    const result = await createStudentClassMembership({
      student: { connect: { id: studentId } },
      classroom: { connect: { id: classroomId } },
      startDate,
      attendanceNumber,
      notes,
    })

    await recordAuditLog({
      action: "class.membership.add",
      entityType: "StudentClassMembership",
      entityId: result.id,
      scopeId: classroomId,
      scopeLabel: result.classroom?.name ?? null,
      target: `${result.student.lastName} ${result.student.firstName}`.trim(),
    })

    return result
  } catch (error) {
    console.error("Failed to add student to class:", error)
    throw error
  }
}

/** 生徒の学級所属を終了する（endDateを設定） */
export const endStudentMembership = async (
  membershipId: string,
  endDate: Date = new Date()
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

/** 指定期間に有効な所属情報を取得する（期間内開始・期間をまたぐもの含む、student・class含む） */
export const getMembershipsByDateRange = async (
  startDate: Date,
  endDate?: Date
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
        classroom: true,
      },
      orderBy: [{ student: { studentNumber: "asc" } }, { startDate: "desc" }],
    })
  } catch (error) {
    console.error("Failed to fetch memberships by date range:", error)
    throw error
  }
}

export {
  type ClassWithMemberships,
  type StudentClassMembershipWithDetails,
  type StudentWithMemberships,
}
