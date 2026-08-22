/**
 * 試験外成績資料アーカイブの DB 反映（核心）
 *
 * - 外部参照（生徒/学級/タグ）は idRemapper で UUID 一次 + 名前マッチング解決。
 * - 資料本体は UUID 一次照合（decision 未指定）/ ユーザー判断（reuse/new）で流用 or 新規。
 * - 値の扱いは merge/importValuePolicy に一本化されている（上書きする / 統合する /
 *   別で追加する）。資料本体・評価項目・変換表・名簿・点数のどれも同じ規則で決まる。
 *
 * アーカイブはテーブルごとの平坦なセクションで来るので、courseworkId / courseworkItemId で
 * 束ね直してから資料単位に処理する。
 *
 * grade-archive はこの importCourseworkData をトランザクション内で呼び出して内包する。
 */

import * as crypto from "crypto"

import type {
  ArchiveCourseworkItemRow,
  ArchiveCourseworkRow,
  CourseworkArchiveData,
  CourseworkImportOptions,
} from "../../../../src/types/courseworkArchive.types"
import type { TransactionClient } from "../exam-archive/uniqueNameGenerators"
import type { ImportValuePolicy } from "../merge/importValuePolicy"
import {
  createImportValuePolicy,
  replacementUpdatedAt,
} from "../merge/importValuePolicy"
import {
  reorderCourseworkClassrooms,
  reorderCourseworkItems,
  reorderCourseworkStudents,
} from "../merge/reorderAfterImport"
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
  // 取り込みの方針。省略時は統合（従来の挙動＝点数だけ LWW）
  const policy: ImportValuePolicy = createImportValuePolicy(
    options.action ?? "merge"
  )
  /**
   * 行が増えた資料。並び順は列全体の性質なので、行ごとに入れた値には重複と穴ができる。
   * **増えたときだけ**、最後にその資料の名簿・評価項目・学級を詰め直す
   * （毎回やると触っていない並びまで書き換えて updatedAt が動く）。
   */
  const courseworkIdsWithNewStudents = new Set<string>()
  const courseworkIdsWithNewClassrooms = new Set<string>()
  const courseworkIdsWithNewItems = new Set<string>()
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
        const updatedAt = replacementUpdatedAt(
          policy,
          archiveScore.updatedAt,
          existing.updatedAt
        )
        if (updatedAt) {
          await tx.courseworkScore.update({
            where: { id: existing.id },
            data: { ...payload, updatedAt },
          })
        }
      } else {
        await tx.courseworkScore.create({
          data: {
            courseworkItemId,
            courseworkStudentId,
            ...payload,
            ...policy.createdTimestamps(archiveScore),
          },
        })
      }
    }
    return skipped
  }

  /**
   * 既にある資料の列を規則に従って書き換える。
   *
   * Coursework の列は id / name / description / date / createdAt / updatedAt で全部。
   * id と createdAt は動かさない。列を足したらここにも足すこと。
   */
  const applyCourseworkColumns = async (
    courseworkId: string,
    coursework: ArchiveCourseworkRow
  ): Promise<void> => {
    const existing = await tx.coursework.findUnique({
      where: { id: courseworkId },
    })
    if (!existing) return

    const updatedAt = replacementUpdatedAt(
      policy,
      coursework.updatedAt,
      existing.updatedAt
    )
    if (!updatedAt) return

    await tx.coursework.update({
      where: { id: courseworkId },
      data: {
        name: coursework.name,
        description: coursework.description,
        referenceDate: coursework.referenceDate
          ? new Date(coursework.referenceDate)
          : null,
        updatedAt,
      },
    })
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
              ...policy.createdTimestamps(letterScale),
            })),
          },
        }),
        ...policy.createdTimestamps(item),
      },
    })
    return created.id
  }

  /**
   * 既にある評価項目の列を規則に従って書き換える。
   *
   * CourseworkItem の列は id / courseworkId / name / order / maxScore / inputMode /
   * createdAt / updatedAt で全部。**変換表（letterScales）はこの項目の持ち物の集合**
   * なので、行ごとではなく項目ごと入れ替える（行ごとに当てると増減したときに
   * 古い記号が残り、半分古い表ができる）。
   */
  const applyItemColumns = async (
    courseworkItemId: string,
    item: ArchiveCourseworkItemRow
  ): Promise<void> => {
    const existing = await tx.courseworkItem.findUnique({
      where: { id: courseworkItemId },
    })
    if (!existing) return

    const updatedAt = replacementUpdatedAt(
      policy,
      item.updatedAt,
      existing.updatedAt
    )
    if (!updatedAt) return

    await tx.courseworkItem.update({
      where: { id: courseworkItemId },
      data: {
        name: item.name,
        // 並び順は取り込みの最後に詰め直す（列全体の性質なので行ごとには決められない）
        order: item.order,
        maxScore: item.maxScore,
        inputMode: item.inputMode || "numeric",
        updatedAt,
      },
    })

    await tx.courseworkLetterScale.deleteMany({
      where: { courseworkItemId },
    })
    for (const letterScale of letterScalesByItem.get(item.id) ?? []) {
      await tx.courseworkLetterScale.create({
        data: {
          courseworkItemId,
          label: letterScale.label,
          score: letterScale.score,
          order: letterScale.order,
          ...policy.createdTimestamps(letterScale),
        },
      })
    }
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
      })
      if (exists) {
        const updatedAt = replacementUpdatedAt(
          policy,
          classroomRef.updatedAt,
          exists.updatedAt
        )
        if (updatedAt) {
          await tx.courseworkClassroom.update({
            where: { id: exists.id },
            // 並び順は取り込みの最後に詰め直す
            data: { order: classroomRef.order, updatedAt },
          })
        }
      } else {
        await tx.courseworkClassroom.create({
          data: {
            courseworkId,
            classroomId,
            order: classroomRef.order,
            ...policy.createdTimestamps(classroomRef),
          },
        })
        courseworkIdsWithNewClassrooms.add(courseworkId)
      }
    }

    for (const tagRef of tagsByCoursework.get(archiveCourseworkId) ?? []) {
      const tagId = tagMap.get(tagRef.tagId)
      if (!tagId) continue
      const exists = await tx.courseworkTag.findUnique({
        where: { courseworkId_tagId: { courseworkId, tagId } },
      })
      if (!exists) {
        await tx.courseworkTag.create({
          data: {
            courseworkId,
            tagId,
            ...policy.createdTimestamps(tagRef),
          },
        })
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
      })
      if (exists) {
        const updatedAt = replacementUpdatedAt(
          policy,
          studentRef.updatedAt,
          exists.updatedAt
        )
        if (updatedAt) {
          await tx.courseworkStudent.update({
            where: { id: exists.id },
            // 並び順は取り込みの最後に詰め直す
            data: { customOrder: studentRef.customOrder, updatedAt },
          })
        }
      } else {
        await tx.courseworkStudent.create({
          data: {
            courseworkId,
            studentId,
            customOrder: studentRef.customOrder,
            ...policy.createdTimestamps(studentRef),
          },
        })
        courseworkIdsWithNewStudents.add(courseworkId)
      }
    }

    // 既存資料への統合では、アーカイブの名簿に載っていない対象者が既に居ることがある。
    // 点数の宛先は DB の名簿が正なので、張り終えた後に全件を読み直す。
    const dbRoster = await tx.courseworkStudent.findMany({
      where: { courseworkId },
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
      if (actualItemId) {
        await applyItemColumns(actualItemId, item)
      } else {
        actualItemId = await createItem(
          courseworkId,
          preserveUuids ? item.id : crypto.randomUUID(),
          item
        )
        courseworkIdsWithNewItems.add(courseworkId)
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
      })
      reuseId = uuidMatch?.id ?? null
    }

    if (reuseId) {
      // 既存資料へ: 名簿/学級/タグの不足を補い、項目は名前で突合。
      // 値を置き換えるかどうかは取り込みの方針が決める
      await applyCourseworkColumns(reuseId, coursework)
      const roster = await ensureJoins(reuseId, coursework.id)
      const existing = await tx.coursework.findUnique({
        where: { id: reuseId },
        include: { items: true },
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
    const newCourseworkId = preserveUuids ? coursework.id : crypto.randomUUID()
    const created = await tx.coursework.create({
      data: {
        id: newCourseworkId,
        name: coursework.name,
        description: coursework.description,
        referenceDate: coursework.referenceDate
          ? new Date(coursework.referenceDate)
          : null,
        ...policy.createdTimestamps(coursework),
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

  // 行が増えた資料だけ、並び順をまるごと詰め直す
  for (const courseworkId of courseworkIdsWithNewStudents) {
    await reorderCourseworkStudents(courseworkId, tx)
  }
  for (const courseworkId of courseworkIdsWithNewItems) {
    await reorderCourseworkItems(courseworkId, tx)
  }
  for (const courseworkId of courseworkIdsWithNewClassrooms) {
    await reorderCourseworkClassrooms(courseworkId, tx)
  }

  return { createdCourseworkIds, itemIdMap, warnings }
}
