/**
 * Coursework（試験外成績資料）の Prisma 操作関数
 *
 * Coursework は Exam / SubtotalGroup と同階層のトップレベル実体。
 * 評価項目（CourseworkItem）が満点・点数・変換表を保持し、成績算出（GradeDataSource）からは
 * courseworkItemId で項目単位に参照される（点数そのものを共有・再利用）。
 */

import type { Prisma } from "@prisma/client"

import type { CourseworkScoreUpsertInput } from "../../../src/types/coursework.types"
import type { InputMode } from "../../../src/types/coursework.types"
import { toInputMode } from "../../../src/types/coursework.types"
import type { ConfirmedDeletionCount } from "../../../src/types/deletionConfirmation.types"
import { recordAuditLog } from "./auditLog"
import {
  resolveCourseworkScope,
  resolveCourseworkScopeByItem,
} from "./auditScope"
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

/**
 * 評価項目の `inputMode` を union へ倒す（SQLite に enum が無いので列は String）。
 * 境界の1箇所でだけ変換し、renderer は union として扱う。
 */
const withInputMode = <Item extends { inputMode: string }>(
  item: Item
): Omit<Item, "inputMode"> & { inputMode: InputMode } => ({
  ...item,
  inputMode: toInputMode(item.inputMode),
})

/** 資料の同梱評価項目にも同じ変換を掛ける */
const withCourseworkItems = <
  Coursework extends { items: { inputMode: string }[] },
>(
  coursework: Coursework
): Omit<Coursework, "items"> & {
  items: (Omit<Coursework["items"][number], "inputMode"> & {
    inputMode: InputMode
  })[]
} => ({
  ...coursework,
  items: coursework.items.map(withInputMode),
})

/** Coursework の実施日（在籍判定の基準日）を取得 */
async function getCourseworkReferenceDate(
  courseworkId: string
): Promise<Date | null> {
  const coursework = await prisma.coursework.findUnique({
    where: { id: courseworkId },
  })
  return coursework?.referenceDate ?? null
}

// =============================================================================
// Coursework（トップレベル）
// =============================================================================

/**
 * Coursework を CourseworkWithRelations として返すときの include（SSOT）。
 * 取得も作成も更新も同じ形を返す（作成結果をそのまま詳細画面へ渡せるようにするため）。
 */
const courseworkWithRelationsInclude = {
  classrooms: {
    include: { classroom: true },
    orderBy: { order: "asc" },
  },
  tags: { include: { tag: true } },
  items: {
    include: { letterScales: { orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  },
  // 名簿は行のまま渡し切る。件数は renderer が `.length` で取る
  students: true,
} satisfies Prisma.CourseworkInclude

/** 試験外成績資料の一覧（サマリ）を取得 */
export async function getCourseworks() {
  const courseworks = await prisma.coursework.findMany({
    include: {
      // 評価項目・名簿は行のまま渡し切る。件数は renderer が `.length` で取る
      items: { orderBy: { order: "asc" } },
      students: true,
      tags: {
        include: { tag: true },
      },
      classrooms: {
        include: { classroom: true },
        orderBy: { order: "asc" },
      },
    },
    orderBy: [{ referenceDate: "desc" }, { createdAt: "desc" }],
  })
  return serializePrisma(courseworks).map(withCourseworkItems)
}

/** 試験外成績資料を1件取得（詳細） */
export async function getCourseworkById(id: string) {
  const coursework = await prisma.coursework.findUnique({
    where: { id },
    include: courseworkWithRelationsInclude,
  })
  if (!coursework) {
    throw new Error("Coursework not found")
  }
  return withCourseworkItems(serializePrisma(coursework))
}

/** 試験外成績資料を作成 */
export async function createCoursework(data: {
  name: string
  description?: string | null
  referenceDate?: string | null
}) {
  const coursework = await prisma.coursework.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      referenceDate: data.referenceDate ? new Date(data.referenceDate) : null,
    },
    include: courseworkWithRelationsInclude,
  })

  await recordAuditLog({
    action: "coursework.create",
    entityType: "Coursework",
    entityId: coursework.id,
    scopeId: coursework.id,
    scopeLabel: coursework.name,
    target: coursework.name,
  })

  return withCourseworkItems(serializePrisma(coursework))
}

/** 試験外成績資料を更新（基本設定） */
export async function updateCoursework(
  id: string,
  data: {
    name?: string
    description?: string | null
    referenceDate?: string | null
  }
) {
  const updateData: {
    name?: string
    description?: string | null
    referenceDate?: Date | null
  } = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.referenceDate !== undefined)
    updateData.referenceDate = data.referenceDate
      ? new Date(data.referenceDate)
      : null

  const coursework = await prisma.coursework.update({
    where: { id },
    data: updateData,
    include: courseworkWithRelationsInclude,
  })

  await recordAuditLog({
    action: "coursework.update",
    entityType: "Coursework",
    entityId: coursework.id,
    scopeId: coursework.id,
    scopeLabel: coursework.name,
    target: coursework.name,
  })

  return withCourseworkItems(serializePrisma(coursework))
}

/**
 * 参照されていて消せなかったことは失敗ではなく結果なので、値で返す。
 * 呼び出し側は参照元の成績名を並べて知らせる。
 */
type CourseworkDeleteResult =
  { deleted: true } | { deleted: false; usedBy: string[] }

/**
 * 試験外成績資料を削除。
 * いずれかの評価項目が成績算出（GradeDataSource）から参照されている場合は削除をブロックし、
 * 使用中の成績名を返す（deleteSubtotalGroup と同型）。
 */
export async function deleteCoursework(
  id: string
): Promise<CourseworkDeleteResult> {
  const usedBy = await getReferencingGradeNamesForCoursework(id)
  if (usedBy.length > 0) {
    return { deleted: false, usedBy }
  }

  const before = await prisma.coursework.findUnique({
    where: { id },
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

  return { deleted: true }
}

/** 資料を参照している成績名の一覧を返す（重複排除） */
async function getReferencingGradeNamesForCoursework(
  courseworkId: string
): Promise<string[]> {
  const dataSources = await prisma.gradeDataSource.findMany({
    where: { courseworkItem: { courseworkId } },
    include: { gradeItem: { include: { grade: true } } },
  })
  return [
    ...new Set(
      dataSources.map((dataSource) => dataSource.gradeItem.grade.name)
    ),
  ]
}

/** 評価項目を参照している成績名の一覧を返す（重複排除） */
async function getReferencingGradeNamesForItem(
  courseworkItemId: string
): Promise<string[]> {
  const dataSources = await prisma.gradeDataSource.findMany({
    where: { courseworkItemId },
    include: { gradeItem: { include: { grade: true } } },
  })
  return [
    ...new Set(
      dataSources.map((dataSource) => dataSource.gradeItem.grade.name)
    ),
  ]
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
            create: data.letterScales.map((letterScale) => ({
              label: letterScale.label,
              score: letterScale.score,
              order: letterScale.order,
            })),
          },
        }),
    },
    include: { letterScales: { orderBy: { order: "asc" } } },
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

  return withInputMode(serializePrisma(item))
}

/** 評価項目を更新（letterScales は全置換） */
/**
 * 評価項目そのものを更新する。
 *
 * **文字評価の刻みはここで書かない。** 刻みは `courseworkLetterScale.ts` の
 * 1行ずつの経路が持つ。かつてここが刻みの配列を受け取り `deleteMany` →
 * `create` していたため、項目名を1文字直すだけで全行の id が振り直されていた。
 */
export async function updateCourseworkItem(
  id: string,
  data: {
    name?: string
    maxScore?: number
    inputMode?: string
  }
) {
  const item = await prisma.courseworkItem.update({
    where: { id },
    data,
    include: { letterScales: { orderBy: { order: "asc" } } },
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

  return withInputMode(serializePrisma(item))
}

/**
 * 評価項目を削除。成績算出から参照されている場合はブロックし使用中の成績名を返す。
 */
export async function deleteCourseworkItem(
  id: string
): Promise<CourseworkDeleteResult> {
  const usedBy = await getReferencingGradeNamesForItem(id)
  if (usedBy.length > 0) {
    return { deleted: false, usedBy }
  }

  const before = await prisma.courseworkItem.findUnique({
    where: { id },
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

  return { deleted: true }
}

/** 評価項目の並び順を更新 */
export async function reorderCourseworkItems(
  items: { id: string; order: number }[]
) {
  await prisma.$transaction(
    items.map((item) =>
      prisma.courseworkItem.update({
        where: { id: item.id },
        data: { order: item.order },
      })
    )
  )
}

// =============================================================================
// CourseworkScore（点数）
// =============================================================================

/** 評価項目の全点数（資料の対象者・生徒情報付き）を取得 */
export async function getCourseworkScoresByItemId(courseworkItemId: string) {
  const scores = await prisma.courseworkScore.findMany({
    where: { courseworkItemId },
    include: {
      courseworkStudent: { include: { student: true } },
    },
    orderBy: { courseworkStudent: { student: { studentNumber: "asc" } } },
  })
  return serializePrisma(scores)
}

/**
 * 評価項目と対象者が同じ資料に属していることを確かめる。
 *
 * FK は「CourseworkItem が実在すること」「CourseworkStudent が実在すること」しか
 * 保証せず、両者が同じ Coursework に属することは強制しない。食い違ったまま書けると、
 * 資料 A の項目に資料 B の名簿の生徒の点数がぶら下がり、A の名簿に居ない生徒の点数が
 * 成績算出に算入される — #962 で塞いだのと同じ穴が別の入口から開く。
 */
async function assertSameCoursework(
  scores: CourseworkScoreUpsertInput[]
): Promise<void> {
  const [items, courseworkStudents] = await Promise.all([
    prisma.courseworkItem.findMany({
      where: {
        id: {
          in: [...new Set(scores.map((score) => score.courseworkItemId))],
        },
      },
    }),
    prisma.courseworkStudent.findMany({
      where: {
        id: {
          in: [...new Set(scores.map((score) => score.courseworkStudentId))],
        },
      },
    }),
  ])
  const courseworkIdByItem = new Map(
    items.map((item) => [item.id, item.courseworkId])
  )
  const courseworkIdByStudent = new Map(
    courseworkStudents.map((courseworkStudent) => [
      courseworkStudent.id,
      courseworkStudent.courseworkId,
    ])
  )

  for (const score of scores) {
    const itemCourseworkId = courseworkIdByItem.get(score.courseworkItemId)
    const studentCourseworkId = courseworkIdByStudent.get(
      score.courseworkStudentId
    )
    if (!itemCourseworkId || !studentCourseworkId) {
      throw new Error("評価項目または対象生徒が見つかりません")
    }
    if (itemCourseworkId !== studentCourseworkId) {
      throw new Error("評価項目と対象生徒が別の試験外成績資料に属しています")
    }
  }
}

/**
 * 点数を一括更新（upsert）。各フィールドは optional（セル単位編集対応）。
 *
 * 点数の主語は「その資料の対象者」（CourseworkStudent）であり、人（Student）ではない。
 * 名簿に載っていない生徒の点数は書けない（FK が拒否する）。
 */
export async function batchUpsertCourseworkScores(
  scores: CourseworkScoreUpsertInput[]
) {
  if (scores.length > 0) await assertSameCoursework(scores)

  await prisma.$transaction(
    scores.map((score) => {
      const fields: {
        score?: number | null
        letterValue?: string | null
        adjustment?: number | null
        adjustmentReason?: string | null
        comment?: string | null
      } = {}
      if (score.score !== undefined) fields.score = score.score
      if (score.letterValue !== undefined)
        fields.letterValue = score.letterValue
      if (score.adjustment !== undefined) fields.adjustment = score.adjustment
      if (score.adjustmentReason !== undefined)
        fields.adjustmentReason = score.adjustmentReason
      if (score.comment !== undefined) fields.comment = score.comment

      return prisma.courseworkScore.upsert({
        where: {
          courseworkItemId_courseworkStudentId: {
            courseworkItemId: score.courseworkItemId,
            courseworkStudentId: score.courseworkStudentId,
          },
        },
        create: {
          courseworkItemId: score.courseworkItemId,
          courseworkStudentId: score.courseworkStudentId,
          ...fields,
        },
        update: fields,
      })
    })
  )

  if (scores.length > 0) {
    const scope = await resolveCourseworkScopeByItem(scores[0].courseworkItemId)
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
}

// =============================================================================
// 名簿（CourseworkStudent / CourseworkClassroom）
// =============================================================================

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
  listOtherClassroomIds: async (client, targetId, exceptClassroomId) => {
    const rows = await client.courseworkClassroom.findMany({
      where: {
        courseworkId: targetId,
        classroomId: { not: exceptClassroomId },
      },
    })
    return rows.map((courseworkClassroom) => courseworkClassroom.classroomId)
  },
  // 名簿行を消せば点数は cascade で落ちる（CourseworkScore は CourseworkStudent の子）
  removeClassroomAndStudents: async (tx, targetId, classroomId, studentIds) => {
    await tx.courseworkStudent.deleteMany({
      where: { courseworkId: targetId, studentId: { in: studentIds } },
    })
    await tx.courseworkClassroom.delete({
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

// =============================================================================
// タグ（CourseworkTag）
// =============================================================================

/** 資料のタグを一括設定（既存を全削除して再作成） */
export async function setCourseworkTags(
  courseworkId: string,
  tagIds: string[]
) {
  await prisma.$transaction(async (tx) => {
    await tx.courseworkTag.deleteMany({ where: { courseworkId } })
    if (tagIds.length > 0) {
      await tx.courseworkTag.createMany({
        data: tagIds.map((tagId) => ({ courseworkId, tagId })),
      })
    }
  })
}

/** 資料にタグを1件追加（既存タグは保持・冪等）。一括付与での既存タグ消失を避ける */
export async function addCourseworkTag(courseworkId: string, tagId: string) {
  await prisma.courseworkTag.upsert({
    where: { courseworkId_tagId: { courseworkId, tagId } },
    update: {},
    create: { courseworkId, tagId },
  })
}

// =============================================================================
// 成績算出からの参照用（資料→評価項目の候補）
// =============================================================================

/** 成績データソースの参照候補として、資料と評価項目の一覧を取得 */
export async function getCourseworkCandidates() {
  const courseworks = await prisma.coursework.findMany({
    include: { items: { orderBy: { order: "asc" } } },
    orderBy: [{ referenceDate: "desc" }, { createdAt: "desc" }],
  })
  return serializePrisma(courseworks).map(withCourseworkItems)
}
