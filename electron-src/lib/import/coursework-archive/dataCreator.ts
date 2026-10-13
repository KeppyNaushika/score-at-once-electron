/**
 * 試験外成績資料アーカイブの DB 反映（核心）
 *
 * - 外部参照（生徒/学級/タグ）は idRemapper で id 一次 + 名前マッチング解決。
 * - **id が一致すれば同じ行。** 資料本体・評価項目・変換表・名簿・学級・タグの結び付き・点数の
 *   どれも、まずアーカイブの id で取り込み先を引き、在れば同じ行として規則どおり値を書く。
 *   資料は id が無いときだけ人の判断（既存の資料に取り込む / 新規）を当てる。新しく作る行は
 *   アーカイブの id で作る（旧形式の合成 id は使わない）。
 * - 既存の資料に取り込み「アーカイブの id に合わせる」を選んだ資料は、全てを取り込み先の
 *   id で書き終えてから、資料の id をアーカイブの id へ付け替える（archiveIdRenamer）。
 * - 値の扱いは merge/importValuePolicy に一本化されている（上書きする / 統合する /
 *   別で追加する）。資料本体・評価項目・変換表・名簿・点数のどれも同じ規則で決まる。
 *
 * アーカイブはテーブルごとの平坦なセクションで来るので、courseworkId / courseworkItemId で
 * 束ね直してから資料単位に処理する。
 *
 * grade-archive はこの importCourseworkData をトランザクション内で呼び出して内包する。
 */

import type { Prisma } from "@prisma/client"

import type {
  ArchiveCourseworkItemRow,
  ArchiveCourseworkRow,
  CourseworkArchiveData,
  CourseworkImportOptions,
} from "../../../../src/types/courseworkArchive.types"
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
import { isUuid, writeIdFirstRow } from "../shared/idFirstRow"
import { renameTargetRow } from "../unified-archive/archiveIdRenamer"
import { prismaArchiveTarget } from "../unified-archive/archiveRowImporter"
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
  tx: Prisma.TransactionClient,
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
   * 並び順の列へ書き込んだ資料。並び順は列全体の性質なので、行ごとに入れた値には
   * 重複と穴ができる。**書き込んだときだけ**、最後にその資料の名簿・評価項目・学級を
   * 詰め直す（毎回やると触っていない並びまで書き換えて updatedAt が動く）。
   *
   * **作成だけでなく更新も数える。** 上書き／統合は既存行の customOrder / order も
   * アーカイブの値へ書き換えるので、行が1つも増えない取り込みでも番号は重なったまま残る。
   */
  const courseworkIdsWithStudentOrderWritten = new Set<string>()
  const courseworkIdsWithClassroomOrderWritten = new Set<string>()
  const courseworkIdsWithItemOrderWritten = new Set<string>()
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
    policy,
  })
  warnings.push(...students.warnings)
  const classes = await resolveClassrooms(tx, data.classesData, {
    allowCreate,
    policy,
  })
  warnings.push(...classes.warnings)
  const tagMap = await resolveTags(tx, data.tagsData, policy)
  if (allowCreate) {
    await restoreMemberships(
      tx,
      data.membershipsData,
      students.map,
      classes.map,
      students.createdIds,
      policy
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
        `試験外成績資料「${courseworkName}」: 対象生徒として登録されていない生徒の得点 ${skipped.orphaned} 件を破棄しました`
      )
    }
    if (skipped.unresolved > 0) {
      warnings.push(
        `試験外成績資料「${courseworkName}」: この環境に存在しない生徒の得点 ${skipped.unresolved} 件を取り込めませんでした`
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
      const cellKey = { courseworkItemId, courseworkStudentId }
      const payload = {
        score: archiveScore.score,
        letterValue: archiveScore.letterValue,
        adjustment: archiveScore.adjustment ?? 0,
        adjustmentReason: archiveScore.adjustmentReason,
        comment: archiveScore.comment,
      }
      await writeIdFirstRow({
        archiveId: archiveScore.id,
        archiveUpdatedAt: archiveScore.updatedAt,
        policy,
        findById: (id) => tx.courseworkScore.findUnique({ where: { id } }),
        findByKey: () =>
          tx.courseworkScore.findUnique({
            where: { courseworkItemId_courseworkStudentId: cellKey },
          }),
        create: (id) =>
          tx.courseworkScore.create({
            data: {
              ...(id ? { id } : {}),
              ...cellKey,
              ...payload,
              ...policy.createdTimestamps(archiveScore),
            },
          }),
        update: (existing, updatedAt, writeKey) =>
          tx.courseworkScore.update({
            where: { id: existing.id },
            data: { ...(writeKey ? cellKey : {}), ...payload, updatedAt },
          }),
      })
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

  /**
   * 評価項目の変換表を、アーカイブの変換表で入れ替える（変換表は項目の持ち物の集合なので、
   * 行ごとではなく項目ごと入れ替える。行ごとに当てると増減したときに古い記号が残る）。
   * アーカイブの記号の id が取り込み先の別の項目の下に在れば、それは同じ行なので、
   * この項目へ移して値を書く
   */
  const replaceLetterScales = async (
    courseworkItemId: string,
    archiveItemId: string
  ): Promise<void> => {
    await tx.courseworkLetterScale.deleteMany({ where: { courseworkItemId } })
    for (const letterScale of letterScalesByItem.get(archiveItemId) ?? []) {
      const values = {
        courseworkItemId,
        label: letterScale.label,
        score: letterScale.score,
        order: letterScale.order,
      }
      const byId = isUuid(letterScale.id)
        ? await tx.courseworkLetterScale.findUnique({
            where: { id: letterScale.id },
          })
        : null
      if (byId) {
        await tx.courseworkLetterScale.update({
          where: { id: byId.id },
          data: {
            ...values,
            updatedAt: policy.replacedUpdatedAt(
              new Date(letterScale.updatedAt)
            ),
          },
        })
        continue
      }
      await tx.courseworkLetterScale.create({
        data: {
          ...(isUuid(letterScale.id) ? { id: letterScale.id } : {}),
          ...values,
          ...policy.createdTimestamps(letterScale),
        },
      })
    }
  }

  /**
   * 評価項目を1つ書き、取り込み先の id を返す。
   *
   * CourseworkItem の列は id / courseworkId / name / order / maxScore / inputMode /
   * createdAt / updatedAt で全部。id が一致すれば同じ項目（親の資料も書く）。
   * id で無ければ `sameNameItemId`（既存の資料に取り込むとき、名前で当たった項目）へ寄せ、
   * それも無ければアーカイブの id で作る。
   */
  const writeItem = async (
    courseworkId: string,
    item: ArchiveCourseworkItemRow,
    sameNameItemId: string | undefined
  ): Promise<string> => {
    const values = {
      courseworkId,
      name: item.name,
      // 並び順は取り込みの最後に詰め直す（列全体の性質なので行ごとには決められない）
      order: item.order,
      maxScore: item.maxScore,
      inputMode: item.inputMode || "numeric",
    }
    const written = await writeIdFirstRow({
      archiveId: item.id,
      archiveUpdatedAt: item.updatedAt,
      policy,
      findById: (id) => tx.courseworkItem.findUnique({ where: { id } }),
      findByKey: async () =>
        sameNameItemId
          ? tx.courseworkItem.findUnique({ where: { id: sameNameItemId } })
          : null,
      create: (id) =>
        tx.courseworkItem.create({
          data: {
            ...(id ? { id } : {}),
            ...values,
            ...policy.createdTimestamps(item),
          },
        }),
      update: (existing, updatedAt) =>
        tx.courseworkItem.update({
          where: { id: existing.id },
          data: { ...values, updatedAt },
        }),
    })
    if (written.kind !== "kept") {
      await replaceLetterScales(written.targetId, item.id)
      courseworkIdsWithItemOrderWritten.add(courseworkId)
    }
    return written.targetId
  }

  /**
   * 学級・タグ・名簿の join を冪等に張り、点数の書き込み先となる名簿
   * （アーカイブの CourseworkStudent.id → 取り込み先の CourseworkStudent.id）を返す。
   *
   * どの結び付きも id が一致すれば同じ行、無ければ一意キー（資料と学級など）で引き、
   * それも無ければアーカイブの id で作る（旧形式の合成 id は使わない）。
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
      const pairKey = { courseworkId, classroomId }
      const written = await writeIdFirstRow({
        archiveId: classroomRef.id,
        archiveUpdatedAt: classroomRef.updatedAt,
        policy,
        findById: (id) => tx.courseworkClassroom.findUnique({ where: { id } }),
        findByKey: () =>
          tx.courseworkClassroom.findUnique({
            where: { courseworkId_classroomId: pairKey },
          }),
        create: (id) =>
          tx.courseworkClassroom.create({
            data: {
              ...(id ? { id } : {}),
              ...pairKey,
              order: classroomRef.order,
              ...policy.createdTimestamps(classroomRef),
            },
          }),
        update: (existing, updatedAt, writeKey) =>
          tx.courseworkClassroom.update({
            where: { id: existing.id },
            // 並び順は取り込みの最後に詰め直す
            data: {
              ...(writeKey ? pairKey : {}),
              order: classroomRef.order,
              updatedAt,
            },
          }),
      })
      if (written.kind !== "kept") {
        courseworkIdsWithClassroomOrderWritten.add(courseworkId)
      }
    }

    for (const tagRef of tagsByCoursework.get(archiveCourseworkId) ?? []) {
      const tagId = tagMap.get(tagRef.tagId)
      if (!tagId) continue
      const pairKey = { courseworkId, tagId }
      await writeIdFirstRow({
        archiveId: tagRef.id,
        archiveUpdatedAt: tagRef.updatedAt,
        policy,
        findById: (id) => tx.courseworkTag.findUnique({ where: { id } }),
        findByKey: () =>
          tx.courseworkTag.findUnique({
            where: { courseworkId_tagId: pairKey },
          }),
        create: (id) =>
          tx.courseworkTag.create({
            data: {
              ...(id ? { id } : {}),
              ...pairKey,
              ...policy.createdTimestamps(tagRef),
            },
          }),
        update: (existing, updatedAt, writeKey) =>
          tx.courseworkTag.update({
            where: { id: existing.id },
            data: { ...(writeKey ? pairKey : {}), updatedAt },
          }),
      })
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
      const pairKey = { courseworkId, studentId }
      const written = await writeIdFirstRow({
        archiveId: studentRef.id,
        archiveUpdatedAt: studentRef.updatedAt,
        policy,
        findById: (id) => tx.courseworkStudent.findUnique({ where: { id } }),
        findByKey: () =>
          tx.courseworkStudent.findUnique({
            where: { courseworkId_studentId: pairKey },
          }),
        create: (id) =>
          tx.courseworkStudent.create({
            data: {
              ...(id ? { id } : {}),
              ...pairKey,
              customOrder: studentRef.customOrder,
              ...policy.createdTimestamps(studentRef),
            },
          }),
        update: (existing, updatedAt, writeKey) =>
          tx.courseworkStudent.update({
            where: { id: existing.id },
            // 並び順は取り込みの最後に詰め直す
            data: {
              ...(writeKey ? pairKey : {}),
              customOrder: studentRef.customOrder,
              updatedAt,
            },
          }),
      })
      if (written.kind !== "kept") {
        courseworkIdsWithStudentOrderWritten.add(courseworkId)
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

  /**
   * 資料1件の評価項目と点数を取り込む。書き込めなかった点数の件数を返す。
   *
   * `existingItems` は既存の資料に取り込むときの、その資料の項目。id で一致しなかった項目は
   * 名前で寄せる（同じ名前が複数あればいちばん古いもの）。アーカイブの別の項目が id で取った
   * 項目と、この取り込みで既に寄せた項目は候補にしない
   */
  const importItems = async (
    coursework: ArchiveCourseworkRow,
    courseworkId: string,
    roster: CourseworkRoster,
    existingItems: { id: string; name: string; createdAt: Date }[]
  ): Promise<SkippedScoreCounts> => {
    const skipped: SkippedScoreCounts = { orphaned: 0, unresolved: 0 }
    const archiveItemIds = new Set(data.courseworkItems.map((item) => item.id))
    const claimedItemIds = new Set<string>()
    for (const item of itemsByCoursework.get(coursework.id) ?? []) {
      const sameNameItem = [...existingItems]
        .filter(
          (existingItem) =>
            existingItem.name === item.name &&
            !archiveItemIds.has(existingItem.id) &&
            !claimedItemIds.has(existingItem.id)
        )
        .sort(
          (left, right) => left.createdAt.getTime() - right.createdAt.getTime()
        )[0]
      const actualItemId = await writeItem(courseworkId, item, sameNameItem?.id)
      claimedItemIds.add(actualItemId)
      const itemSkipped = await upsertScores(item.id, actualItemId, roster)
      skipped.orphaned += itemSkipped.orphaned
      skipped.unresolved += itemSkipped.unresolved
      itemIdMap.set(item.id, actualItemId)
    }
    return skipped
  }

  /** 全て書き終えてから、取り込み先の資料の id をアーカイブの id へ付け替える予約 */
  const pendingRenames: { fromId: string; toId: string }[] = []

  // 2. 資料本体
  for (const coursework of data.courseworks) {
    // id が一致すれば同じ資料（人の判断は見ない）
    const idMatch = isUuid(coursework.id)
      ? await tx.coursework.findUnique({ where: { id: coursework.id } })
      : null
    const decision = idMatch ? undefined : decisions[coursework.id]
    let reuseId: string | null = idMatch?.id ?? null

    if (decision?.action === "reuse") {
      const exists = await tx.coursework.findUnique({
        where: { id: decision.existingId },
      })
      reuseId = exists?.id ?? null
      if (!reuseId) {
        warnings.push(
          `試験外成績資料「${coursework.name}」: 指定された取り込み先が見つからないため新規作成しました`
        )
      } else if (decision.adoptId === "archive" && isUuid(coursework.id)) {
        pendingRenames.push({ fromId: reuseId, toId: coursework.id })
      }
    }

    if (reuseId) {
      // 既存資料へ: 名簿/学級/タグの不足を補い、項目は id → 名前で突合。
      // 値を置き換えるかどうかは取り込みの方針が決める
      await applyCourseworkColumns(reuseId, coursework)
      const roster = await ensureJoins(reuseId, coursework.id)
      const existingItems = await tx.courseworkItem.findMany({
        where: { courseworkId: reuseId },
      })
      warnSkippedScores(
        coursework.name,
        await importItems(coursework, reuseId, roster, existingItems)
      )
      continue
    }

    // 新規作成。アーカイブの id で作る（旧形式の合成 id のときだけ取り込み先で振る）
    const created = await tx.coursework.create({
      data: {
        ...(isUuid(coursework.id) ? { id: coursework.id } : {}),
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
      await importItems(coursework, created.id, roster, [])
    )
  }

  // 並び順の列へ書き込んだ資料だけ、並び順をまるごと詰め直す
  for (const courseworkId of courseworkIdsWithStudentOrderWritten) {
    await reorderCourseworkStudents(courseworkId, tx)
  }
  for (const courseworkId of courseworkIdsWithItemOrderWritten) {
    await reorderCourseworkItems(courseworkId, tx)
  }
  for (const courseworkId of courseworkIdsWithClassroomOrderWritten) {
    await reorderCourseworkClassrooms(courseworkId, tx)
  }

  // 「アーカイブの id に合わせる」を選んだ資料は、ここまで取り込み先の id で書いてある。
  // 最後に id だけを変える（資料を参照する行の外部キーも付け替わる）
  if (pendingRenames.length > 0) {
    const target = prismaArchiveTarget(tx)
    await target.execute("PRAGMA defer_foreign_keys = ON", [])
    for (const rename of pendingRenames) {
      if (await tx.coursework.findUnique({ where: { id: rename.toId } })) {
        warnings.push(
          `アーカイブの資料の id（${rename.toId}）が既に使われているため、このPCの id のままにしました`
        )
        continue
      }
      await renameTargetRow(
        target,
        "Coursework",
        rename.fromId,
        rename.toId,
        warnings
      )
    }
  }

  return { createdCourseworkIds, itemIdMap, warnings }
}
