/**
 * 試験外成績資料（Coursework）アーカイブ用データ収集
 *
 * 指定した coursework を、生徒・学級・タグの full レコード（元 UUID 付き）込みで
 * 自己完結に収集する。grade-archive の内包収集もこの関数へ委譲する。
 */

import type {
  ArchiveCourseworkRef,
  ArchiveCwClass,
  ArchiveCwMembership,
  ArchiveCwStudent,
  ArchiveCwTag,
  CollectedCourseworkData,
} from "../../../../src/types/courseworkArchive.types"
import prisma from "../../prisma/client"

/**
 * 指定 coursework 群を full レコード込みで収集する。
 *
 * 外部参照（生徒/学級/タグ）は coursework が参照する範囲のみを集約し、
 * 重複は UUID で排除する。
 */
export async function collectCourseworkArchiveData(
  courseworkIds: string[]
): Promise<CollectedCourseworkData> {
  const rows = await prisma.coursework.findMany({
    where: { id: { in: courseworkIds } },
    include: {
      classes: { orderBy: { order: "asc" } },
      tags: true,
      students: {
        orderBy: [{ customOrder: "asc" }, { createdAt: "asc" }],
      },
      items: {
        include: {
          letterScales: { orderBy: { order: "asc" } },
          scores: true,
        },
        orderBy: { order: "asc" },
      },
    },
  })

  const courseworks: ArchiveCourseworkRef[] = rows.map((coursework) => ({
    id: coursework.id,
    name: coursework.name,
    description: coursework.description,
    date: coursework.date?.toISOString() ?? null,
    classrooms: coursework.classes.map((classroom) => ({
      classroomId: classroom.classroomId,
      order: classroom.order,
    })),
    tags: coursework.tags.map((tag) => ({ tagId: tag.tagId })),
    students: coursework.students.map((student) => ({
      studentId: student.studentId,
      customOrder: student.customOrder,
    })),
    items: coursework.items.map((item) => ({
      id: item.id,
      name: item.name,
      order: item.order,
      maxScore: Number(item.maxScore),
      inputMode: item.inputMode,
      letterScales: item.letterScales.map((letterScale) => ({
        label: letterScale.label,
        score: Number(letterScale.score),
        order: letterScale.order,
      })),
      scores: item.scores.map((score) => ({
        studentId: score.studentId,
        score: score.score !== null ? Number(score.score) : null,
        letterValue: score.letterValue,
        adjustment: score.adjustment !== null ? Number(score.adjustment) : null,
        adjustmentReason: score.adjustmentReason,
        comment: score.comment,
        updatedAt: score.updatedAt.toISOString(),
      })),
    })),
  }))

  // 参照されている生徒・学級・タグの UUID を集約
  const studentIds = new Set<string>()
  const classIds = new Set<string>()
  const tagIds = new Set<string>()
  for (const coursework of rows) {
    coursework.students.forEach((student) => studentIds.add(student.studentId))
    coursework.classes.forEach((classroom) =>
      classIds.add(classroom.classroomId)
    )
    coursework.tags.forEach((tag) => tagIds.add(tag.tagId))
    coursework.items.forEach((item) =>
      item.scores.forEach((score) => studentIds.add(score.studentId))
    )
  }

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

  const classRows = await prisma.classroom.findMany({
    where: { id: { in: [...classIds] } },
  })
  const classesData: ArchiveCwClass[] = classRows.map((classroom) => ({
    id: classroom.id,
    name: classroom.name,
    classCode: classroom.classCode,
    grade: classroom.grade,
    description: classroom.description,
    isVisible: classroom.isVisible,
  }))

  // 名簿の裏付けとして、参照生徒×参照学級の所属を収集
  const membershipRows = await prisma.studentClassMembership.findMany({
    where: {
      studentId: { in: [...studentIds] },
      classroomId: { in: [...classIds] },
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

  const itemCount = courseworks.reduce(
    (sum, coursework) => sum + coursework.items.length,
    0
  )
  const scoreCount = courseworks.reduce(
    (sum, coursework) =>
      sum +
      coursework.items.reduce((total, item) => total + item.scores.length, 0),
    0
  )

  return {
    courseworks,
    studentsData,
    classesData,
    membershipsData,
    tagsData,
    counts: {
      courseworks: courseworks.length,
      items: itemCount,
      scores: scoreCount,
      students: studentsData.length,
      classrooms: classesData.length,
    },
  }
}
