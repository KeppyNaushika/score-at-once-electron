/**
 * 試験外成績資料アーカイブの DB 反映（核心）
 *
 * - 外部参照（生徒/学級/タグ）は idRemapper で UUID 一次 + 名前マッチング解決。
 * - 資料本体は UUID 一次照合（decision 未指定）/ ユーザー判断（reuse/new）で流用 or 新規。
 * - 点数は @@unique([courseworkItemId, studentId]) を updatedAt の LWW で upsert。
 *
 * grade-archive はこの importCourseworkData をトランザクション内で呼び出して内包する。
 */

import { randomUUID } from "crypto"

import type {
  ArchiveCourseworkItemRef,
  ArchiveCourseworkRef,
  CourseworkArchiveData,
  CourseworkImportOptions,
} from "../../../../src/types/courseworkArchive.types"
import type { TransactionClient } from "../exam-archive/uniqueNameGenerators"
import { isNewerByLww } from "../merge/decisionMergePolicy"
import {
  type IdMap,
  resolveClasses,
  resolveStudents,
  resolveTags,
  restoreMemberships,
} from "./idRemapper"

export interface ImportCourseworkResult {
  createdCourseworkIds: string[]
  /** アーカイブ評価項目 uuid → 実 CourseworkItem.id（grade の DataSource 再リンク用） */
  itemIdMap: Map<string, string>
  warnings: string[]
}

/** importCourseworkData が必要とするデータ断面（manifest 不要）。grade-archive も同形を渡せる。 */
export type CourseworkImportSections = Pick<
  CourseworkArchiveData,
  | "courseworks"
  | "studentsData"
  | "classesData"
  | "membershipsData"
  | "tagsData"
>

/**
 * 試験外成績資料をトランザクション内で DB へ反映する。
 */
export async function importCourseworkData(
  tx: TransactionClient,
  data: CourseworkImportSections,
  options: CourseworkImportOptions = {}
): Promise<ImportCourseworkResult> {
  const method = options.studentMatching ?? "studentNumber"
  const allowCreate = options.allowCreate ?? true
  const decisions = options.courseworkDecisions ?? {}
  const warnings: string[] = []
  const createdCourseworkIds: string[] = []
  const itemIdMap = new Map<string, string>()

  // 1. 外部参照の解決
  const students = await resolveStudents(tx, data.studentsData, {
    method,
    allowCreate,
  })
  warnings.push(...students.warnings)
  const classes = await resolveClasses(tx, data.classesData, { allowCreate })
  warnings.push(...classes.warnings)
  const tagMap = await resolveTags(tx, data.tagsData)
  if (allowCreate) {
    await restoreMemberships(
      tx,
      data.membershipsData,
      students.map,
      classes.map
    )
  }

  /** 点数を LWW で upsert する */
  const upsertScores = async (
    courseworkItemId: string,
    item: ArchiveCourseworkItemRef,
    cwName: string
  ): Promise<void> => {
    for (const sc of item.scores) {
      const studentId = students.map.get(sc.studentId)
      if (!studentId) {
        warnings.push(
          `試験外成績資料「${cwName}」評価項目「${item.name}」: 生徒の点数を解決できずスキップしました`
        )
        continue
      }
      const existing = await tx.courseworkScore.findUnique({
        where: {
          courseworkItemId_studentId: { courseworkItemId, studentId },
        },
      })
      const payload = {
        score: sc.score,
        letterValue: sc.letterValue,
        adjustment: sc.adjustment ?? 0,
        adjustmentReason: sc.adjustmentReason,
        comment: sc.comment,
      }
      if (existing) {
        if (isNewerByLww(new Date(sc.updatedAt), existing.updatedAt)) {
          await tx.courseworkScore.update({
            where: { id: existing.id },
            data: payload,
          })
        }
      } else {
        await tx.courseworkScore.create({
          data: { courseworkItemId, studentId, ...payload },
        })
      }
    }
  }

  /** 評価項目を作成（変換表も投入）し実 ID を返す */
  const createItem = async (
    courseworkId: string,
    itemId: string | undefined,
    item: ArchiveCourseworkItemRef
  ): Promise<string> => {
    const created = await tx.courseworkItem.create({
      data: {
        ...(itemId ? { id: itemId } : {}),
        courseworkId,
        name: item.name,
        order: item.order,
        maxScore: item.maxScore,
        inputMode: item.inputMode || "numeric",
        ...(item.letterScales.length > 0 && {
          letterScales: {
            create: item.letterScales.map((ls) => ({
              label: ls.label,
              score: ls.score,
              order: ls.order,
            })),
          },
        }),
      },
    })
    return created.id
  }

  /** 学級・タグ・名簿の join を冪等に張る */
  const ensureJoins = async (
    courseworkId: string,
    cw: ArchiveCourseworkRef
  ): Promise<void> => {
    for (const c of cw.classrooms) {
      const classroomId = classes.map.get(c.classroomId)
      if (!classroomId) continue
      const exists = await tx.courseworkClass.findUnique({
        where: { courseworkId_classroomId: { courseworkId, classroomId } },
        select: { id: true },
      })
      if (!exists) {
        await tx.courseworkClass.create({
          data: { courseworkId, classroomId, order: c.order },
        })
      }
    }
    for (const t of cw.tags) {
      const tagId = tagMap.get(t.tagId)
      if (!tagId) continue
      const exists = await tx.courseworkTag.findUnique({
        where: { courseworkId_tagId: { courseworkId, tagId } },
        select: { id: true },
      })
      if (!exists) {
        await tx.courseworkTag.create({ data: { courseworkId, tagId } })
      }
    }
    for (const s of cw.students) {
      const studentId = students.map.get(s.studentId)
      if (!studentId) continue
      const exists = await tx.courseworkStudent.findUnique({
        where: { courseworkId_studentId: { courseworkId, studentId } },
        select: { id: true },
      })
      if (!exists) {
        await tx.courseworkStudent.create({
          data: { courseworkId, studentId, customOrder: s.customOrder },
        })
      }
    }
  }

  // 2. 資料本体
  for (const cw of data.courseworks) {
    const decision = decisions[cw.id]
    let reuseId: string | null = null

    if (decision?.action === "reuse") {
      const exists = await tx.coursework.findUnique({
        where: { id: decision.existingId },
        select: { id: true },
      })
      reuseId = exists?.id ?? null
      if (!reuseId) {
        warnings.push(
          `試験外成績資料「${cw.name}」: 指定された統合先が見つからないため新規作成しました`
        )
      }
    } else if (!decision) {
      const uuidMatch = await tx.coursework.findUnique({
        where: { id: cw.id },
        select: { id: true },
      })
      reuseId = uuidMatch?.id ?? null
    }

    if (reuseId) {
      // 既存資料へ統合: 名簿/学級/タグの不足を補い、項目は名前で突合、点数は LWW
      await ensureJoins(reuseId, cw)
      const existing = await tx.coursework.findUnique({
        where: { id: reuseId },
        include: { items: { select: { id: true, name: true } } },
      })
      const existingByName = new Map(
        (existing?.items ?? []).map((i) => [i.name, i.id])
      )
      for (const item of cw.items) {
        let actualItemId = existingByName.get(item.name)
        if (!actualItemId) {
          actualItemId = await createItem(reuseId, randomUUID(), item)
        }
        await upsertScores(actualItemId, item, cw.name)
        if (item.id) itemIdMap.set(item.id, actualItemId)
      }
      continue
    }

    // 新規作成。decision 未指定（uuid 不一致の初回取込）のみ元 uuid を保持して冪等化。
    const preserveUuids = !decision
    const newCourseworkId = preserveUuids ? cw.id : randomUUID()
    const created = await tx.coursework.create({
      data: {
        id: newCourseworkId,
        name: cw.name,
        description: cw.description,
        date: cw.date ? new Date(cw.date) : null,
      },
    })
    createdCourseworkIds.push(created.id)
    await ensureJoins(created.id, cw)
    for (const item of cw.items) {
      const actualItemId = await createItem(
        created.id,
        preserveUuids ? item.id : randomUUID(),
        item
      )
      await upsertScores(actualItemId, item, cw.name)
      if (item.id) itemIdMap.set(item.id, actualItemId)
    }
  }

  return { createdCourseworkIds, itemIdMap, warnings }
}

export type { IdMap }
