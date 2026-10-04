/**
 * 書き出しダイアログが実体の名前を引く表
 *
 * 下見（main）は id だけを返すので、名前は既存の一覧 query の結果から引く。同じ表から、
 * 一覧に足すときの Combobox の選択肢（番号・カナ・日付でも引ける）も作る。
 */

import type { Classroom, Student } from "@prisma/client"

import type { ComboboxOption } from "@/components/common/Combobox"
import {
  classroomSearchKeywords,
  dateSearchKeywords,
  studentOption,
} from "@/lib/searchKeywords"

import { archiveTableLabel } from "../archiveTableLabels"
import type { ArchiveEntityKind } from "./types"

/** 名前と日付を持つ実体（試験だけ名前の列が `examName`） */
interface NamedEntitySource {
  id: string
  name: string
  referenceDate?: Date | string | null
}

/** 一覧 query の結果。まだ届いていない一覧は空で渡す */
export interface ArchiveEntitySources {
  exams: readonly {
    id: string
    examName: string
    referenceDate: Date | string | null
  }[]
  courseworks: readonly NamedEntitySource[]
  grades: readonly NamedEntitySource[]
  answerSheetDefinitions: readonly NamedEntitySource[]
  students: readonly (Pick<
    Student,
    | "lastName"
    | "firstName"
    | "lastNameKana"
    | "firstNameKana"
    | "studentNumber"
  > & { id: string })[]
  classrooms: readonly Classroom[]
  subtotalGroups: readonly { id: string; name: string }[]
  tags: readonly { id: string; name: string }[]
  users: readonly { id: string; name: string }[]
}

/** 種 → (id → 選択肢)。選択肢の並びは一覧 query の並びのまま */
export type ArchiveEntityCatalog = Record<
  ArchiveEntityKind,
  ReadonlyMap<string, ComboboxOption>
>

const toOptionMap = (
  options: readonly ComboboxOption[]
): ReadonlyMap<string, ComboboxOption> =>
  new Map(options.map((option) => [option.value, option]))

const namedOption = (entity: NamedEntitySource): ComboboxOption => ({
  value: entity.id,
  label: entity.name,
  keywords: dateSearchKeywords(entity.referenceDate),
})

/** 一覧 query の結果から、名前を引く表を作る */
export function buildArchiveEntityCatalog(
  sources: ArchiveEntitySources
): ArchiveEntityCatalog {
  return {
    Exam: toOptionMap(
      sources.exams.map((exam) =>
        namedOption({
          id: exam.id,
          name: exam.examName,
          referenceDate: exam.referenceDate,
        })
      )
    ),
    Coursework: toOptionMap(sources.courseworks.map(namedOption)),
    Grade: toOptionMap(sources.grades.map(namedOption)),
    AsbDefinition: toOptionMap(sources.answerSheetDefinitions.map(namedOption)),
    Student: toOptionMap(
      sources.students.map((student) => studentOption(student.id, student))
    ),
    Classroom: toOptionMap(
      sources.classrooms.map((classroom) => ({
        value: classroom.id,
        label:
          classroom.isVisible === false
            ? `${classroom.name}（非表示）`
            : classroom.name,
        keywords: classroomSearchKeywords(classroom),
      }))
    ),
    SubtotalGroup: toOptionMap(
      sources.subtotalGroups.map((subtotalGroup) => ({
        value: subtotalGroup.id,
        label: subtotalGroup.name,
      }))
    ),
    Tag: toOptionMap(
      sources.tags.map((tag) => ({ value: tag.id, label: tag.name }))
    ),
    User: toOptionMap(
      sources.users.map((user) => ({ value: user.id, label: user.name }))
    ),
  }
}

/**
 * 実体の名前。一覧に無ければ（自分が見られない試験・まだ届いていない一覧）、種の名前で
 * 「一覧に無い試験」と出す
 */
export function archiveEntityLabel(
  catalog: ArchiveEntityCatalog,
  kind: ArchiveEntityKind,
  id: string
): string {
  return (
    catalog[kind].get(id)?.label ?? `（一覧に無い${archiveTableLabel(kind)}）`
  )
}
