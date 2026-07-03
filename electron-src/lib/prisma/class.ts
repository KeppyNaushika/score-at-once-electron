import { Classroom, Prisma } from "@prisma/client"

import { diffFields, recordAuditLog } from "./auditLog"
import prisma from "./client"

type ClassroomWithMemberships = Prisma.ClassroomGetPayload<{
  include: {
    memberships: {
      include: {
        student: true
      }
    }
  }
}>

/** 全学級を取得する（memberships.student リレーション含む、出席番号順） */
export const fetchClasses = async (): Promise<ClassroomWithMemberships[]> => {
  try {
    return await prisma.classroom.findMany({
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
  classData: Prisma.ClassroomCreateInput
): Promise<ClassroomWithMemberships> => {
  try {
    const created = await prisma.classroom.create({
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

    await recordAuditLog({
      action: "class.create",
      entityType: "Class",
      entityId: created.id,
      target: created.name,
    })

    return created
  } catch (error) {
    console.error("Failed to create class:", error)
    throw error
  }
}

/** 学級情報を更新する（memberships.student リレーション含む） */
export const updateClass = async (
  classData: Prisma.ClassroomUpdateInput & { id: string }
): Promise<ClassroomWithMemberships> => {
  const { id, ...data } = classData
  try {
    const before = await prisma.classroom.findUnique({
      where: { id },
      select: { name: true, grade: true, classCode: true, description: true },
    })

    const updated = await prisma.classroom.update({
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

    await recordAuditLog({
      action: "class.update",
      entityType: "Class",
      entityId: updated.id,
      target: updated.name,
      changes: diffFields(
        before ?? undefined,
        {
          name: updated.name,
          grade: updated.grade,
          classCode: updated.classCode,
          description: updated.description,
        },
        [
          { field: "name", label: "学級名" },
          { field: "grade", label: "学年" },
          { field: "classCode", label: "学級コード" },
          { field: "description", label: "説明" },
        ]
      ),
    })

    return updated
  } catch (error) {
    console.error(`Failed to update class ${id}:`, error)
    throw error
  }
}

/** 学級を削除する（現在所属中の生徒がいる場合はエラー） */
export const deleteClass = async (
  classroomId: string
): Promise<Classroom | void> => {
  try {
    // Check for current memberships instead of students directly
    const membershipCount = await prisma.studentClassroomMembership.count({
      where: {
        classroomId,
        endDate: null, // current memberships only
      },
    })
    if (membershipCount > 0) {
      throw new Error(
        `学級を削除できません: ${membershipCount} 人の生徒がまだ所属しています。`
      )
    }
    const deleted = await prisma.classroom.delete({
      where: { id: classroomId },
    })

    await recordAuditLog({
      action: "class.delete",
      entityType: "Class",
      entityId: classroomId,
      target: deleted.name,
    })

    return deleted
  } catch (error) {
    console.error(`Failed to delete class ${classroomId}:`, error)
    throw error
  }
}
