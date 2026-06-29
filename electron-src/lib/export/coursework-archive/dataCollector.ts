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

  const courseworks: ArchiveCourseworkRef[] = rows.map((cw) => ({
    id: cw.id,
    name: cw.name,
    description: cw.description,
    date: cw.date?.toISOString() ?? null,
    classes: cw.classes.map((c) => ({ classId: c.classId, order: c.order })),
    tags: cw.tags.map((t) => ({ tagId: t.tagId })),
    students: cw.students.map((s) => ({
      studentId: s.studentId,
      customOrder: s.customOrder,
    })),
    items: cw.items.map((item) => ({
      id: item.id,
      name: item.name,
      order: item.order,
      maxScore: Number(item.maxScore),
      inputMode: item.inputMode,
      letterScales: item.letterScales.map((ls) => ({
        label: ls.label,
        score: Number(ls.score),
        order: ls.order,
      })),
      scores: item.scores.map((sc) => ({
        studentId: sc.studentId,
        score: sc.score !== null ? Number(sc.score) : null,
        letterValue: sc.letterValue,
        adjustment: sc.adjustment !== null ? Number(sc.adjustment) : null,
        adjustmentReason: sc.adjustmentReason,
        comment: sc.comment,
        updatedAt: sc.updatedAt.toISOString(),
      })),
    })),
  }))

  // 参照されている生徒・学級・タグの UUID を集約
  const studentIds = new Set<string>()
  const classIds = new Set<string>()
  const tagIds = new Set<string>()
  for (const cw of rows) {
    cw.students.forEach((s) => studentIds.add(s.studentId))
    cw.classes.forEach((c) => classIds.add(c.classId))
    cw.tags.forEach((t) => tagIds.add(t.tagId))
    cw.items.forEach((item) =>
      item.scores.forEach((sc) => studentIds.add(sc.studentId))
    )
  }

  const studentRows = await prisma.student.findMany({
    where: { id: { in: [...studentIds] } },
  })
  const studentsData: ArchiveCwStudent[] = studentRows.map((s) => ({
    id: s.id,
    studentNumber: s.studentNumber,
    lastName: s.lastName,
    firstName: s.firstName,
    lastNameKana: s.lastNameKana,
    firstNameKana: s.firstNameKana,
    enrollmentYear: s.enrollmentYear,
    updatedAt: s.updatedAt.toISOString(),
  }))

  const classRows = await prisma.class.findMany({
    where: { id: { in: [...classIds] } },
  })
  const classesData: ArchiveCwClass[] = classRows.map((c) => ({
    id: c.id,
    name: c.name,
    classCode: c.classCode,
    grade: c.grade,
    description: c.description,
    isVisible: c.isVisible,
  }))

  // 名簿の裏付けとして、参照生徒×参照学級の所属を収集
  const membershipRows = await prisma.studentClassMembership.findMany({
    where: {
      studentId: { in: [...studentIds] },
      classId: { in: [...classIds] },
    },
  })
  const membershipsData: ArchiveCwMembership[] = membershipRows.map((m) => ({
    id: m.id,
    studentId: m.studentId,
    classId: m.classId,
    startDate: m.startDate.toISOString(),
    endDate: m.endDate?.toISOString() ?? null,
    attendanceNumber: m.attendanceNumber,
    notes: m.notes,
  }))

  const tagRows = await prisma.tag.findMany({
    where: { id: { in: [...tagIds] } },
  })
  const tagsData: ArchiveCwTag[] = tagRows.map((t) => ({
    id: t.id,
    name: t.name,
    order: t.order,
    color: t.color,
  }))

  const itemCount = courseworks.reduce((sum, cw) => sum + cw.items.length, 0)
  const scoreCount = courseworks.reduce(
    (sum, cw) => sum + cw.items.reduce((s, item) => s + item.scores.length, 0),
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
      classes: classesData.length,
    },
  }
}
