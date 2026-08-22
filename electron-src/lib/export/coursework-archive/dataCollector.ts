/**
 * 試験外成績資料（Coursework）アーカイブ用データ収集
 *
 * 指定した coursework を、生徒・学級・タグの full レコード（元 UUID 付き）込みで
 * 自己完結に収集する。grade-archive の内包収集もこの関数へ委譲する。
 *
 * 【原則】Prisma のクエリが返した行をそのまま JSON として持つ。射影・詰め替えはしない。
 * JSON に載らない型だけを JSON.stringify と同じ規則で文字列にする
 * （DateTime → ISO 文字列、Decimal → decimal.js の toJSON と同じ文字列）。
 */

import type { Prisma } from "@prisma/client"

import type {
  ArchiveCourseworkClassroomRow,
  ArchiveCourseworkItemRow,
  ArchiveCourseworkLetterScaleRow,
  ArchiveCourseworkRow,
  ArchiveCourseworkScoreRow,
  ArchiveCourseworkStudentRow,
  ArchiveCourseworkTagRow,
  ArchiveCwClass,
  ArchiveCwMembership,
  ArchiveCwStudent,
  ArchiveCwTag,
  CollectedCourseworkData,
} from "../../../../src/types/courseworkArchive.types"
import prisma from "../../prisma/client"

/** Decimal を JSON.stringify と同じ文字列表現にする */
const decimalToJson = (value: Prisma.Decimal): string => value.toString()
const nullableDecimalToJson = (value: Prisma.Decimal | null): string | null =>
  value === null ? null : value.toString()

/**
 * 指定 coursework 群を full レコード込みで収集する。
 *
 * 外部参照（生徒/学級/タグ）は coursework が参照する範囲のみを集約し、
 * 重複は UUID で排除する。
 */
export async function collectCourseworkArchiveData(
  courseworkIds: string[]
): Promise<CollectedCourseworkData> {
  const [
    courseworkRows,
    classroomJoinRows,
    tagJoinRows,
    studentJoinRows,
    itemRows,
  ] = await Promise.all([
    prisma.coursework.findMany({ where: { id: { in: courseworkIds } } }),
    prisma.courseworkClassroom.findMany({
      where: { courseworkId: { in: courseworkIds } },
      orderBy: { order: "asc" },
    }),
    prisma.courseworkTag.findMany({
      where: { courseworkId: { in: courseworkIds } },
    }),
    prisma.courseworkStudent.findMany({
      where: { courseworkId: { in: courseworkIds } },
      orderBy: [{ customOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.courseworkItem.findMany({
      where: { courseworkId: { in: courseworkIds } },
      orderBy: { order: "asc" },
    }),
  ])

  const itemIds = itemRows.map((item) => item.id)
  const [letterScaleRows, scoreRows] = await Promise.all([
    prisma.courseworkLetterScale.findMany({
      where: { courseworkItemId: { in: itemIds } },
      orderBy: { order: "asc" },
    }),
    prisma.courseworkScore.findMany({
      where: { courseworkItemId: { in: itemIds } },
    }),
  ])

  const courseworks: ArchiveCourseworkRow[] = courseworkRows.map(
    (coursework) => ({
      id: coursework.id,
      name: coursework.name,
      description: coursework.description,
      referenceDate: coursework.referenceDate?.toISOString() ?? null,
      createdAt: coursework.createdAt.toISOString(),
      updatedAt: coursework.updatedAt.toISOString(),
    })
  )

  const courseworkClassrooms: ArchiveCourseworkClassroomRow[] =
    classroomJoinRows.map((courseworkClassroom) => ({
      id: courseworkClassroom.id,
      courseworkId: courseworkClassroom.courseworkId,
      classroomId: courseworkClassroom.classroomId,
      order: courseworkClassroom.order,
      createdAt: courseworkClassroom.createdAt.toISOString(),
      updatedAt: courseworkClassroom.updatedAt.toISOString(),
    }))

  const courseworkTags: ArchiveCourseworkTagRow[] = tagJoinRows.map(
    (courseworkTag) => ({
      id: courseworkTag.id,
      courseworkId: courseworkTag.courseworkId,
      tagId: courseworkTag.tagId,
      createdAt: courseworkTag.createdAt.toISOString(),
      updatedAt: courseworkTag.updatedAt.toISOString(),
    })
  )

  const courseworkStudents: ArchiveCourseworkStudentRow[] = studentJoinRows.map(
    (courseworkStudent) => ({
      id: courseworkStudent.id,
      courseworkId: courseworkStudent.courseworkId,
      studentId: courseworkStudent.studentId,
      customOrder: courseworkStudent.customOrder,
      createdAt: courseworkStudent.createdAt.toISOString(),
      updatedAt: courseworkStudent.updatedAt.toISOString(),
    })
  )

  const courseworkItems: ArchiveCourseworkItemRow[] = itemRows.map((item) => ({
    id: item.id,
    courseworkId: item.courseworkId,
    name: item.name,
    order: item.order,
    maxScore: decimalToJson(item.maxScore),
    inputMode: item.inputMode,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }))

  const courseworkLetterScales: ArchiveCourseworkLetterScaleRow[] =
    letterScaleRows.map((letterScale) => ({
      id: letterScale.id,
      courseworkItemId: letterScale.courseworkItemId,
      label: letterScale.label,
      score: decimalToJson(letterScale.score),
      order: letterScale.order,
      createdAt: letterScale.createdAt.toISOString(),
      updatedAt: letterScale.updatedAt.toISOString(),
    }))

  const courseworkScores: ArchiveCourseworkScoreRow[] = scoreRows.map(
    (score) => ({
      id: score.id,
      courseworkItemId: score.courseworkItemId,
      courseworkStudentId: score.courseworkStudentId,
      score: nullableDecimalToJson(score.score),
      letterValue: score.letterValue,
      adjustment: nullableDecimalToJson(score.adjustment),
      adjustmentReason: score.adjustmentReason,
      comment: score.comment,
      createdAt: score.createdAt.toISOString(),
      updatedAt: score.updatedAt.toISOString(),
    })
  )

  // 参照されている生徒・学級・タグの UUID を集約。
  // 点数は対象者の子なので、名簿を集めれば生徒は網羅される。
  const studentIds = new Set(
    courseworkStudents.map((courseworkStudent) => courseworkStudent.studentId)
  )
  const classroomIds = new Set(
    courseworkClassrooms.map(
      (courseworkClassroom) => courseworkClassroom.classroomId
    )
  )
  const tagIds = new Set(
    courseworkTags.map((courseworkTag) => courseworkTag.tagId)
  )

  const studentRows = await prisma.student.findMany({
    where: { id: { in: [...studentIds] } },
  })
  const studentsData: ArchiveCwStudent[] = studentRows.map((student) => ({
    id: student.id,
    studentNumber: student.studentNumber,
    lastName: student.lastName,
    firstName: student.firstName,
    lastNameKana: student.lastNameKana,
    firstNameKana: student.firstNameKana,
    enrollmentYear: student.enrollmentYear,
    updatedAt: student.updatedAt.toISOString(),
  }))

  const classroomRows = await prisma.classroom.findMany({
    where: { id: { in: [...classroomIds] } },
  })
  const classesData: ArchiveCwClass[] = classroomRows.map((classroom) => ({
    id: classroom.id,
    name: classroom.name,
    classroomCode: classroom.classroomCode,
    grade: classroom.grade,
    description: classroom.description,
    isVisible: classroom.isVisible,
  }))

  // 名簿の裏付けとして、参照生徒×参照学級の所属を収集
  const membershipRows = await prisma.studentClassroomMembership.findMany({
    where: {
      studentId: { in: [...studentIds] },
      classroomId: { in: [...classroomIds] },
    },
  })
  const membershipsData: ArchiveCwMembership[] = membershipRows.map(
    (membership) => ({
      id: membership.id,
      studentId: membership.studentId,
      classroomId: membership.classroomId,
      startDate: membership.startDate.toISOString(),
      endDate: membership.endDate?.toISOString() ?? null,
      attendanceNumber: membership.attendanceNumber,
      notes: membership.notes,
    })
  )

  const tagRows = await prisma.tag.findMany({
    where: { id: { in: [...tagIds] } },
  })
  const tagsData: ArchiveCwTag[] = tagRows.map((tag) => ({
    id: tag.id,
    name: tag.name,
    order: tag.order,
    color: tag.color,
  }))

  return {
    courseworks,
    courseworkClassrooms,
    courseworkTags,
    courseworkStudents,
    courseworkItems,
    courseworkLetterScales,
    courseworkScores,
    studentsData,
    classesData,
    membershipsData,
    tagsData,
    counts: {
      courseworks: courseworks.length,
      items: courseworkItems.length,
      scores: courseworkScores.length,
      students: studentsData.length,
      classrooms: classesData.length,
    },
  }
}
