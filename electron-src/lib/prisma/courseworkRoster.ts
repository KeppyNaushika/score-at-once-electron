/**
 * Coursework の名簿（CourseworkStudent / CourseworkClassroom）の Prisma 操作関数
 *
 * 名簿操作の本体は共通ロジック `rosterManager.ts`。ここは資料用の I/O と監査メタデータを
 * 供給する。
 */

import type { ConfirmedDeletionCount } from "../../../src/types/deletionConfirmation.types"
import { recordAuditLog } from "./auditLog"
import { resolveCourseworkScope } from "./auditScope"
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
import { serializePrisma } from "./serializePrisma"

/** Coursework の実施日（在籍判定の基準日）を取得 */
async function getCourseworkReferenceDate(
  courseworkId: string
): Promise<Date | null> {
  const coursework = await prisma.coursework.findUnique({
    where: { id: courseworkId },
  })
  return coursework?.referenceDate ?? null
}

/** 対象生徒一覧を取得 */
export async function getCourseworkStudents(courseworkId: string) {
  const students = await prisma.courseworkStudent.findMany({
    where: { courseworkId },
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
  return serializePrisma(students)
}

/**
 * 登録学級一覧を取得
 *
 * CourseworkClassroom の木（学級と、基準日時点で在籍している所属）をそのまま返す。
 * 学級名は `courseworkClassroom.classroom.name`、生徒数は
 * `courseworkClassroom.classroom.memberships.length` として表示側が読む。
 */
export async function getCourseworkClassrooms(courseworkId: string) {
  const referenceDate = await getCourseworkReferenceDate(courseworkId)
  return prisma.courseworkClassroom.findMany({
    where: { courseworkId },
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
}

/** まだ登録されていない学級一覧を取得 */
export async function getAvailableClassroomsForCoursework(
  courseworkId: string,
  activeOnly = true
) {
  const referenceDate = await getCourseworkReferenceDate(courseworkId)
  const [existing, courseworkStudents] = await Promise.all([
    prisma.courseworkClassroom.findMany({
      where: { courseworkId },
    }),
    prisma.courseworkStudent.findMany({
      where: { courseworkId },
    }),
  ])

  const classrooms = await getAvailableClassroomsForTarget({
    existingClassroomIds: existing.map(
      (existingClassroom) => existingClassroom.classroomId
    ),
    excludeStudentIds: courseworkStudents.map(
      (courseworkStudent) => courseworkStudent.studentId
    ),
    referenceDate,
    activeOnly,
  })

  return classrooms
}

/** まだ追加されていない生徒一覧を取得（個別追加用） */
export async function getAvailableStudentsForCoursework(
  courseworkId: string,
  activeOnly = true
) {
  const referenceDate = await getCourseworkReferenceDate(courseworkId)
  const courseworkStudents = await prisma.courseworkStudent.findMany({
    where: { courseworkId },
  })

  const students = await getAvailableStudentsForTarget({
    excludeStudentIds: courseworkStudents.map(
      (courseworkStudent) => courseworkStudent.studentId
    ),
    referenceDate,
    activeOnly,
  })

  return students
}

/**
 * 資料名簿の I/O・監査メタデータ（共通ロジック rosterManager へ供給）
 */
const courseworkRosterAdapter: RosterAdapter = {
  getReferenceDate: (targetId) => getCourseworkReferenceDate(targetId),
  listExistingStudents: (targetId) =>
    prisma.courseworkStudent.findMany({
      where: { courseworkId: targetId },
    }),
  createStudents: async (targetId, rows) => {
    await prisma.courseworkStudent.createMany({
      data: rows.map((row) => ({
        courseworkId: targetId,
        studentId: row.studentId,
        customOrder: row.customOrder,
      })),
    })
  },
  setStudentOrders: async (targetId, orders) => {
    await prisma.$transaction(
      orders.map((studentOrder) =>
        prisma.courseworkStudent.updateMany({
          where: { courseworkId: targetId, studentId: studentOrder.studentId },
          data: { customOrder: studentOrder.customOrder },
        })
      )
    )
  },
  classroomMaxOrder: async (targetId) => {
    const result = await prisma.courseworkClassroom.aggregate({
      where: { courseworkId: targetId },
      _max: { order: true },
    })
    return result._max.order
  },
  upsertClassroom: async (targetId, classroomId, order) => {
    await prisma.courseworkClassroom.upsert({
      where: {
        courseworkId_classroomId: { courseworkId: targetId, classroomId },
      },
      create: { courseworkId: targetId, classroomId, order },
      update: {},
    })
  },
  setClassroomOrders: async (targetId, orders) => {
    await prisma.$transaction(
      orders.map((classroomOrder) =>
        prisma.courseworkClassroom.updateMany({
          where: {
            courseworkId: targetId,
            classroomId: classroomOrder.classroomId,
          },
          data: { order: classroomOrder.order },
        })
      )
    )
  },
  listOtherClassroomIds: async (targetId, exceptClassroomId) => {
    const rows = await prisma.courseworkClassroom.findMany({
      where: {
        courseworkId: targetId,
        classroomId: { not: exceptClassroomId },
      },
    })
    return rows.map((courseworkClassroom) => courseworkClassroom.classroomId)
  },
  // 名簿行を消せば点数は cascade で落ちる（CourseworkScore は CourseworkStudent の子）
  removeStudents: async (targetId, studentIds) => {
    await prisma.courseworkStudent.deleteMany({
      where: { courseworkId: targetId, studentId: { in: studentIds } },
    })
  },
  removeClassroom: async (targetId, classroomId) => {
    await prisma.courseworkClassroom.delete({
      where: {
        courseworkId_classroomId: { courseworkId: targetId, classroomId },
      },
    })
  },
  scope: (targetId) => resolveCourseworkScope(targetId),
  audit: {
    studentEntity: "CourseworkStudent",
    classroomEntity: "CourseworkClassroom",
    addAction: "coursework.student.add",
    removeAction: "coursework.student.remove",
    reorderAction: "coursework.student.reorder",
    reorderCoalescePrefix: "coursework_student_reorder",
    addFromClassroomSummary: (n) => `学級から資料対象生徒を${n}名追加しました`,
    addIndividualSummary: (n) => `資料対象生徒を${n}名追加しました`,
    removeClassroomSummary: (n) =>
      `学級を資料から外し、生徒${n}名を削除しました`,
  },
}

/** 学級から生徒を一括追加 */
export function addStudentsFromClassroomToCoursework(
  courseworkId: string,
  classroomId: string,
  activeOnly = true
) {
  return rosterAddStudentsFromClassroom(
    courseworkRosterAdapter,
    courseworkId,
    classroomId,
    activeOnly
  )
}

/** 生徒を個別に追加（学級を介さない） */
export function addStudentsToCoursework(
  courseworkId: string,
  studentIds: string[]
) {
  return rosterAddStudents(courseworkRosterAdapter, courseworkId, studentIds)
}

/** 生徒の並び順を更新 */
export function updateCourseworkStudentOrders(
  courseworkId: string,
  studentOrders: { studentId: string; customOrder: number }[]
) {
  return rosterUpdateStudentOrders(
    courseworkRosterAdapter,
    courseworkId,
    studentOrders
  )
}

/**
 * 生徒を個別に削除。
 *
 * 点数（CourseworkScore）は CourseworkStudent の onDelete:Cascade 子なので DB が消す。
 * ここで手書きの DELETE を足してはいけない（消し忘れが孤児になり、資料の画面には
 * 現れないのに成績算出でだけ算入される、という #962 の穴が再発する）。
 */
export async function removeStudentsFromCoursework(
  courseworkId: string,
  studentIds: string[]
) {
  await prisma.courseworkStudent.deleteMany({
    where: { courseworkId, studentId: { in: studentIds } },
  })

  const scope = await resolveCourseworkScope(courseworkId)
  await recordAuditLog({
    action: "coursework.student.remove",
    entityType: "CourseworkStudent",
    entityId: courseworkId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    summary: `資料対象生徒を${studentIds.length}名削除しました`,
    extra: { count: studentIds.length },
  })

  return { removedCount: studentIds.length }
}

/** 学級の並び順を更新 */
export function setCourseworkClassroomOrders(
  courseworkId: string,
  orderedClassroomIds: string[]
) {
  return rosterSetClassroomOrders(
    courseworkRosterAdapter,
    courseworkId,
    orderedClassroomIds
  )
}

/** 学級削除のプレビュー（専属生徒の削除数） */
export function getCourseworkClassroomRemovalPreview(
  courseworkId: string,
  classroomId: string
) {
  return rosterClassroomRemovalPreview(
    courseworkRosterAdapter,
    courseworkId,
    classroomId
  )
}

/**
 * 学級を削除する。
 *
 * @param deleteStudents trueなら専属生徒も削除（既定）。falseなら登録解除のみ。
 * @param confirmedCounts 利用者が確認ダイアログで見た専属生徒の件数（段階26）
 */
export function removeClassroomFromCoursework(
  courseworkId: string,
  classroomId: string,
  deleteStudents: boolean,
  confirmedCounts: ConfirmedDeletionCount[]
) {
  return rosterRemoveClassroom(
    courseworkRosterAdapter,
    courseworkId,
    classroomId,
    deleteStudents,
    confirmedCounts
  )
}
