/**
 * grade-archive 1.4.0 → 1.5.0
 *
 * v1.4.0 の名前ベース埋め込み資料（courseworks）を、v1.5.0 の coursework-archive 形式
 * （UUIDベース・full レコード同梱の courseworkArchive）へ正規化する。
 *
 * 旧形式は studentNumber/classroomName/tagName しか持たないため、UUID を持つ full レコードは
 * 作れない。そこで「名前キーの synthetic レコード」を生成し、実際の名前→既存実体の解決は
 * 後段の importCourseworkData（grade では allowCreate=false の lookup-only）へ委ねる。
 * scores の updatedAt はエポックにし、LWW で既存スコアを上書きしない（旧挙動を維持）。
 */

import type {
  ArchiveCourseworkRef,
  ArchiveCwClass,
  ArchiveCwStudent,
  ArchiveCwTag,
  CollectedCourseworkData,
} from "../../../../src/types/courseworkArchive.types"
import type {
  GradeArchiveData,
  GradeTransformResult,
  GradeVersionTransformer,
} from "../../../../src/types/gradeArchive.types"

/** LWW で既存を上書きしないための過去日時 */
const EPOCH = new Date(0).toISOString()

const synthStudentId = (studentNumber: string) =>
  `legacy-student:${studentNumber}`
const synthClassId = (classroomName: string) =>
  `legacy-classroom:${classroomName}`
const synthTagId = (tagName: string) => `legacy-tag:${tagName}`

export class V1_4_0_to_V1_5_0_Transformer implements GradeVersionTransformer {
  readonly fromVersion = "1.4.0" as const
  readonly toVersion = "1.5.0" as const

  transform(data: GradeArchiveData): GradeTransformResult {
    const legacy = data.courseworks ?? []

    const studentNumbers = new Set<string>()
    const classNames = new Set<string>()
    const tagNames = new Set<string>()
    for (const cw of legacy) {
      cw.students.forEach((s) => studentNumbers.add(s.studentNumber))
      cw.classrooms.forEach((c) => classNames.add(c.classroomName))
      cw.tags.forEach((t) => tagNames.add(t.tagName))
      cw.items.forEach((item) =>
        item.scores.forEach((sc) => studentNumbers.add(sc.studentNumber))
      )
    }

    const studentsData: ArchiveCwStudent[] = [...studentNumbers].map((sn) => ({
      id: synthStudentId(sn),
      studentNumber: sn,
      lastName: "",
      firstName: "",
      lastNameKana: "",
      firstNameKana: "",
      enrollmentYear: null,
      updatedAt: EPOCH,
    }))
    const classesData: ArchiveCwClass[] = [...classNames].map((name) => ({
      id: synthClassId(name),
      name,
      classCode: null,
      grade: null,
      description: null,
      isVisible: true,
    }))
    const tagsData: ArchiveCwTag[] = [...tagNames].map((name) => ({
      id: synthTagId(name),
      name,
      order: 0,
      color: null,
    }))

    const courseworks: ArchiveCourseworkRef[] = legacy.map((cw) => ({
      id: cw.id,
      name: cw.name,
      description: cw.description,
      date: cw.date,
      classrooms: cw.classrooms.map((c) => ({
        classroomId: synthClassId(c.classroomName),
        order: c.order,
      })),
      tags: cw.tags.map((t) => ({ tagId: synthTagId(t.tagName) })),
      students: cw.students.map((s) => ({
        studentId: synthStudentId(s.studentNumber),
        customOrder: s.customOrder,
      })),
      items: cw.items.map((item) => ({
        id: item.id,
        name: item.name,
        order: item.order,
        maxScore: item.maxScore,
        inputMode: item.inputMode,
        letterScales: item.letterScales,
        scores: item.scores.map((sc) => ({
          studentId: synthStudentId(sc.studentNumber),
          score: sc.score,
          letterValue: sc.letterValue,
          adjustment: sc.adjustment,
          adjustmentReason: sc.adjustmentReason,
          comment: sc.comment,
          updatedAt: EPOCH,
        })),
      })),
    }))

    const itemCount = courseworks.reduce((s, cw) => s + cw.items.length, 0)
    const scoreCount = courseworks.reduce(
      (s, cw) => s + cw.items.reduce((n, item) => n + item.scores.length, 0),
      0
    )
    const courseworkArchive: CollectedCourseworkData = {
      courseworks,
      studentsData,
      classesData,
      membershipsData: [],
      tagsData,
      counts: {
        courseworks: courseworks.length,
        items: itemCount,
        scores: scoreCount,
        students: studentsData.length,
        classrooms: classesData.length,
      },
    }

    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        courseworks: undefined,
        courseworkArchive,
      },
      warnings: [],
    }
  }
}
