/**
 * Coursework（試験外成績資料）の Prisma 操作関数
 *
 * Coursework は Exam / SubtotalGroup と同階層のトップレベル実体。
 * 評価項目（CourseworkItem）が満点・点数・変換表を保持し、成績算出（GradeDataSource）からは
 * courseworkItemId で項目単位に参照される（点数そのものを共有・再利用）。
 */

import { recordAuditLog } from "./auditLog"
import {
  resolveCourseworkScope,
  resolveCourseworkScopeByItem,
} from "./auditScope"
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

/** Prisma Decimal等の非シリアライズ型をプレーン値に変換 */
function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data))
}

/** Coursework の実施日（在籍判定の基準日）を取得 */
async function getCourseworkDate(courseworkId: string): Promise<Date | null> {
  const cw = await prisma.coursework.findUnique({
    where: { id: courseworkId },
    select: { date: true },
  })
  return cw?.date ?? null
}

// =============================================================================
// Coursework（トップレベル）
// =============================================================================

/** 試験外成績資料の一覧（サマリ）を取得 */
export async function getCourseworks() {
  try {
    const courseworks = await prisma.coursework.findMany({
      include: {
        _count: { select: { items: true, students: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    })
    return { success: true, courseworks: serialize(courseworks) }
  } catch (error) {
    console.error("Error getting courseworks:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/** 試験外成績資料を1件取得（詳細） */
export async function getCourseworkById(id: string) {
  try {
    const coursework = await prisma.coursework.findUnique({
      where: { id },
      include: {
        classes: {
          include: { class: { select: { id: true, name: true } } },
          orderBy: { order: "asc" },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
        items: {
          include: {
            letterScales: { orderBy: { order: "asc" } },
            _count: { select: { scores: true, gradeDataSources: true } },
          },
          orderBy: { order: "asc" },
        },
        _count: { select: { items: true, students: true } },
      },
    })
    if (!coursework) {
      return { success: false, error: "Coursework not found" }
    }
    return { success: true, coursework: serialize(coursework) }
  } catch (error) {
    console.error("Error getting coursework:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/** 試験外成績資料を作成 */
export async function createCoursework(data: {
  name: string
  description?: string | null
  date?: string | null
}) {
  try {
    const coursework = await prisma.coursework.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        date: data.date ? new Date(data.date) : null,
      },
    })

    await recordAuditLog({
      action: "coursework.create",
      entityType: "Coursework",
      entityId: coursework.id,
      scopeId: coursework.id,
      scopeLabel: coursework.name,
      target: coursework.name,
    })

    return { success: true, coursework: serialize(coursework) }
  } catch (error) {
    console.error("Error creating coursework:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/** 試験外成績資料を更新（基本設定） */
export async function updateCoursework(
  id: string,
  data: {
    name?: string
    description?: string | null
    date?: string | null
  }
) {
  try {
    const updateData: {
      name?: string
      description?: string | null
      date?: Date | null
    } = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined)
      updateData.description = data.description
    if (data.date !== undefined)
      updateData.date = data.date ? new Date(data.date) : null

    const coursework = await prisma.coursework.update({
      where: { id },
      data: updateData,
    })

    await recordAuditLog({
      action: "coursework.update",
      entityType: "Coursework",
      entityId: coursework.id,
      scopeId: coursework.id,
      scopeLabel: coursework.name,
      target: coursework.name,
    })

    return { success: true, coursework: serialize(coursework) }
  } catch (error) {
    console.error("Error updating coursework:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 試験外成績資料を削除。
 * いずれかの評価項目が成績算出（GradeDataSource）から参照されている場合は削除をブロックし、
 * 使用中の成績名を返す（deleteSubtotalGroup と同型）。
 */
export async function deleteCoursework(id: string) {
  try {
    const usedBy = await getReferencingGradeNamesForCoursework(id)
    if (usedBy.length > 0) {
      return {
        success: false,
        error: `この資料は成績算出で使用されているため削除できません: ${usedBy.join(", ")}`,
        usedBy,
      }
    }

    const before = await prisma.coursework.findUnique({
      where: { id },
      select: { name: true },
    })

    await prisma.coursework.delete({ where: { id } })

    await recordAuditLog({
      action: "coursework.delete",
      entityType: "Coursework",
      entityId: id,
      scopeId: id,
      scopeLabel: before?.name ?? null,
      target: before?.name ?? null,
    })

    return { success: true }
  } catch (error) {
    console.error("Error deleting coursework:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/** 資料を参照している成績名の一覧を返す（重複排除） */
async function getReferencingGradeNamesForCoursework(
  courseworkId: string
): Promise<string[]> {
  const dataSources = await prisma.gradeDataSource.findMany({
    where: { courseworkItem: { courseworkId } },
    select: { gradeItem: { select: { grade: { select: { name: true } } } } },
  })
  return [...new Set(dataSources.map((ds) => ds.gradeItem.grade.name))]
}

/** 評価項目を参照している成績名の一覧を返す（重複排除） */
async function getReferencingGradeNamesForItem(
  courseworkItemId: string
): Promise<string[]> {
  const dataSources = await prisma.gradeDataSource.findMany({
    where: { courseworkItemId },
    select: { gradeItem: { select: { grade: { select: { name: true } } } } },
  })
  return [...new Set(dataSources.map((ds) => ds.gradeItem.grade.name))]
}

// =============================================================================
// CourseworkItem（評価項目）
// =============================================================================

/** 評価項目を作成 */
export async function createCourseworkItem(data: {
  courseworkId: string
  name: string
  maxScore: number
  inputMode?: string
  letterScales?: { label: string; score: number; order: number }[]
}) {
  try {
    const maxOrder = await prisma.courseworkItem.aggregate({
      where: { courseworkId: data.courseworkId },
      _max: { order: true },
    })
    const nextOrder = (maxOrder._max.order ?? -1) + 1

    const item = await prisma.courseworkItem.create({
      data: {
        courseworkId: data.courseworkId,
        name: data.name,
        maxScore: data.maxScore,
        order: nextOrder,
        ...(data.inputMode !== undefined && { inputMode: data.inputMode }),
        ...(data.letterScales !== undefined &&
          data.letterScales.length > 0 && {
            letterScales: {
              create: data.letterScales.map((ls) => ({
                label: ls.label,
                score: ls.score,
                order: ls.order,
              })),
            },
          }),
      },
      include: {
        letterScales: { orderBy: { order: "asc" } },
        _count: { select: { scores: true, gradeDataSources: true } },
      },
    })

    const scope = await resolveCourseworkScope(data.courseworkId)
    await recordAuditLog({
      action: "coursework.item.create",
      entityType: "CourseworkItem",
      entityId: item.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      target: data.name,
    })

    return { success: true, item: serialize(item) }
  } catch (error) {
    console.error("Error creating coursework item:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/** 評価項目を更新（letterScales は全置換） */
export async function updateCourseworkItem(
  id: string,
  data: {
    name?: string
    maxScore?: number
    inputMode?: string
    letterScales?: { label: string; score: number; order: number }[]
  }
) {
  try {
    const { letterScales, ...rest } = data
    const updateData: Record<string, unknown> = { ...rest }
    if (letterScales !== undefined) {
      updateData.letterScales = {
        deleteMany: {},
        create: letterScales.map((ls) => ({
          label: ls.label,
          score: ls.score,
          order: ls.order,
        })),
      }
    }

    const item = await prisma.courseworkItem.update({
      where: { id },
      data: updateData,
      include: {
        letterScales: { orderBy: { order: "asc" } },
        _count: { select: { scores: true, gradeDataSources: true } },
      },
    })

    const scope = await resolveCourseworkScopeByItem(id)
    await recordAuditLog({
      action: "coursework.item.update",
      entityType: "CourseworkItem",
      entityId: id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      target: item.name,
    })

    return { success: true, item: serialize(item) }
  } catch (error) {
    console.error("Error updating coursework item:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 評価項目を削除。成績算出から参照されている場合はブロックし使用中の成績名を返す。
 */
export async function deleteCourseworkItem(id: string) {
  try {
    const usedBy = await getReferencingGradeNamesForItem(id)
    if (usedBy.length > 0) {
      return {
        success: false,
        error: `この評価項目は成績算出で使用されているため削除できません: ${usedBy.join(", ")}`,
        usedBy,
      }
    }

    const before = await prisma.courseworkItem.findUnique({
      where: { id },
      select: { name: true },
    })
    const scope = await resolveCourseworkScopeByItem(id)

    await prisma.courseworkItem.delete({ where: { id } })

    await recordAuditLog({
      action: "coursework.item.delete",
      entityType: "CourseworkItem",
      entityId: id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      target: before?.name ?? null,
    })

    return { success: true }
  } catch (error) {
    console.error("Error deleting coursework item:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/** 評価項目の並び順を更新 */
export async function reorderCourseworkItems(
  items: { id: string; order: number }[]
) {
  try {
    await prisma.$transaction(
      items.map((item) =>
        prisma.courseworkItem.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    )
    return { success: true }
  } catch (error) {
    console.error("Error reordering coursework items:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// =============================================================================
// CourseworkScore（点数）
// =============================================================================

/** 評価項目の全点数（生徒情報付き）を取得 */
export async function getCourseworkScoresByItemId(courseworkItemId: string) {
  try {
    const scores = await prisma.courseworkScore.findMany({
      where: { courseworkItemId },
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            lastName: true,
            firstName: true,
          },
        },
      },
      orderBy: { student: { studentNumber: "asc" } },
    })
    return { success: true, scores: serialize(scores) }
  } catch (error) {
    console.error("Error getting coursework scores:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 点数を一括更新（upsert）。各フィールドは optional（セル単位編集対応）。
 */
export async function batchUpsertCourseworkScores(
  scores: {
    courseworkItemId: string
    studentId: string
    score?: number | null
    letterValue?: string | null
    adjustment?: number | null
    adjustmentReason?: string | null
    comment?: string | null
  }[]
) {
  try {
    await prisma.$transaction(
      scores.map((s) => {
        const fields: {
          score?: number | null
          letterValue?: string | null
          adjustment?: number | null
          adjustmentReason?: string | null
          comment?: string | null
        } = {}
        if (s.score !== undefined) fields.score = s.score
        if (s.letterValue !== undefined) fields.letterValue = s.letterValue
        if (s.adjustment !== undefined) fields.adjustment = s.adjustment
        if (s.adjustmentReason !== undefined)
          fields.adjustmentReason = s.adjustmentReason
        if (s.comment !== undefined) fields.comment = s.comment

        return prisma.courseworkScore.upsert({
          where: {
            courseworkItemId_studentId: {
              courseworkItemId: s.courseworkItemId,
              studentId: s.studentId,
            },
          },
          create: {
            courseworkItemId: s.courseworkItemId,
            studentId: s.studentId,
            ...fields,
          },
          update: fields,
        })
      })
    )

    if (scores.length > 0) {
      const scope = await resolveCourseworkScopeByItem(
        scores[0].courseworkItemId
      )
      await recordAuditLog({
        action: "coursework.score.update",
        entityType: "CourseworkScore",
        entityId: scores[0].courseworkItemId,
        scopeId: scope.scopeId,
        scopeLabel: scope.scopeLabel,
        summary: `資料の点数を更新しました（${scores.length}件）`,
        extra: { count: scores.length },
      })
    }

    return { success: true }
  } catch (error) {
    console.error("Error batch upserting coursework scores:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// =============================================================================
// 名簿（CourseworkStudent / CourseworkClass）
// =============================================================================

/** 対象生徒一覧を取得 */
export async function getCourseworkStudents(courseworkId: string) {
  try {
    const students = await prisma.courseworkStudent.findMany({
      where: { courseworkId },
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
    return { success: true, students: serialize(students) }
  } catch (error) {
    console.error("Error getting coursework students:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/** 登録学級一覧を取得 */
export async function getCourseworkClasses(courseworkId: string) {
  try {
    const referenceDate = await getCourseworkDate(courseworkId)
    const classes = await prisma.courseworkClass.findMany({
      where: { courseworkId },
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
    console.error("Error getting coursework classes:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/** まだ登録されていない学級一覧を取得 */
export async function getAvailableClassesForCoursework(
  courseworkId: string,
  activeOnly = true
) {
  try {
    const referenceDate = await getCourseworkDate(courseworkId)
    const [existing, courseworkStudents] = await Promise.all([
      prisma.courseworkClass.findMany({
        where: { courseworkId },
        select: { classId: true },
      }),
      prisma.courseworkStudent.findMany({
        where: { courseworkId },
        select: { studentId: true },
      }),
    ])

    const classes = await getAvailableClassesForTarget({
      existingClassIds: existing.map((e) => e.classId),
      excludeStudentIds: courseworkStudents.map((g) => g.studentId),
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

/** まだ追加されていない生徒一覧を取得（個別追加用） */
export async function getAvailableStudentsForCoursework(
  courseworkId: string,
  activeOnly = true
) {
  try {
    const referenceDate = await getCourseworkDate(courseworkId)
    const courseworkStudents = await prisma.courseworkStudent.findMany({
      where: { courseworkId },
      select: { studentId: true },
    })

    const students = await getAvailableStudentsForTarget({
      excludeStudentIds: courseworkStudents.map((g) => g.studentId),
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
 * 資料名簿の I/O・監査メタデータ（共通ロジック rosterManager へ供給）
 */
const courseworkRosterAdapter: RosterAdapter = {
  getReferenceDate: (targetId) => getCourseworkDate(targetId),
  listExistingStudents: (targetId) =>
    prisma.courseworkStudent.findMany({
      where: { courseworkId: targetId },
      select: { studentId: true, customOrder: true },
    }),
  createStudents: async (targetId, rows) => {
    await prisma.courseworkStudent.createMany({
      data: rows.map((r) => ({
        courseworkId: targetId,
        studentId: r.studentId,
        customOrder: r.customOrder,
      })),
    })
  },
  setStudentOrders: async (targetId, orders) => {
    await prisma.$transaction(
      orders.map((o) =>
        prisma.courseworkStudent.updateMany({
          where: { courseworkId: targetId, studentId: o.studentId },
          data: { customOrder: o.customOrder },
        })
      )
    )
  },
  classMaxOrder: async (targetId) => {
    const result = await prisma.courseworkClass.aggregate({
      where: { courseworkId: targetId },
      _max: { order: true },
    })
    return result._max.order
  },
  upsertClass: async (targetId, classId, order) => {
    await prisma.courseworkClass.upsert({
      where: { courseworkId_classId: { courseworkId: targetId, classId } },
      create: { courseworkId: targetId, classId, order },
      update: {},
    })
  },
  setClassOrders: async (targetId, orders) => {
    await prisma.$transaction(
      orders.map((o) =>
        prisma.courseworkClass.updateMany({
          where: { courseworkId: targetId, classId: o.classId },
          data: { order: o.order },
        })
      )
    )
  },
  listOtherClassIds: async (targetId, exceptClassId) => {
    const rows = await prisma.courseworkClass.findMany({
      where: { courseworkId: targetId, classId: { not: exceptClassId } },
      select: { classId: true },
    })
    return rows.map((c) => c.classId)
  },
  removeClassAndStudents: async (targetId, classId, studentIds) => {
    await prisma.$transaction([
      prisma.courseworkStudent.deleteMany({
        where: { courseworkId: targetId, studentId: { in: studentIds } },
      }),
      prisma.courseworkClass.delete({
        where: { courseworkId_classId: { courseworkId: targetId, classId } },
      }),
    ])
  },
  scope: (targetId) => resolveCourseworkScope(targetId),
  audit: {
    studentEntity: "CourseworkStudent",
    classEntity: "CourseworkClass",
    addAction: "coursework.student.add",
    removeAction: "coursework.student.remove",
    reorderAction: "coursework.student.reorder",
    reorderCoalescePrefix: "coursework_student_reorder",
    addFromClassSummary: (n) => `学級から資料対象生徒を${n}名追加しました`,
    addIndividualSummary: (n) => `資料対象生徒を${n}名追加しました`,
    removeClassSummary: (n) => `学級を資料から外し、生徒${n}名を削除しました`,
  },
}

/** 学級から生徒を一括追加 */
export function addStudentsFromClassToCoursework(
  courseworkId: string,
  classId: string,
  activeOnly = true
) {
  return rosterAddStudentsFromClass(
    courseworkRosterAdapter,
    courseworkId,
    classId,
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

/** 生徒を個別に削除 */
export async function removeStudentsFromCoursework(
  courseworkId: string,
  studentIds: string[]
) {
  try {
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

    return { success: true, removedCount: studentIds.length }
  } catch (error) {
    console.error("Error removing students from coursework:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/** 学級の並び順を更新 */
export function setCourseworkClassOrders(
  courseworkId: string,
  orderedClassIds: string[]
) {
  return rosterSetClassOrders(
    courseworkRosterAdapter,
    courseworkId,
    orderedClassIds
  )
}

/** 学級削除のプレビュー（専属生徒の削除数） */
export function getCourseworkClassRemovalPreview(
  courseworkId: string,
  classId: string
) {
  return rosterClassRemovalPreview(
    courseworkRosterAdapter,
    courseworkId,
    classId
  )
}

/**
 * 学級を削除する。
 *
 * @param deleteStudents trueなら専属生徒も削除（既定）。falseなら登録解除のみ。
 */
export function removeClassFromCoursework(
  courseworkId: string,
  classId: string,
  deleteStudents = true
) {
  return rosterRemoveClass(
    courseworkRosterAdapter,
    courseworkId,
    classId,
    deleteStudents
  )
}

// =============================================================================
// タグ（CourseworkTag）
// =============================================================================

/** 資料のタグを一括設定（既存を全削除して再作成） */
export async function setCourseworkTags(
  courseworkId: string,
  tagIds: string[]
) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.courseworkTag.deleteMany({ where: { courseworkId } })
      if (tagIds.length > 0) {
        await tx.courseworkTag.createMany({
          data: tagIds.map((tagId) => ({ courseworkId, tagId })),
        })
      }
    })
    return { success: true }
  } catch (error) {
    console.error("Error setting coursework tags:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// =============================================================================
// 成績算出からの参照用（資料→評価項目の候補）
// =============================================================================

/** 成績データソースの参照候補として、資料と評価項目の一覧を取得 */
export async function getCourseworkCandidates() {
  try {
    const courseworks = await prisma.coursework.findMany({
      select: {
        id: true,
        name: true,
        date: true,
        items: {
          select: {
            id: true,
            name: true,
            maxScore: true,
            inputMode: true,
            order: true,
          },
          orderBy: { order: "asc" },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    })
    return { success: true, courseworks: serialize(courseworks) }
  } catch (error) {
    console.error("Error getting coursework candidates:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
