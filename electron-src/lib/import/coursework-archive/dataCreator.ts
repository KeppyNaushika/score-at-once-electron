/**
 * 試験外成績資料アーカイブの DB 反映（核心）
 *
 * - 外部参照（生徒/学級/タグ）は idRemapper で UUID 一次 + 名前マッチング解決。
 * - 資料本体は UUID 一次照合（decision 未指定）/ ユーザー判断（reuse/new）で流用 or 新規。
 * - 点数は @@unique([courseworkItemId, courseworkStudentId]) を updatedAt の LWW で upsert。
 *
 * アーカイブはテーブルごとの平坦なセクションで来るので、courseworkId / courseworkItemId で
 * 束ね直してから資料単位に処理する。
 *
 * grade-archive はこの importCourseworkData をトランザクション内で呼び出して内包する。
 */

import { randomUUID } from "crypto"

import type {
  ArchiveCourseworkItemRow,
  ArchiveCourseworkRow,
  CourseworkArchiveData,
  CourseworkImportOptions,
} from "../../../../src/types/courseworkArchive.types"
import type { TransactionClient } from "../exam-archive/uniqueNameGenerators"
import { isNewerByLww } from "../merge/decisionMergePolicy"
import {
  resolveClassrooms,
  resolveStudents,
  resolveTags,
  restoreMemberships,
} from "./idRemapper"

interface ImportCourseworkResult {
  createdCourseworkIds: string[]
  /** アーカイブ評価項目 uuid → 実 CourseworkItem.id（grade の DataSource 再リンク用） */
  itemIdMap: Map<string, string>
  warnings: string[]
}

/** importCourseworkData が必要とするデータ断面（manifest 不要）。grade-archive も同形を渡せる。 */
type CourseworkImportSections = Pick<
  CourseworkArchiveData,
  | "courseworks"
  | "courseworkClassrooms"
  | "courseworkTags"
  | "courseworkStudents"
  | "courseworkItems"
  | "courseworkLetterScales"
  | "courseworkScores"
  | "studentsData"
  | "classesData"
  | "membershipsData"
  | "tagsData"
>

/**
 * 点数の書き込み先となる名簿。
 * アーカイブの CourseworkStudent.id → 取り込み先の CourseworkStudent.id と、
 * 「名簿には居るが取り込み先にその生徒が居ない」対象者の集合を持つ。
 */
interface CourseworkRoster {
  byArchiveId: Map<string, string>
  unresolvedArchiveIds: Set<string>
}

/** 行の配列を親 id で束ねる */
function groupBy<T>(rows: T[], keyOf: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>()
  for (const row of rows) {
    const key = keyOf(row)
    const bucket = grouped.get(key)
    if (bucket) bucket.push(row)
    else grouped.set(key, [row])
  }
  return grouped
}

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

  const classroomsByCoursework = groupBy(
    data.courseworkClassrooms,
    (courseworkClassroom) => courseworkClassroom.courseworkId
  )
  const tagsByCoursework = groupBy(
    data.courseworkTags,
    (courseworkTag) => courseworkTag.courseworkId
  )
  const studentsByCoursework = groupBy(
    data.courseworkStudents,
    (courseworkStudent) => courseworkStudent.courseworkId
  )
  const itemsByCoursework = groupBy(
    data.courseworkItems,
    (item) => item.courseworkId
  )
  const letterScalesByItem = groupBy(
    data.courseworkLetterScales,
    (letterScale) => letterScale.courseworkItemId
  )
  const scoresByItem = groupBy(
    data.courseworkScores,
    (score) => score.courseworkItemId
  )

  // 1. 外部参照の解決
  const students = await resolveStudents(tx, data.studentsData, {
    method,
    allowCreate,
  })
  warnings.push(...students.warnings)
  const classes = await resolveClassrooms(tx, data.classesData, { allowCreate })
  warnings.push(...classes.warnings)
  const tagMap = await resolveTags(tx, data.tagsData)
  if (allowCreate) {
    await restoreMemberships(
      tx,
      data.membershipsData,
      students.map,
      classes.map,
      students.createdIds
    )
  }

  /**
   * 書き込めなかった点数の件数。原因を分けて数える。
   *
   * - orphaned: アーカイブの名簿にそもそも載っていない生徒の点数（アーカイブ側の不整合）
   * - unresolved: 名簿には居るが、取り込み先にその生徒が居ない（取り込み先の不足）
   *
   * どちらも結果は「点数が入らない」だが、利用者が取るべき行動が違う。
   * 一緒くたにすると「アーカイブが壊れている」と誤解させる。
   */
  interface SkippedScoreCounts {
    orphaned: number
    unresolved: number
  }

  const warnSkippedScores = (
    courseworkName: string,
    skipped: SkippedScoreCounts
  ) => {
    if (skipped.orphaned > 0) {
      warnings.push(
        `試験外成績資料「${courseworkName}」: 対象生徒として登録されていない生徒の点数 ${skipped.orphaned} 件を破棄しました`
      )
    }
    if (skipped.unresolved > 0) {
      warnings.push(
        `試験外成績資料「${courseworkName}」: この環境に存在しない生徒の点数 ${skipped.unresolved} 件を取り込めませんでした`
      )
    }
  }

  /**
   * 点数を LWW で upsert する。
   *
   * 点数の主語は資料の対象者（CourseworkStudent）。取り込み先では名簿行の id が
   * 別物になるため、アーカイブの対象者 id を roster で引き直す。名簿に対応行が
   * 無い点数（旧アーカイブに残りうる孤児）は破棄する。
   */
  const upsertScores = async (
    archiveItemId: string,
    courseworkItemId: string,
    roster: CourseworkRoster
  ): Promise<SkippedScoreCounts> => {
    const skipped: SkippedScoreCounts = { orphaned: 0, unresolved: 0 }
    for (const archiveScore of scoresByItem.get(archiveItemId) ?? []) {
      const courseworkStudentId = roster.byArchiveId.get(
        archiveScore.courseworkStudentId
      )
      if (!courseworkStudentId) {
        if (roster.unresolvedArchiveIds.has(archiveScore.courseworkStudentId)) {
          skipped.unresolved++
        } else {
          skipped.orphaned++
        }
        continue
      }
      const existing = await tx.courseworkScore.findUnique({
        where: {
          courseworkItemId_courseworkStudentId: {
            courseworkItemId,
            courseworkStudentId,
          },
        },
      })
      const payload = {
        score: archiveScore.score,
        letterValue: archiveScore.letterValue,
        adjustment: archiveScore.adjustment ?? 0,
        adjustmentReason: archiveScore.adjustmentReason,
        comment: archiveScore.comment,
      }
      if (existing) {
        if (
          isNewerByLww(new Date(archiveScore.updatedAt), existing.updatedAt)
        ) {
          await tx.courseworkScore.update({
            where: { id: existing.id },
            data: payload,
          })
        }
      } else {
        await tx.courseworkScore.create({
          data: { courseworkItemId, courseworkStudentId, ...payload },
        })
      }
    }
    return skipped
  }

  /** 評価項目を作成（変換表も投入）し実 ID を返す */
  const createItem = async (
    courseworkId: string,
    itemId: string | undefined,
    item: ArchiveCourseworkItemRow
  ): Promise<string> => {
    const letterScales = letterScalesByItem.get(item.id) ?? []
    const created = await tx.courseworkItem.create({
      data: {
        ...(itemId ? { id: itemId } : {}),
        courseworkId,
        name: item.name,
        order: item.order,
        maxScore: item.maxScore,
        inputMode: item.inputMode || "numeric",
        ...(letterScales.length > 0 && {
          letterScales: {
            create: letterScales.map((letterScale) => ({
              label: letterScale.label,
              score: letterScale.score,
              order: letterScale.order,
            })),
          },
        }),
      },
    })
    return created.id
  }

  /**
   * 学級・タグ・名簿の join を冪等に張り、点数の書き込み先となる名簿
   * （アーカイブの CourseworkStudent.id → 取り込み先の CourseworkStudent.id）を返す。
   *
   * 名簿行の id は取り込み先で新しく採番する。結合行そのものに外部から参照される
   * 意味は無く、旧アーカイブ由来の id は uuid ですらないため。
   */
  const ensureJoins = async (
    courseworkId: string,
    archiveCourseworkId: string
  ): Promise<CourseworkRoster> => {
    for (const classroomRef of classroomsByCoursework.get(
      archiveCourseworkId
    ) ?? []) {
      const classroomId = classes.map.get(classroomRef.classroomId)
      if (!classroomId) continue
      const exists = await tx.courseworkClassroom.findUnique({
        where: { courseworkId_classroomId: { courseworkId, classroomId } },
        select: { id: true },
      })
      if (!exists) {
        await tx.courseworkClassroom.create({
          data: { courseworkId, classroomId, order: classroomRef.order },
        })
      }
    }

    for (const tagRef of tagsByCoursework.get(archiveCourseworkId) ?? []) {
      const tagId = tagMap.get(tagRef.tagId)
      if (!tagId) continue
      const exists = await tx.courseworkTag.findUnique({
        where: { courseworkId_tagId: { courseworkId, tagId } },
        select: { id: true },
      })
      if (!exists) {
        await tx.courseworkTag.create({ data: { courseworkId, tagId } })
      }
    }

    /** アーカイブの対象者 id → 取り込み先の生徒 id（この後 DB の名簿と突き合わせる） */
    const archiveStudentIdByCourseworkStudent = new Map<string, string>()
    /** 名簿には居るが、取り込み先にその生徒が居なかった対象者 */
    const unresolvedArchiveIds = new Set<string>()
    for (const studentRef of studentsByCoursework.get(archiveCourseworkId) ??
      []) {
      const studentId = students.map.get(studentRef.studentId)
      if (!studentId) {
        unresolvedArchiveIds.add(studentRef.id)
        continue
      }
      archiveStudentIdByCourseworkStudent.set(studentRef.id, studentId)
      const exists = await tx.courseworkStudent.findUnique({
        where: { courseworkId_studentId: { courseworkId, studentId } },
        select: { id: true },
      })
      if (!exists) {
        await tx.courseworkStudent.create({
          data: {
            courseworkId,
            studentId,
            customOrder: studentRef.customOrder,
          },
        })
      }
    }

    // 既存資料への統合では、アーカイブの名簿に載っていない対象者が既に居ることがある。
    // 点数の宛先は DB の名簿が正なので、張り終えた後に全件を読み直す。
    const dbRoster = await tx.courseworkStudent.findMany({
      where: { courseworkId },
      select: { id: true, studentId: true },
    })
    const dbIdByStudent = new Map(
      dbRoster.map((courseworkStudent) => [
        courseworkStudent.studentId,
        courseworkStudent.id,
      ])
    )
    const byArchiveId = new Map<string, string>()
    for (const [
      archiveCourseworkStudentId,
      studentId,
    ] of archiveStudentIdByCourseworkStudent) {
      const dbCourseworkStudentId = dbIdByStudent.get(studentId)
      if (dbCourseworkStudentId) {
        byArchiveId.set(archiveCourseworkStudentId, dbCourseworkStudentId)
      } else {
        unresolvedArchiveIds.add(archiveCourseworkStudentId)
      }
    }
    return { byArchiveId, unresolvedArchiveIds }
  }

  /** 資料1件の評価項目と点数を取り込む。書き込めなかった点数の件数を返す */
  const importItems = async (
    coursework: ArchiveCourseworkRow,
    courseworkId: string,
    roster: CourseworkRoster,
    existingItemIdByName: Map<string, string>,
    preserveUuids: boolean
  ): Promise<SkippedScoreCounts> => {
    const skipped: SkippedScoreCounts = { orphaned: 0, unresolved: 0 }
    for (const item of itemsByCoursework.get(coursework.id) ?? []) {
      let actualItemId = existingItemIdByName.get(item.name)
      if (!actualItemId) {
        actualItemId = await createItem(
          courseworkId,
          preserveUuids ? item.id : randomUUID(),
          item
        )
      }
      const itemSkipped = await upsertScores(item.id, actualItemId, roster)
      skipped.orphaned += itemSkipped.orphaned
      skipped.unresolved += itemSkipped.unresolved
      itemIdMap.set(item.id, actualItemId)
    }
    return skipped
  }

  // 2. 資料本体
  for (const coursework of data.courseworks) {
    const decision = decisions[coursework.id]
    let reuseId: string | null = null

    if (decision?.action === "reuse") {
      const exists = await tx.coursework.findUnique({
        where: { id: decision.existingId },
        select: { id: true },
      })
      reuseId = exists?.id ?? null
      if (!reuseId) {
        warnings.push(
          `試験外成績資料「${coursework.name}」: 指定された統合先が見つからないため新規作成しました`
        )
      }
    } else if (!decision) {
      const uuidMatch = await tx.coursework.findUnique({
        where: { id: coursework.id },
        select: { id: true },
      })
      reuseId = uuidMatch?.id ?? null
    }

    if (reuseId) {
      // 既存資料へ統合: 名簿/学級/タグの不足を補い、項目は名前で突合、点数は LWW
      const roster = await ensureJoins(reuseId, coursework.id)
      const existing = await tx.coursework.findUnique({
        where: { id: reuseId },
        include: { items: { select: { id: true, name: true } } },
      })
      const existingItemIdByName = new Map(
        (existing?.items ?? []).map((item) => [item.name, item.id])
      )
      warnSkippedScores(
        coursework.name,
        await importItems(
          coursework,
          reuseId,
          roster,
          existingItemIdByName,
          false
        )
      )
      continue
    }

    // 新規作成。decision 未指定（uuid 不一致の初回取込）のみ元 uuid を保持して冪等化。
    const preserveUuids = !decision
    const newCourseworkId = preserveUuids ? coursework.id : randomUUID()
    const created = await tx.coursework.create({
      data: {
        id: newCourseworkId,
        name: coursework.name,
        description: coursework.description,
        date: coursework.date ? new Date(coursework.date) : null,
      },
    })
    createdCourseworkIds.push(created.id)
    const roster = await ensureJoins(created.id, coursework.id)
    warnSkippedScores(
      coursework.name,
      await importItems(
        coursework,
        created.id,
        roster,
        new Map(),
        preserveUuids
      )
    )
  }

  return { createdCourseworkIds, itemIdMap, warnings }
}
