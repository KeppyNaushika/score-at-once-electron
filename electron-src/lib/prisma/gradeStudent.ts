/**
 * GradeStudent / GradeClass のPrisma操作関数
 */

import { resolveGradeScope } from "./auditScope"
import { getAvailableClassesForTarget } from "./availableClasses"
import { getAvailableStudentsForTarget } from "./availableStudents"
import prisma from "./client"
import { membershipFilterAt } from "./membershipFilter"
import {
  type RosterAdapter,
  rosterAddStudents,
  rosterAddStudentsFromClass,
  rosterClassRemovalPreview,
  rosterRemoveClass,
  rosterSetClassOrders,
  rosterUpdateStudentOrders,
} from "./rosterManager"

/** GradeのreferenceDateを取得 */
async function getExamReferenceDate(gradeId: string): Promise<Date | null> {
  const grade = await prisma.grade.findUnique({
    where: { id: gradeId },
    select: { referenceDate: true },
  })
  return grade?.referenceDate ?? null
}

/**
 * 成績算出試験の対象生徒一覧を取得
 */
export async function getStudentsByGradeId(gradeId: string) {
  try {
    const students = await prisma.gradeStudent.findMany({
      where: { gradeId },
      include: {
        student: {
          include: {
            memberships: {
              include: { classroom: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: [{ customOrder: "asc" }, { createdAt: "asc" }],
    })
    return { success: true, students }
  } catch (error) {
    console.error("Error getting grade exam students:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 成績算出試験の登録学級一覧を取得
 */
export async function getGradeClasses(gradeId: string) {
  try {
    const referenceDate = await getExamReferenceDate(gradeId)
    const classes = await prisma.gradeClassroom.findMany({
      where: { gradeId },
      include: {
        classroom: {
          include: {
            memberships: {
              where: membershipFilterAt(referenceDate),
              select: { studentId: true },
            },
          },
        },
      },
      orderBy: { order: "asc" },
    })
    return {
      success: true,
      classes: classes.map((gradeClass) => ({
        id: gradeClass.id,
        classroomId: gradeClass.classroomId,
        className: gradeClass.classroom.name,
        order: gradeClass.order,
        studentCount: gradeClass.classroom.memberships.length,
      })),
    }
  } catch (error) {
    console.error("Error getting grade exam classes:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * まだ登録されていない学級一覧を取得
 *
 * @param activeOnly trueなら基準日時点で在籍中の生徒のみを数える（既定）。
 *   falseなら在籍期間に関わらず学級に在籍歴のある全生徒を数える。
 *   いずれの場合も、対象生徒が0名の学級は候補から除外する。
 */
export async function getAvailableClassesForGrade(
  gradeId: string,
  activeOnly = true
) {
  try {
    const referenceDate = await getExamReferenceDate(gradeId)
    const [existing, gradeStudents] = await Promise.all([
      prisma.gradeClassroom.findMany({
        where: { gradeId },
        select: { classroomId: true },
      }),
      prisma.gradeStudent.findMany({
        where: { gradeId },
        select: { studentId: true },
      }),
    ])

    const classes = await getAvailableClassesForTarget({
      existingClassIds: existing.map((gradeClass) => gradeClass.classroomId),
      excludeStudentIds: gradeStudents.map(
        (gradeStudent) => gradeStudent.studentId
      ),
      referenceDate,
      activeOnly,
    })

    return { success: true, classes }
  } catch (error) {
    console.error("Error getting available classes:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * まだ追加されていない生徒一覧を取得（個別追加用）
 *
 * @param activeOnly trueなら「終了していない所属が1件以上ある生徒」のみ。
 */
export async function getAvailableStudentsForGrade(
  gradeId: string,
  activeOnly = true
) {
  try {
    const referenceDate = await getExamReferenceDate(gradeId)
    const gradeStudents = await prisma.gradeStudent.findMany({
      where: { gradeId },
      select: { studentId: true },
    })

    const students = await getAvailableStudentsForTarget({
      excludeStudentIds: gradeStudents.map(
        (gradeStudent) => gradeStudent.studentId
      ),
      referenceDate,
      activeOnly,
    })

    return { success: true, students }
  } catch (error) {
    console.error("Error getting available students:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 成績名簿の I/O・監査メタデータ（共通ロジック rosterManager へ供給）
 */
const gradeRosterAdapter: RosterAdapter = {
  getReferenceDate: (targetId) => getExamReferenceDate(targetId),
  listExistingStudents: (targetId) =>
    prisma.gradeStudent.findMany({
      where: { gradeId: targetId },
      select: { studentId: true, customOrder: true },
    }),
  createStudents: async (targetId, rows) => {
    await prisma.gradeStudent.createMany({
      data: rows.map((row) => ({
        gradeId: targetId,
        studentId: row.studentId,
        customOrder: row.customOrder,
      })),
    })
  },
  setStudentOrders: async (targetId, orders) => {
    await prisma.$transaction(
      orders.map((order) =>
        prisma.gradeStudent.updateMany({
          where: { gradeId: targetId, studentId: order.studentId },
          data: { customOrder: order.customOrder },
        })
      )
    )
  },
  classMaxOrder: async (targetId) => {
    const result = await prisma.gradeClassroom.aggregate({
      where: { gradeId: targetId },
      _max: { order: true },
    })
    return result._max.order
  },
  upsertClass: async (targetId, classroomId, order) => {
    await prisma.gradeClassroom.upsert({
      where: { gradeId_classroomId: { gradeId: targetId, classroomId } },
      create: { gradeId: targetId, classroomId, order },
      update: {},
    })
  },
  setClassOrders: async (targetId, orders) => {
    await prisma.$transaction(
      orders.map((order) =>
        prisma.gradeClassroom.updateMany({
          where: { gradeId: targetId, classroomId: order.classroomId },
          data: { order: order.order },
        })
      )
    )
  },
  listOtherClassIds: async (targetId, exceptClassId) => {
    const rows = await prisma.gradeClassroom.findMany({
      where: { gradeId: targetId, classroomId: { not: exceptClassId } },
      select: { classroomId: true },
    })
    return rows.map((gradeClass) => gradeClass.classroomId)
  },
  removeClassAndStudents: async (targetId, classroomId, studentIds) => {
    await prisma.$transaction([
      prisma.gradeStudent.deleteMany({
        where: { gradeId: targetId, studentId: { in: studentIds } },
      }),
      prisma.gradeClassroom.delete({
        where: { gradeId_classroomId: { gradeId: targetId, classroomId } },
      }),
    ])
  },
  scope: (targetId) => resolveGradeScope(targetId),
  audit: {
    studentEntity: "GradeStudent",
    classEntity: "GradeClassroom",
    addAction: "grade.student.add",
    removeAction: "grade.student.remove",
    reorderAction: "grade.student.reorder",
    reorderCoalescePrefix: "grade_student_reorder",
    addFromClassSummary: (count) =>
      `学級から成績対象生徒を${count}名追加しました`,
    addIndividualSummary: (count) => `成績対象生徒を${count}名追加しました`,
    removeClassSummary: (count) =>
      `学級を成績から外し、生徒${count}名を削除しました`,
  },
}

/**
 * 学級から生徒を一括追加
 *
 * @param activeOnly trueなら基準日時点で在籍中の生徒のみ追加する（既定）。
 */
export function addStudentsFromClassToGrade(
  gradeId: string,
  classroomId: string,
  activeOnly = true
) {
  return rosterAddStudentsFromClass(
    gradeRosterAdapter,
    gradeId,
    classroomId,
    activeOnly
  )
}

/** 生徒を個別に成績へ追加（学級を介さない） */
export function addStudentsToGrade(gradeId: string, studentIds: string[]) {
  return rosterAddStudents(gradeRosterAdapter, gradeId, studentIds)
}

/** 生徒の並び順を更新 */
export function updateGradeStudentOrders(
  gradeId: string,
  studentOrders: { studentId: string; customOrder: number }[]
) {
  return rosterUpdateStudentOrders(gradeRosterAdapter, gradeId, studentOrders)
}

/** 学級の並び順を更新 */
export function setGradeClassOrders(
  gradeId: string,
  orderedClassIds: string[]
) {
  return rosterSetClassOrders(gradeRosterAdapter, gradeId, orderedClassIds)
}

/** 学級削除のプレビュー（専属生徒の削除数） */
export function getGradeClassRemovalPreview(
  gradeId: string,
  classroomId: string
) {
  return rosterClassRemovalPreview(gradeRosterAdapter, gradeId, classroomId)
}

/**
 * 学級を削除する。
 *
 * @param deleteStudents trueなら専属生徒も削除（既定）。falseなら登録解除のみ。
 */
export function removeClassFromGrade(
  gradeId: string,
  classroomId: string,
  deleteStudents = true
) {
  return rosterRemoveClass(
    gradeRosterAdapter,
    gradeId,
    classroomId,
    deleteStudents
  )
}
