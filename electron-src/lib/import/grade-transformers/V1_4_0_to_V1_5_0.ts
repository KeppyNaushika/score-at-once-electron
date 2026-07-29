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
  ArchiveCwClass,
  ArchiveCwStudent,
  ArchiveCwTag,
} from "../../../../src/types/courseworkArchive.types"
import type {
  GradeArchiveData,
  GradeTransformResult,
  GradeVersionTransformer,
} from "../../../../src/types/gradeArchive.types"
import type {
  LegacyArchiveCourseworkRef,
  LegacyCollectedCourseworkData,
} from "../coursework-transformers/legacyShape"

/** LWW で既存を上書きしないための過去日時 */
const EPOCH = new Date(0).toISOString()

const synthStudentId = (studentNumber: string) =>
  `legacy-student:${studentNumber}`
const synthClassroomId = (classroomName: string) =>
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
    for (const coursework of legacy) {
      coursework.students.forEach((student) =>
        studentNumbers.add(student.studentNumber)
      )
      coursework.classrooms.forEach((classroom) =>
        classNames.add(classroom.classroomName)
      )
      coursework.tags.forEach((tag) => tagNames.add(tag.tagName))
      coursework.items.forEach((item) =>
        item.scores.forEach((score) => studentNumbers.add(score.studentNumber))
      )
    }

    const studentsData: ArchiveCwStudent[] = [...studentNumbers].map(
      (studentNumber) => ({
        id: synthStudentId(studentNumber),
        studentNumber,
        lastName: "",
        firstName: "",
        lastNameKana: "",
        firstNameKana: "",
        enrollmentYear: null,
        updatedAt: EPOCH,
      })
    )
    const classesData: ArchiveCwClass[] = [...classNames].map((name) => ({
      id: synthClassroomId(name),
      name,
      classroomCode: null,
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

    const courseworks: LegacyArchiveCourseworkRef[] = legacy.map(
      (coursework) => ({
        id: coursework.id,
        name: coursework.name,
        description: coursework.description,
        date: coursework.date,
        classrooms: coursework.classrooms.map((classroom) => ({
          classroomId: synthClassroomId(classroom.classroomName),
          order: classroom.order,
        })),
        tags: coursework.tags.map((tag) => ({
          tagId: synthTagId(tag.tagName),
        })),
        students: coursework.students.map((student) => ({
          studentId: synthStudentId(student.studentNumber),
          customOrder: student.customOrder,
        })),
        items: coursework.items.map((item) => ({
          id: item.id,
          name: item.name,
          order: item.order,
          maxScore: item.maxScore,
          inputMode: item.inputMode,
          letterScales: item.letterScales,
          scores: item.scores.map((score) => ({
            studentId: synthStudentId(score.studentNumber),
            score: score.score,
            letterValue: score.letterValue,
            adjustment: score.adjustment,
            adjustmentReason: score.adjustmentReason,
            comment: score.comment,
            updatedAt: EPOCH,
          })),
        })),
      })
    )

    const itemCount = courseworks.reduce(
      (total, coursework) => total + coursework.items.length,
      0
    )
    const scoreCount = courseworks.reduce(
      (total, coursework) =>
        total +
        coursework.items.reduce(
          (scoreTotal, item) => scoreTotal + item.scores.length,
          0
        ),
      0
    )
    // 1.5.0 時点の入れ子形式。平坦化は後段の 1.11.0 → 1.12.0 が行う
    const legacyCourseworkArchive: LegacyCollectedCourseworkData = {
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
        legacyCourseworkArchive,
      },
      warnings: [],
    }
  }
}
