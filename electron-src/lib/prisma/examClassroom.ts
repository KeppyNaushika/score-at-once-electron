import { ExamClassroom, Prisma } from "@prisma/client"

import type { ExamClassroomWithMembers } from "@/types/prismaExtensions"

import { recordAuditLog } from "./auditLog"
import { resolveExamScope } from "./auditScope"
import prisma from "./client"
import { getExamReferenceDate } from "./examStudent"
import { membershipFilterAt } from "./membershipFilter"

export type ExamClassroomWithDetails = Prisma.ExamClassroomGetPayload<{
  include: {
    classroom: true
    exam: true
  }
}>

export type ExamClassroomWithMemberships = Prisma.ExamClassroomGetPayload<{
  include: {
    classroom: {
      include: {
        memberships: {
          include: {
            student: true
          }
        }
      }
    }
  }
}>

export interface AddExamClassroomOptions {
  examId: string
  classroomId: string
  administered?: boolean
  teacherStatistics?: boolean
  studentReport?: boolean
}

export interface UpdateExamClassroomOptions {
  id: string
  administered?: boolean
  teacherStatistics?: boolean
  studentReport?: boolean
  order?: number
}

export interface ReorderExamClassroomsOptions {
  examId: string
  orderedIds: string[] // ExamClassroom IDs in new order
}

/**
 * Get all classrooms associated with a exam
 */
export const getExamClassrooms = async (
  examId: string
): Promise<ExamClassroomWithMemberships[]> => {
  try {
    // 受験日時点で在籍する所属のみ表示（受験日スナップショット）
    const referenceDate = await getExamReferenceDate(examId)
    return await prisma.examClassroom.findMany({
      where: { examId },
      include: {
        classroom: {
          include: {
            memberships: {
              where: membershipFilterAt(referenceDate),
              include: {
                student: true,
              },
              orderBy: [
                { attendanceNumber: "asc" },
                { student: { studentNumber: "asc" } },
              ],
            },
          },
        },
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    })
  } catch (error) {
    console.error(`Failed to get exam classrooms for ${examId}:`, error)
    throw error
  }
}

/**
 * Get classrooms marked as administered (for adding students)
 */
export const getAdministeredClassrooms = async (
  examId: string
): Promise<ExamClassroomWithMemberships[]> => {
  try {
    // 受験日時点で在籍する所属のみ（受験日スナップショット）
    const referenceDate = await getExamReferenceDate(examId)
    return await prisma.examClassroom.findMany({
      where: {
        examId,
        administered: true,
      },
      include: {
        classroom: {
          include: {
            memberships: {
              where: membershipFilterAt(referenceDate),
              include: {
                student: true,
              },
              orderBy: [
                { attendanceNumber: "asc" },
                { student: { studentNumber: "asc" } },
              ],
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })
  } catch (error) {
    console.error(`Failed to get administered classrooms for ${examId}:`, error)
    throw error
  }
}

/**
 * Add a class to a exam
 */
export const addExamClassroom = async (
  options: AddExamClassroomOptions
): Promise<ExamClassroomWithDetails> => {
  const {
    examId,
    classroomId,
    administered = false,
    teacherStatistics = false,
    studentReport = false,
  } = options

  try {
    // 現在の最大orderを取得して次の順序を決定
    const maxOrderResult = await prisma.examClassroom.aggregate({
      where: { examId },
      _max: { order: true },
    })
    const nextOrder = (maxOrderResult._max.order ?? -1) + 1

    const examClassroom = await prisma.examClassroom.create({
      data: {
        examId,
        classroomId,
        administered,
        teacherStatistics,
        studentReport,
        order: nextOrder,
      },
      include: {
        classroom: true,
        exam: true,
      },
    })

    await recordAuditLog({
      action: "exam.class.assign",
      entityType: "ExamClassroom",
      entityId: examClassroom.id,
      scopeId: examId,
      scopeLabel: examClassroom.exam?.examName ?? null,
      target: examClassroom.classroom?.name ?? null,
    })

    return examClassroom
  } catch (error) {
    console.error(
      `Failed to add class ${classroomId} to exam ${examId}:`,
      error
    )
    throw error
  }
}

/**
 * Update a exam class relationship
 */
export const updateExamClassroom = async (
  options: UpdateExamClassroomOptions
): Promise<ExamClassroomWithDetails> => {
  const { id, administered, teacherStatistics, studentReport, order } = options

  try {
    return await prisma.examClassroom.update({
      where: { id },
      data: {
        ...(administered !== undefined && { administered }),
        ...(teacherStatistics !== undefined && { teacherStatistics }),
        ...(studentReport !== undefined && { studentReport }),
        ...(order !== undefined && { order }),
      },
      include: {
        classroom: true,
        exam: true,
      },
    })
  } catch (error) {
    console.error(`Failed to update exam class ${id}:`, error)
    throw error
  }
}

/**
 * Reorder exam classrooms
 */
export const reorderExamClassrooms = async (
  options: ReorderExamClassroomsOptions
): Promise<void> => {
  const { orderedIds } = options

  try {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.examClassroom.update({
          where: { id },
          data: { order: index },
        })
      )
    )
  } catch (error) {
    console.error("Failed to reorder exam classrooms:", error)
    throw error
  }
}

/**
 * Remove a class from a exam
 */
export const removeExamClassroom = async (
  id: string
): Promise<ExamClassroom> => {
  try {
    const before = await prisma.examClassroom.findUnique({
      where: { id },
      select: { examId: true, classroom: { select: { name: true } } },
    })

    const deleted = await prisma.examClassroom.delete({
      where: { id },
    })

    const scope = before ? await resolveExamScope(before.examId) : null
    await recordAuditLog({
      action: "exam.class.unassign",
      entityType: "ExamClassroom",
      entityId: id,
      scopeId: scope?.scopeId ?? null,
      scopeLabel: scope?.scopeLabel ?? null,
      target: before?.classroom.name ?? null,
    })

    return deleted
  } catch (error) {
    console.error(`Failed to remove exam class ${id}:`, error)
    throw error
  }
}

/**
 * Remove a class from a exam by examId and classroomId
 */
export const removeExamClassroomByIds = async (
  examId: string,
  classroomId: string
): Promise<ExamClassroom> => {
  try {
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { name: true },
    })

    const deleted = await prisma.examClassroom.delete({
      where: {
        examId_classroomId: { examId, classroomId },
      },
    })

    const scope = await resolveExamScope(examId)
    await recordAuditLog({
      action: "exam.class.unassign",
      entityType: "ExamClassroom",
      entityId: deleted.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      target: classroom?.name ?? null,
    })

    return deleted
  } catch (error) {
    console.error(
      `Failed to remove class ${classroomId} from exam ${examId}:`,
      error
    )
    throw error
  }
}

/**
 * Get all classrooms that are NOT in ExamClassroom for a exam
 * Used by ClassroomExamManager to show available classrooms to add
 */
export const getAvailableClassroomsForExam = async (
  examId: string
): Promise<
  {
    id: string
    name: string
    classroomCode: string | null
    grade: number | null
    studentCount: number
  }[]
> => {
  try {
    // Get classrooms already associated with this exam
    const existingExamClassrooms = await prisma.examClassroom.findMany({
      where: { examId },
      select: { classroomId: true },
    })
    const existingClassroomIds = existingExamClassrooms.map(
      (examClassroom) => examClassroom.classroomId
    )

    // Get all classrooms not in ExamClassroom
    const availableClassrooms = await prisma.classroom.findMany({
      where: {
        id: {
          notIn:
            existingClassroomIds.length > 0 ? existingClassroomIds : undefined,
        },
      },
      include: {
        memberships: true,
      },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    })

    return availableClassrooms.map((classroom) => ({
      id: classroom.id,
      name: classroom.name,
      classroomCode: classroom.classroomCode,
      grade: classroom.grade,
      studentCount: classroom.memberships.length,
    }))
  } catch (error) {
    console.error(
      `Failed to get available classrooms for exam ${examId}:`,
      error
    )
    throw error
  }
}

/**
 * クラスから生徒を試験に追加（B案: 統合型フロー）
 *
 * 1. ExamClassroom を作成（administered=true, 次の order）
 * 2. クラスの生徒を出席番号順で ExamStudent に追加
 *
 * @returns 追加された生徒数とスキップされた生徒数
 */
export const addStudentsFromClassroom = async (
  examId: string,
  classroomId: string,
  activeOnly = true
): Promise<{
  added: number
  skipped: number
  examClassroom: ExamClassroom
}> => {
  try {
    const referenceDate = await getExamReferenceDate(examId)

    // 1. 現在の ExamClassroom の最大 order を取得
    const maxOrderResult = await prisma.examClassroom.aggregate({
      where: { examId },
      _max: { order: true },
    })
    const nextOrder = (maxOrderResult._max.order ?? -1) + 1

    // 2. ExamClassroom を作成（既に存在する場合は administered=true に更新）
    const examClassroom = await prisma.examClassroom.upsert({
      where: {
        examId_classroomId: { examId, classroomId },
      },
      create: {
        examId,
        classroomId,
        administered: true,
        teacherStatistics: true, // 生徒ごと追加した学級は教員集計の対象
        studentReport: true, // administered なので生徒表示の対象
        order: nextOrder,
      },
      // 再追加では構造（administered）のみ再宣言し、出力フラグ（teacherStatistics/studentReport）は
      // 08 画面で設定したユーザーの選択を尊重して触らない
      update: {
        administered: true,
      },
    })

    // 3. クラスの生徒を出席番号順で取得（activeOnlyなら基準日時点で在籍中のみ）
    const memberships = await prisma.studentClassroomMembership.findMany({
      where: {
        classroomId,
        ...(activeOnly ? membershipFilterAt(referenceDate) : {}),
      },
      orderBy: [{ attendanceNumber: "asc" }],
      include: { student: true },
    })

    // 4. 既存の ExamStudent を取得
    const existingExamStudents = await prisma.examStudent.findMany({
      where: { examId },
      select: { studentId: true, customOrder: true },
    })
    const existingStudentIds = new Set(
      existingExamStudents.map((examStudent) => examStudent.studentId)
    )

    // 5. 現在の最大 customOrder を取得
    const maxCustomOrder = existingExamStudents.reduce(
      (max, examStudent) => Math.max(max, examStudent.customOrder ?? 0),
      0
    )

    // 6. 新規生徒を追加（customOrder は出席番号ベースで連番）
    const studentsToAdd: { studentId: string; customOrder: number }[] = []
    let orderOffset = maxCustomOrder + 1

    for (const membership of memberships) {
      if (!existingStudentIds.has(membership.studentId)) {
        studentsToAdd.push({
          studentId: membership.studentId,
          customOrder: orderOffset++,
        })
        existingStudentIds.add(membership.studentId)
      }
    }

    if (studentsToAdd.length > 0) {
      await prisma.examStudent.createMany({
        data: studentsToAdd.map(({ studentId, customOrder }) => ({
          examId,
          studentId,
          status: "participating",
          customOrder,
        })),
      })
    }

    return {
      added: studentsToAdd.length,
      skipped: memberships.length - studentsToAdd.length,
      examClassroom,
    }
  } catch (error) {
    console.error(
      `Failed to add students from class ${classroomId} to exam ${examId}:`,
      error
    )
    throw error
  }
}

/**
 * 登録学級ごとの所属生徒（集計エンジン・Phase 1）
 *
 * 試験に登録された各 ExamClassroom について、**受験日時点で在籍する**生徒（class.memberships）を
 * 含む Prisma payload（{@link ExamClassroomWithMembers}）をそのまま返す。memberships は受験日
 * スナップショットで where 絞り込み・出席番号→学籍番号順にソート済み。採番学級の解決
 * （renderer 側 `resolveExamClassroomPlacement`）と異なり**1人の生徒は所属する全学級に重複カウント**される
 * （用途2/3の学級平均は「学級全体」を母集団とするため、order優先の単一化はしない）。
 *
 * order 昇順の全登録学級を返し、消費側が用途別にフィルタする
 * （Excel は teacherStatistics、個人成績表は studentReport）。所属生徒IDは
 * `ec.classroom.memberships.map((m) => m.studentId)` で取得する。
 */
export const getClassroomMembersForExam = async (
  examId: string
): Promise<ExamClassroomWithMembers[]> => {
  try {
    const referenceDate = await getExamReferenceDate(examId)

    return await prisma.examClassroom.findMany({
      where: { examId },
      include: {
        classroom: {
          include: {
            memberships: {
              where: membershipFilterAt(referenceDate),
              orderBy: [
                { attendanceNumber: "asc" },
                { student: { studentNumber: "asc" } },
              ],
              select: { studentId: true },
            },
          },
        },
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    })
  } catch (error) {
    console.error(`Failed to get class members for exam ${examId}:`, error)
    throw error
  }
}
