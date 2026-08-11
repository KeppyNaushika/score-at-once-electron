/**
 * 名簿（対象生徒・対象学級）操作の共通ロジック
 *
 * 成績算出（GradeStudent/GradeClassroom）と試験外成績資料（CourseworkStudent/CourseworkClassroom）は
 * 名簿の追加・並べ替え・削除のロジックがほぼ同一。アルゴリズム（customOrder の連番採番、
 * 既存重複の除外、「学級を外しても他学級に在籍する生徒は残す」判定）をここに一本化し、
 * テーブル固有の I/O・監査メタデータは {@link RosterAdapter} で各ドメインが型安全に供給する。
 */

import { recordAuditLog } from "./auditLog"
import prisma from "./client"
import { membershipFilterAt } from "./membershipFilter"

/**
 * ドメイン（成績 / 資料）ごとの名簿 I/O・監査メタデータ。
 * 各メソッドは自ドメインの Prisma delegate を閉じ込めて型安全に実装する。
 */
export interface RosterAdapter {
  /** 在籍フィルタの基準日（成績=referenceDate / 資料=date） */
  getReferenceDate(targetId: string): Promise<Date | null>
  /** 既存の対象生徒（studentId と customOrder） */
  listExistingStudents(
    targetId: string
  ): Promise<{ studentId: string; customOrder: number | null }[]>
  /** 対象生徒を一括作成 */
  createStudents(
    targetId: string,
    rows: { studentId: string; customOrder: number }[]
  ): Promise<void>
  /** 対象生徒の並び順を一括更新（単一トランザクションで実装すること） */
  setStudentOrders(
    targetId: string,
    orders: { studentId: string; customOrder: number }[]
  ): Promise<void>
  /** 対象学級の現在の最大 order（無ければ null） */
  classroomMaxOrder(targetId: string): Promise<number | null>
  /** 対象学級を作成（既存なら何もしない） */
  upsertClassroom(
    targetId: string,
    classroomId: string,
    order: number
  ): Promise<void>
  /** 対象学級の並び順を一括更新（単一トランザクションで実装すること） */
  setClassroomOrders(
    targetId: string,
    orders: { classroomId: string; order: number }[]
  ): Promise<void>
  /** 指定学級以外の登録学級ID一覧 */
  listOtherClassroomIds(
    targetId: string,
    exceptClassroomId: string
  ): Promise<string[]>
  /** 学級と、それに伴い外す生徒を単一トランザクションで削除 */
  removeClassroomAndStudents(
    targetId: string,
    classroomId: string,
    studentIds: string[]
  ): Promise<void>
  /** 監査ログ用スコープ */
  scope(
    targetId: string
  ): Promise<{ scopeId: string; scopeLabel: string | null }>
  audit: {
    studentEntity: string
    classroomEntity: string
    addAction: string
    removeAction: string
    reorderAction: string
    reorderCoalescePrefix: string
    addFromClassroomSummary: (count: number) => string
    addIndividualSummary: (count: number) => string
    removeClassroomSummary: (count: number) => string
  }
}

/** 学級から生徒を一括追加（基準日時点の在籍者を出席番号順で） */
export async function rosterAddStudentsFromClassroom(
  adapter: RosterAdapter,
  targetId: string,
  classroomId: string,
  activeOnly = true
): Promise<{ added: number; skipped: number }> {
  const referenceDate = await adapter.getReferenceDate(targetId)
  const nextOrder = (await adapter.classroomMaxOrder(targetId)) ?? -1
  await adapter.upsertClassroom(targetId, classroomId, nextOrder + 1)

  const memberships = await prisma.studentClassroomMembership.findMany({
    where: {
      classroomId,
      ...(activeOnly ? membershipFilterAt(referenceDate) : {}),
    },
    orderBy: [
      { attendanceNumber: "asc" },
      { student: { studentNumber: "asc" } },
    ],
    include: { student: true },
  })

  const existing = await adapter.listExistingStudents(targetId)
  const existingIds = new Set(
    existing.map((existingStudent) => existingStudent.studentId)
  )
  const maxCustomOrder = existing.reduce(
    (max, existingStudent) => Math.max(max, existingStudent.customOrder ?? 0),
    0
  )

  const toAdd: { studentId: string; customOrder: number }[] = []
  let orderOffset = maxCustomOrder + 1
  for (const membership of memberships) {
    if (!existingIds.has(membership.studentId)) {
      toAdd.push({
        studentId: membership.studentId,
        customOrder: orderOffset++,
      })
      existingIds.add(membership.studentId)
    }
  }

  if (toAdd.length > 0) {
    await adapter.createStudents(targetId, toAdd)
    const scope = await adapter.scope(targetId)
    await recordAuditLog({
      action: adapter.audit.addAction,
      entityType: adapter.audit.studentEntity,
      entityId: targetId,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      summary: adapter.audit.addFromClassroomSummary(toAdd.length),
      extra: { count: toAdd.length, classroomId },
    })
  }

  return {
    added: toAdd.length,
    skipped: memberships.length - toAdd.length,
  }
}

/** 生徒を個別に追加（学級を介さない。末尾に連番付与） */
export async function rosterAddStudents(
  adapter: RosterAdapter,
  targetId: string,
  studentIds: string[]
): Promise<{ addedCount: number; skippedCount: number }> {
  const existing = await adapter.listExistingStudents(targetId)
  const existingIds = new Set(
    existing.map((existingStudent) => existingStudent.studentId)
  )
  const maxCustomOrder = existing.reduce(
    (max, existingStudent) => Math.max(max, existingStudent.customOrder ?? 0),
    0
  )

  const newStudentIds = studentIds.filter((id) => !existingIds.has(id))
  let orderOffset = maxCustomOrder + 1
  const rows = newStudentIds.map((studentId) => ({
    studentId,
    customOrder: orderOffset++,
  }))

  if (rows.length > 0) {
    await adapter.createStudents(targetId, rows)
    const scope = await adapter.scope(targetId)
    await recordAuditLog({
      action: adapter.audit.addAction,
      entityType: adapter.audit.studentEntity,
      entityId: targetId,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      summary: adapter.audit.addIndividualSummary(rows.length),
      extra: { count: rows.length },
    })
  }

  return {
    addedCount: rows.length,
    skippedCount: studentIds.length - rows.length,
  }
}

/** 生徒の並び順を更新 */
export async function rosterUpdateStudentOrders(
  adapter: RosterAdapter,
  targetId: string,
  studentOrders: { studentId: string; customOrder: number }[]
): Promise<void> {
  await adapter.setStudentOrders(targetId, studentOrders)
  const scope = await adapter.scope(targetId)
  await recordAuditLog({
    action: adapter.audit.reorderAction,
    entityType: adapter.audit.studentEntity,
    entityId: targetId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    coalesceKey: `${adapter.audit.reorderCoalescePrefix}:${targetId}`,
  })
}

/** 学級の並び順を更新 */
export async function rosterSetClassroomOrders(
  adapter: RosterAdapter,
  targetId: string,
  orderedClassroomIds: string[]
): Promise<void> {
  await adapter.setClassroomOrders(
    targetId,
    orderedClassroomIds.map((classroomId, order) => ({ classroomId, order }))
  )
}

/**
 * 指定学級に「のみ」所属する（＝学級を外すと削除される）生徒IDを求める。
 * 他の登録学級にも在籍する生徒は残るため除外する。
 */
async function computeExclusiveStudents(
  adapter: RosterAdapter,
  targetId: string,
  classroomId: string
): Promise<string[]> {
  const memberships = await prisma.studentClassroomMembership.findMany({
    where: { classroomId },
  })
  const classroomStudentIds = memberships.map(
    (membership) => membership.studentId
  )

  const otherClassroomIds = await adapter.listOtherClassroomIds(
    targetId,
    classroomId
  )
  const otherMemberships = await prisma.studentClassroomMembership.findMany({
    where: { classroomId: { in: otherClassroomIds } },
  })
  const otherStudentIds = new Set(
    otherMemberships.map((membership) => membership.studentId)
  )

  return classroomStudentIds.filter((id) => !otherStudentIds.has(id))
}

/**
 * 学級削除のプレビュー。専属生徒を削除する場合に消える生徒数を返す。
 * 確認モーダルで「△名が削除されます」を出すために使う（実削除は行わない）。
 */
export async function rosterClassroomRemovalPreview(
  adapter: RosterAdapter,
  targetId: string,
  classroomId: string
): Promise<{ exclusiveCount: number }> {
  const exclusive = await computeExclusiveStudents(
    adapter,
    targetId,
    classroomId
  )
  return { exclusiveCount: exclusive.length }
}

/**
 * 学級を削除する。
 *
 * @param deleteStudents trueなら、その学級にのみ所属する生徒も削除する（他学級にも
 *   在籍する生徒は残す）。falseなら学級登録だけ解除し、生徒は対象に残す。
 */
export async function rosterRemoveClassroom(
  adapter: RosterAdapter,
  targetId: string,
  classroomId: string,
  deleteStudents = true
): Promise<{ removedStudents: number }> {
  const studentsToRemove = deleteStudents
    ? await computeExclusiveStudents(adapter, targetId, classroomId)
    : []

  await adapter.removeClassroomAndStudents(
    targetId,
    classroomId,
    studentsToRemove
  )

  const scope = await adapter.scope(targetId)
  await recordAuditLog({
    action: adapter.audit.removeAction,
    entityType: adapter.audit.classroomEntity,
    entityId: targetId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    summary: adapter.audit.removeClassroomSummary(studentsToRemove.length),
    extra: { removedStudents: studentsToRemove.length, classroomId },
  })

  return { removedStudents: studentsToRemove.length }
}
