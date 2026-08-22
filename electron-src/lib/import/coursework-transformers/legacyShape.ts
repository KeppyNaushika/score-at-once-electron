/**
 * v1.0.0（入れ子・射影形式）の資料データを、v1.1.0 の平坦なセクションへ展開する。
 *
 * .coursework 単体と、.grade が内包する資料の両方から使う（二重実装の回避）。
 *
 * 旧形式は結合行（学級・タグ・名簿・点数・変換表）の id を持たない。これらはいずれも
 * `@@unique` を持つ中間テーブルなので、自然キーから id を組み立てる
 * （同じアーカイブを何度読んでも同じ id になる＝冪等）。
 * 組み立てた id はアーカイブ内の結合キーとしてのみ使い、DB へは書き込まない
 * （import は名簿行を新しい uuid で作る）。
 */

import type {
  ArchiveCwClass,
  ArchiveCwMembership,
  ArchiveCwStudent,
  ArchiveCwTag,
  CollectedCourseworkData,
  CourseworkArchiveManifest,
  CourseworkExternalSections,
  CourseworkSections,
} from "../../../../src/types/courseworkArchive.types"
import type {
  ArchiveCourseworkRowV1_1_0,
  CollectedCourseworkDataV1_1_0,
} from "./types"

// =============================================================================
// v1.0.0 の形状定義（ここだけが知っていればよい負債）
// =============================================================================

/** v1.0.0 の資料1件（入れ子ツリー） */
export interface LegacyArchiveCourseworkRef {
  id: string
  name: string
  description: string | null
  date: string | null
  classrooms: { classroomId: string; order: number }[]
  tags: { tagId: string }[]
  students: { studentId: string; customOrder: number | null }[]
  items: LegacyArchiveCourseworkItemRef[]
}

/** v1.0.0 の評価項目（変換表・点数を内包） */
export interface LegacyArchiveCourseworkItemRef {
  id: string
  name: string
  order: number
  maxScore: number
  inputMode: string
  letterScales: { label: string; score: number; order: number }[]
  scores: LegacyArchiveCourseworkScoreRef[]
}

/** v1.0.0 の点数（人＝Student の uuid を指していた） */
interface LegacyArchiveCourseworkScoreRef {
  studentId: string
  score: number | null
  letterValue: string | null
  adjustment: number | null
  adjustmentReason: string | null
  comment: string | null
  updatedAt: string
}

/** grade-archive v1.5.0〜1.11.0 が内包していた入れ子形式の資料データ */
export interface LegacyCollectedCourseworkData {
  courseworks: LegacyArchiveCourseworkRef[]
  studentsData: ArchiveCwStudent[]
  classesData: ArchiveCwClass[]
  membershipsData: ArchiveCwMembership[]
  tagsData: ArchiveCwTag[]
  counts: CourseworkArchiveManifest["counts"]
}

/** 旧形式に無い作成・更新時刻の代わり。実際の値は失われているので下限値を使う */
const UNKNOWN_TIMESTAMP = new Date(0).toISOString()

/** 中間テーブルの id を自然キーから組み立てる（アーカイブ内でのみ使い、DBへは書かない） */
const joinIds = (parentId: string, childKey: string) =>
  `${parentId}:${childKey}`

/**
 * courseworks.json が v1.0.0 の入れ子ツリーかどうかを形で判定する。
 * v1.1.0 の Coursework 行は `items` を持たない。
 *
 * manifest.version は信用しない（version が実態とずれたアーカイブが実在したため。
 * exam の形状ベース検出と同じ理由）。
 */
export function isLegacyCourseworkTree(
  courseworksJson: unknown[]
): courseworksJson is LegacyArchiveCourseworkRef[] {
  const first = courseworksJson[0]
  return (
    typeof first === "object" &&
    first !== null &&
    "items" in first &&
    Array.isArray((first as { items: unknown }).items)
  )
}

/**
 * grade が内包する資料データが v1.5.0〜1.11.0 の入れ子形式かどうかを形で判定する。
 *
 * 判定は「現行のセクションが揃っているか」で行い、揃っていなければ旧形式とみなす。
 * 中身（`courseworks` の要素）で見分けようとすると、**資料を1件も参照していない成績**
 * — 収集器が常に空の内包資料を書き出すので、旧アーカイブの大多数がこれ — で
 * 空配列になり、新旧どちらとも判別できなくなる。
 */
export function isLegacyCollectedCourseworkData(
  value: unknown
): value is LegacyCollectedCourseworkData {
  if (typeof value !== "object" || value === null) return false
  if (!Array.isArray((value as { courseworks?: unknown }).courseworks)) {
    return false
  }
  return !isCurrentCollectedCourseworkData(value)
}

/**
 * 平坦なセクション（v1.1.0 以降）の形で内包されているか。
 * 全セクションが揃っていることを実際に確かめる。
 *
 * v1.1.0 と v1.2.0 の違いは資料1行の日付のキー名だけで、セクションの有無では見分けられない
 * （資料0件のアーカイブもある）。どちらかは変換器が決めるので、ここは総和で名乗る。
 */
export function isCurrentCollectedCourseworkData(
  value: unknown
): value is CollectedCourseworkData | CollectedCourseworkDataV1_1_0 {
  if (typeof value !== "object" || value === null) return false
  const sections = value as Record<string, unknown>
  const sectionKeys: (
    keyof CourseworkSections | keyof CourseworkExternalSections
  )[] = [
    "courseworks",
    "courseworkClassrooms",
    "courseworkTags",
    "courseworkStudents",
    "courseworkItems",
    "courseworkLetterScales",
    "courseworkScores",
    "studentsData",
    "classesData",
    "membershipsData",
    "tagsData",
  ]
  return (
    sectionKeys.every((key) => Array.isArray(sections[key])) &&
    typeof sections.counts === "object" &&
    sections.counts !== null
  )
}

/**
 * 展開の行き先は v1.1.0 のセクション（資料の日付キーは旧名 date のまま）。
 * date → referenceDate への改名は次の変換器（V1_1_0_to_V1_2_0）の仕事なので、
 * ここで先回りして現行の形にしてしまうと、鎖の途中の版が飛ばされる。
 */
interface CourseworkSectionsV1_1_0 extends Omit<
  CourseworkSections,
  "courseworks"
> {
  courseworks: ArchiveCourseworkRowV1_1_0[]
}

interface FlattenedLegacyCourseworks {
  sections: CourseworkSectionsV1_1_0
  /** 名簿に載っていない生徒の点数として破棄した件数 */
  discardedScoreCount: number
}

/**
 * 入れ子ツリーを平坦なセクションへ展開する。
 *
 * 点数は旧形式では人（Student）の uuid を指していた。名簿の対応行へ付け替え、
 * 名簿に載っていない生徒の点数（旧アーカイブに残りうる孤児）は破棄する。
 */
export function flattenLegacyCourseworks(
  legacyCourseworks: LegacyArchiveCourseworkRef[]
): FlattenedLegacyCourseworks {
  const sections: CourseworkSectionsV1_1_0 = {
    courseworks: [],
    courseworkClassrooms: [],
    courseworkTags: [],
    courseworkStudents: [],
    courseworkItems: [],
    courseworkLetterScales: [],
    courseworkScores: [],
  }
  let discardedScoreCount = 0

  for (const coursework of legacyCourseworks) {
    sections.courseworks.push({
      id: coursework.id,
      name: coursework.name,
      description: coursework.description,
      date: coursework.date,
      createdAt: UNKNOWN_TIMESTAMP,
      updatedAt: UNKNOWN_TIMESTAMP,
    })

    for (const classroomRef of coursework.classrooms) {
      sections.courseworkClassrooms.push({
        id: joinIds(coursework.id, classroomRef.classroomId),
        courseworkId: coursework.id,
        classroomId: classroomRef.classroomId,
        order: classroomRef.order,
        createdAt: UNKNOWN_TIMESTAMP,
        updatedAt: UNKNOWN_TIMESTAMP,
      })
    }

    for (const tagRef of coursework.tags) {
      sections.courseworkTags.push({
        id: joinIds(coursework.id, tagRef.tagId),
        courseworkId: coursework.id,
        tagId: tagRef.tagId,
        createdAt: UNKNOWN_TIMESTAMP,
        updatedAt: UNKNOWN_TIMESTAMP,
      })
    }

    /** 旧形式の点数が指していた studentId → 展開後の対象者 id */
    const courseworkStudentIdByStudent = new Map<string, string>()
    for (const studentRef of coursework.students) {
      const courseworkStudentId = joinIds(coursework.id, studentRef.studentId)
      courseworkStudentIdByStudent.set(
        studentRef.studentId,
        courseworkStudentId
      )
      sections.courseworkStudents.push({
        id: courseworkStudentId,
        courseworkId: coursework.id,
        studentId: studentRef.studentId,
        customOrder: studentRef.customOrder,
        createdAt: UNKNOWN_TIMESTAMP,
        updatedAt: UNKNOWN_TIMESTAMP,
      })
    }

    for (const item of coursework.items) {
      sections.courseworkItems.push({
        id: item.id,
        courseworkId: coursework.id,
        name: item.name,
        order: item.order,
        maxScore: String(item.maxScore),
        inputMode: item.inputMode || "numeric",
        createdAt: UNKNOWN_TIMESTAMP,
        updatedAt: UNKNOWN_TIMESTAMP,
      })
      discardedScoreCount += flattenLegacyItemChildren(
        sections,
        item,
        courseworkStudentIdByStudent
      )
    }
  }

  return { sections, discardedScoreCount }
}

/** 評価項目の変換表・点数を展開し、破棄した点数の件数を返す */
function flattenLegacyItemChildren(
  sections: CourseworkSectionsV1_1_0,
  item: LegacyArchiveCourseworkItemRef,
  courseworkStudentIdByStudent: Map<string, string>
): number {
  for (const letterScale of item.letterScales) {
    sections.courseworkLetterScales.push({
      id: joinIds(item.id, letterScale.label),
      courseworkItemId: item.id,
      label: letterScale.label,
      score: String(letterScale.score),
      order: letterScale.order,
      createdAt: UNKNOWN_TIMESTAMP,
      updatedAt: UNKNOWN_TIMESTAMP,
    })
  }

  let discarded = 0
  for (const score of item.scores) {
    const courseworkStudentId = courseworkStudentIdByStudent.get(
      score.studentId
    )
    if (!courseworkStudentId) {
      discarded++
      continue
    }
    sections.courseworkScores.push({
      id: joinIds(item.id, courseworkStudentId),
      courseworkItemId: item.id,
      courseworkStudentId,
      score: score.score === null ? null : String(score.score),
      letterValue: score.letterValue,
      adjustment: score.adjustment === null ? null : String(score.adjustment),
      adjustmentReason: score.adjustmentReason,
      comment: score.comment,
      createdAt: UNKNOWN_TIMESTAMP,
      updatedAt: score.updatedAt,
    })
  }
  return discarded
}
