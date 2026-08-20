/**
 * GradeStudent / GradeClassroom のPrisma操作関数
 */

import type { ConfirmedDeletionCount } from "@/types/deletionConfirmation.types"

import { resolveGradeScope } from "./auditScope"
import { getAvailableClassroomsForTarget } from "./availableClassrooms"
import { getAvailableStudentsForTarget } from "./availableStudents"
import prisma from "./client"
import { membershipFilterAt } from "./membershipFilter"
import {
  type RosterAdapter,
  rosterAddStudents,
  rosterAddStudentsFromClassroom,
  rosterClassroomRemovalPreview,
  rosterRemoveClassroom,
  rosterSetClassroomOrders,
  rosterUpdateStudentOrders,
} from "./rosterManager"

/** GradeのreferenceDateを取得 */
async function getExamReferenceDate(gradeId: string): Promise<Date | null> {
  const grade = await prisma.grade.findUnique({
    where: { id: gradeId },
  })
  return grade?.referenceDate ?? null
}

/**
 * 成績算出試験の対象生徒一覧を取得
 */
export async function getStudentsByGradeId(gradeId: string) {
  const students = await prisma.gradeStudent.findMany({
    where: { gradeId },
    include: {
      student: {
        include: {
          memberships: {
            include: { classroom: true },
          },
        },
      },
    },
    orderBy: [{ customOrder: "asc" }, { createdAt: "asc" }],
  })
  return students
}

/**
 * 成績算出試験の登録学級一覧を取得
 */
export async function getGradeClassrooms(gradeId: string) {
  const referenceDate = await getExamReferenceDate(gradeId)
  const classrooms = await prisma.gradeClassroom.findMany({
    where: { gradeId },
    include: {
      classroom: {
        include: {
          memberships: {
            where: membershipFilterAt(referenceDate),
          },
        },
      },
    },
    orderBy: { order: "asc" },
  })
  return classrooms.map((gradeClassroom) => ({
    id: gradeClassroom.id,
    classroomId: gradeClassroom.classroomId,
    className: gradeClassroom.classroom.name,
    order: gradeClassroom.order,
    studentCount: gradeClassroom.classroom.memberships.length,
  }))
}

/**
 * まだ登録されていない学級一覧を取得
 *
 * @param activeOnly trueなら基準日時点で在籍中の生徒のみを数える（既定）。
 *   falseなら在籍期間に関わらず学級に在籍歴のある全生徒を数える。
 *   いずれの場合も、対象生徒が0名の学級は候補から除外する。
 */
export async function getAvailableClassroomsForGrade(
  gradeId: string,
  activeOnly = true
) {
  const referenceDate = await getExamReferenceDate(gradeId)
  const [existing, gradeStudents] = await Promise.all([
    prisma.gradeClassroom.findMany({
      where: { gradeId },
    }),
    prisma.gradeStudent.findMany({
      where: { gradeId },
    }),
  ])

  const classrooms = await getAvailableClassroomsForTarget({
    existingClassroomIds: existing.map(
      (gradeClassroom) => gradeClassroom.classroomId
    ),
    excludeStudentIds: gradeStudents.map(
      (gradeStudent) => gradeStudent.studentId
    ),
    referenceDate,
    activeOnly,
  })

  return classrooms
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
  const referenceDate = await getExamReferenceDate(gradeId)
  const gradeStudents = await prisma.gradeStudent.findMany({
    where: { gradeId },
  })

  const students = await getAvailableStudentsForTarget({
    excludeStudentIds: gradeStudents.map(
      (gradeStudent) => gradeStudent.studentId
    ),
    referenceDate,
    activeOnly,
  })

  return students
}

/**
 * 成績名簿の I/O・監査メタデータ（共通ロジック rosterManager へ供給）
 */
const gradeRosterAdapter: RosterAdapter = {
  getReferenceDate: (targetId) => getExamReferenceDate(targetId),
  listExistingStudents: (targetId) =>
    prisma.gradeStudent.findMany({
      where: { gradeId: targetId },
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
  classroomMaxOrder: async (targetId) => {
    const result = await prisma.gradeClassroom.aggregate({
      where: { gradeId: targetId },
      _max: { order: true },
    })
    return result._max.order
  },
  upsertClassroom: async (targetId, classroomId, order) => {
    await prisma.gradeClassroom.upsert({
      where: { gradeId_classroomId: { gradeId: targetId, classroomId } },
      create: { gradeId: targetId, classroomId, order },
      update: {},
    })
  },
  setClassroomOrders: async (targetId, orders) => {
    await prisma.$transaction(
      orders.map((order) =>
        prisma.gradeClassroom.updateMany({
          where: { gradeId: targetId, classroomId: order.classroomId },
          data: { order: order.order },
        })
      )
    )
  },
  listOtherClassroomIds: async (client, targetId, exceptClassroomId) => {
    const rows = await client.gradeClassroom.findMany({
      where: { gradeId: targetId, classroomId: { not: exceptClassroomId } },
    })
    return rows.map((gradeClassroom) => gradeClassroom.classroomId)
  },
  removeClassroomAndStudents: async (tx, targetId, classroomId, studentIds) => {
    await tx.gradeStudent.deleteMany({
      where: { gradeId: targetId, studentId: { in: studentIds } },
    })
    await tx.gradeClassroom.delete({
      where: { gradeId_classroomId: { gradeId: targetId, classroomId } },
    })
  },
  scope: (targetId) => resolveGradeScope(targetId),
  audit: {
    studentEntity: "GradeStudent",
    classroomEntity: "GradeClassroom",
    addAction: "grade.student.add",
    removeAction: "grade.student.remove",
    reorderAction: "grade.student.reorder",
    reorderCoalescePrefix: "grade_student_reorder",
    addFromClassroomSummary: (count) =>
      `学級から成績対象生徒を${count}名追加しました`,
    addIndividualSummary: (count) => `成績対象生徒を${count}名追加しました`,
    removeClassroomSummary: (count) =>
      `学級を成績から外し、生徒${count}名を削除しました`,
  },
}

/**
 * 学級から生徒を一括追加
 *
 * @param activeOnly trueなら基準日時点で在籍中の生徒のみ追加する（既定）。
 */
export function addStudentsFromClassroomToGrade(
  gradeId: string,
  classroomId: string,
  activeOnly = true
) {
  return rosterAddStudentsFromClassroom(
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
export function setGradeClassroomOrders(
  gradeId: string,
  orderedClassroomIds: string[]
) {
  return rosterSetClassroomOrders(
    gradeRosterAdapter,
    gradeId,
    orderedClassroomIds
  )
}

/** 学級削除のプレビュー（専属生徒の削除数） */
export function getGradeClassroomRemovalPreview(
  gradeId: string,
  classroomId: string
) {
  return rosterClassroomRemovalPreview(gradeRosterAdapter, gradeId, classroomId)
}

/**
 * 学級を削除する。
 *
 * @param deleteStudents trueなら専属生徒も削除（既定）。falseなら登録解除のみ。
 * @param confirmedCounts 利用者が確認ダイアログで見た専属生徒の件数（段階26）
 */
export function removeClassroomFromGrade(
  gradeId: string,
  classroomId: string,
  deleteStudents: boolean,
  confirmedCounts: ConfirmedDeletionCount[]
) {
  return rosterRemoveClassroom(
    gradeRosterAdapter,
    gradeId,
    classroomId,
    deleteStudents,
    confirmedCounts
  )
}
