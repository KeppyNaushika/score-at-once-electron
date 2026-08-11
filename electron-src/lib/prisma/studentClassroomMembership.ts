import type { Prisma } from "@prisma/client"

import { recordAuditLog } from "./auditLog"
import prisma from "./client"

type StudentClassroomMembershipWithStudentAndClassroom =
  Prisma.StudentClassroomMembershipGetPayload<{
    include: {
      student: true
      classroom: true
    }
  }>

/** 生徒の学級所属レコードを作成する（student・class含む）。addStudentToClassroom 専用 */
const createStudentClassroomMembership = async (
  membershipData: Prisma.StudentClassroomMembershipCreateInput
): Promise<StudentClassroomMembershipWithStudentAndClassroom> => {
  try {
    return await prisma.studentClassroomMembership.create({
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
export const updateStudentClassroomMembership = async (
  id: string,
  membershipData: Prisma.StudentClassroomMembershipUpdateInput
): Promise<StudentClassroomMembershipWithStudentAndClassroom> => {
  try {
    return await prisma.studentClassroomMembership.update({
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
export const deleteStudentClassroomMembership = async (
  id: string
): Promise<void> => {
  try {
    const before = await prisma.studentClassroomMembership.findUnique({
      where: { id },
      include: { classroom: true, student: true },
    })

    await prisma.studentClassroomMembership.delete({ where: { id } })

    await recordAuditLog({
      action: "class.membership.remove",
      entityType: "StudentClassroomMembership",
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

/** 生徒を学級に追加する（新規所属レコード作成、student・class含む）
 *  同一生徒・同一学級のアクティブな所属（endDate: null）があれば
 *  自動的に終了してから新規作成する。
 */
export const addStudentToClassroom = async (
  studentId: string,
  classroomId: string,
  startDate: Date = new Date(),
  attendanceNumber?: number,
  notes?: string
): Promise<StudentClassroomMembershipWithStudentAndClassroom> => {
  try {
    const existingActive = await prisma.studentClassroomMembership.findMany({
      where: {
        studentId,
        classroomId,
        endDate: null,
      },
    })
    for (const membership of existingActive) {
      await endStudentMembership(membership.id, startDate)
    }

    const result = await createStudentClassroomMembership({
      student: { connect: { id: studentId } },
      classroom: { connect: { id: classroomId } },
      startDate,
      attendanceNumber,
      notes,
    })

    await recordAuditLog({
      action: "class.membership.add",
      entityType: "StudentClassroomMembership",
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
): Promise<StudentClassroomMembershipWithStudentAndClassroom> => {
  try {
    return await updateStudentClassroomMembership(membershipId, {
      endDate,
    })
  } catch (error) {
    console.error("Failed to end student membership:", error)
    throw error
  }
}
