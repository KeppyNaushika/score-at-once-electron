/**
 * 名簿（対象生徒・対象学級）操作の共通ロジック
 *
 * 成績算出（GradeStudent/GradeClass）と試験外成績資料（CourseworkStudent/CourseworkClass）は
 * 名簿の追加・並べ替え・削除のロジックがほぼ同一。アルゴリズム（customOrder の連番採番、
 * 既存重複の除外、「学級を外しても他学級に在籍する生徒は残す」判定）をここに一本化し、
 * テーブル固有の I/O・監査メタデータは {@link RosterAdapter} で各ドメインが型安全に供給する。
 */

import { recordAuditLog } from "./auditLog"
import prisma from "./client"
import { membershipFilterAt } from "./membershipFilter"

/** 名簿操作の結果型 */
export interface RosterMutationResult {
  success: boolean
  error?: string
}

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
  classMaxOrder(targetId: string): Promise<number | null>
  /** 対象学級を作成（既存なら何もしない） */
  upsertClass(
    targetId: string,
    classroomId: string,
    order: number
  ): Promise<void>
  /** 対象学級の並び順を一括更新（単一トランザクションで実装すること） */
  setClassOrders(
    targetId: string,
    orders: { classroomId: string; order: number }[]
  ): Promise<void>
  /** 指定学級以外の登録学級ID一覧 */
  listOtherClassIds(targetId: string, exceptClassId: string): Promise<string[]>
  /** 学級と、それに伴い外す生徒を単一トランザクションで削除 */
  removeClassAndStudents(
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
    classEntity: string
    addAction: string
    removeAction: string
    reorderAction: string
    reorderCoalescePrefix: string
    addFromClassSummary: (count: number) => string
    addIndividualSummary: (count: number) => string
    removeClassSummary: (count: number) => string
  }
}

/** 学級から生徒を一括追加（基準日時点の在籍者を出席番号順で） */
export async function rosterAddStudentsFromClass(
  adapter: RosterAdapter,
  targetId: string,
  classroomId: string,
  activeOnly = true
): Promise<{
  success: boolean
  added?: number
  skipped?: number
  error?: string
}> {
  try {
    const referenceDate = await adapter.getReferenceDate(targetId)
    const nextOrder = (await adapter.classMaxOrder(targetId)) ?? -1
    await adapter.upsertClass(targetId, classroomId, nextOrder + 1)

    const memberships = await prisma.studentClassMembership.findMany({
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
        summary: adapter.audit.addFromClassSummary(toAdd.length),
        extra: { count: toAdd.length, classroomId },
      })
    }

    return {
      success: true,
      added: toAdd.length,
      skipped: memberships.length - toAdd.length,
    }
  } catch (error) {
    console.error("Error adding students from class:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/** 生徒を個別に追加（学級を介さない。末尾に連番付与） */
export async function rosterAddStudents(
  adapter: RosterAdapter,
  targetId: string,
  studentIds: string[]
): Promise<{
  success: boolean
  addedCount?: number
  skippedCount?: number
  error?: string
}> {
  try {
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
      success: true,
      addedCount: rows.length,
      skippedCount: studentIds.length - rows.length,
    }
  } catch (error) {
    console.error("Error adding students:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/** 生徒の並び順を更新 */
export async function rosterUpdateStudentOrders(
  adapter: RosterAdapter,
  targetId: string,
  studentOrders: { studentId: string; customOrder: number }[]
): Promise<RosterMutationResult> {
  try {
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
    return { success: true }
  } catch (error) {
    console.error("Error updating student orders:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/** 学級の並び順を更新 */
export async function rosterSetClassOrders(
  adapter: RosterAdapter,
  targetId: string,
  orderedClassIds: string[]
): Promise<RosterMutationResult> {
  try {
    await adapter.setClassOrders(
      targetId,
      orderedClassIds.map((classroomId, order) => ({ classroomId, order }))
    )
    return { success: true }
  } catch (error) {
    console.error("Error updating class orders:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
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
  const memberships = await prisma.studentClassMembership.findMany({
    where: { classroomId },
    select: { studentId: true },
  })
  const classStudentIds = memberships.map((membership) => membership.studentId)

  const otherClassIds = await adapter.listOtherClassIds(targetId, classroomId)
  const otherMemberships = await prisma.studentClassMembership.findMany({
    where: { classroomId: { in: otherClassIds } },
    select: { studentId: true },
  })
  const otherStudentIds = new Set(
    otherMemberships.map((membership) => membership.studentId)
  )

  return classStudentIds.filter((id) => !otherStudentIds.has(id))
}

/**
 * 学級削除のプレビュー。専属生徒を削除する場合に消える生徒数を返す。
 * 確認モーダルで「△名が削除されます」を出すために使う（実削除は行わない）。
 */
export async function rosterClassRemovalPreview(
  adapter: RosterAdapter,
  targetId: string,
  classroomId: string
): Promise<{ success: boolean; exclusiveCount?: number; error?: string }> {
  try {
    const exclusive = await computeExclusiveStudents(
      adapter,
      targetId,
      classroomId
    )
    return { success: true, exclusiveCount: exclusive.length }
  } catch (error) {
    console.error("Error computing class removal preview:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 学級を削除する。
 *
 * @param deleteStudents trueなら、その学級にのみ所属する生徒も削除する（他学級にも
 *   在籍する生徒は残す）。falseなら学級登録だけ解除し、生徒は対象に残す。
 */
export async function rosterRemoveClass(
  adapter: RosterAdapter,
  targetId: string,
  classroomId: string,
  deleteStudents = true
): Promise<{ success: boolean; removedStudents?: number; error?: string }> {
  try {
    const studentsToRemove = deleteStudents
      ? await computeExclusiveStudents(adapter, targetId, classroomId)
      : []

    await adapter.removeClassAndStudents(
      targetId,
      classroomId,
      studentsToRemove
    )

    const scope = await adapter.scope(targetId)
    await recordAuditLog({
      action: adapter.audit.removeAction,
      entityType: adapter.audit.classEntity,
      entityId: targetId,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      summary: adapter.audit.removeClassSummary(studentsToRemove.length),
      extra: { removedStudents: studentsToRemove.length, classroomId },
    })

    return { success: true, removedStudents: studentsToRemove.length }
  } catch (error) {
    console.error("Error removing class:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
