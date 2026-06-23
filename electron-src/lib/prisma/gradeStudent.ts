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
  rosterRemoveClass,
  rosterUpdateStudentOrders,
} from "./rosterManager"

/** GradeのreferenceDateを取得 */
async function getExamReferenceDate(gradeId: string): Promise<Date | null> {
  const gp = await prisma.grade.findUnique({
    where: { id: gradeId },
    select: { referenceDate: true },
  })
  return gp?.referenceDate ?? null
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
              include: { class: { select: { id: true, name: true } } },
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
    const classes = await prisma.gradeClass.findMany({
      where: { gradeId },
      include: {
        class: {
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
      classes: classes.map((c) => ({
        id: c.id,
        classId: c.classId,
        className: c.class.name,
        order: c.order,
        studentCount: c.class.memberships.length,
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
      prisma.gradeClass.findMany({
        where: { gradeId },
        select: { classId: true },
      }),
      prisma.gradeStudent.findMany({
        where: { gradeId },
        select: { studentId: true },
      }),
    ])

    const classes = await getAvailableClassesForTarget({
      existingClassIds: existing.map((e) => e.classId),
      excludeStudentIds: gradeStudents.map((g) => g.studentId),
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
      excludeStudentIds: gradeStudents.map((g) => g.studentId),
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
      data: rows.map((r) => ({
        gradeId: targetId,
        studentId: r.studentId,
        customOrder: r.customOrder,
      })),
    })
  },
  setStudentOrders: async (targetId, orders) => {
    await prisma.$transaction(
      orders.map((o) =>
        prisma.gradeStudent.updateMany({
          where: { gradeId: targetId, studentId: o.studentId },
          data: { customOrder: o.customOrder },
        })
      )
    )
  },
  classMaxOrder: async (targetId) => {
    const result = await prisma.gradeClass.aggregate({
      where: { gradeId: targetId },
      _max: { order: true },
    })
    return result._max.order
  },
  upsertClass: async (targetId, classId, order) => {
    await prisma.gradeClass.upsert({
      where: { gradeId_classId: { gradeId: targetId, classId } },
      create: { gradeId: targetId, classId, order },
      update: {},
    })
  },
  listOtherClassIds: async (targetId, exceptClassId) => {
    const rows = await prisma.gradeClass.findMany({
      where: { gradeId: targetId, classId: { not: exceptClassId } },
      select: { classId: true },
    })
    return rows.map((c) => c.classId)
  },
  removeClassAndStudents: async (targetId, classId, studentIds) => {
    await prisma.$transaction([
      prisma.gradeStudent.deleteMany({
        where: { gradeId: targetId, studentId: { in: studentIds } },
      }),
      prisma.gradeClass.delete({
        where: { gradeId_classId: { gradeId: targetId, classId } },
      }),
    ])
  },
  scope: (targetId) => resolveGradeScope(targetId),
  audit: {
    studentEntity: "GradeStudent",
    classEntity: "GradeClass",
    addAction: "grade.student.add",
    removeAction: "grade.student.remove",
    reorderAction: "grade.student.reorder",
    reorderCoalescePrefix: "grade_student_reorder",
    addFromClassSummary: (n) => `学級から成績対象生徒を${n}名追加しました`,
    addIndividualSummary: (n) => `成績対象生徒を${n}名追加しました`,
    removeClassSummary: (n) => `学級を成績から外し、生徒${n}名を削除しました`,
  },
}

/**
 * 学級から生徒を一括追加
 *
 * @param activeOnly trueなら基準日時点で在籍中の生徒のみ追加する（既定）。
 */
export function addStudentsFromClassToGrade(
  gradeId: string,
  classId: string,
  activeOnly = true
) {
  return rosterAddStudentsFromClass(
    gradeRosterAdapter,
    gradeId,
    classId,
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

/** 学級を削除（その学級由来の生徒も削除） */
export function removeClassFromGrade(gradeId: string, classId: string) {
  return rosterRemoveClass(gradeRosterAdapter, gradeId, classId)
}
