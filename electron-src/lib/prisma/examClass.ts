import { ExamClass, Prisma } from "@prisma/client"

import type { StudentClassInfo } from "@/types/electron/examClassApi"
import type { ExamClassWithMembers } from "@/types/prismaExtensions"

import { recordAuditLog } from "./auditLog"
import { resolveExamScope } from "./auditScope"
import prisma from "./client"
import { getExamReferenceDate } from "./examStudent"
import { membershipFilterAt } from "./membershipFilter"

/**
 * 試験内の全生徒の学級・出席番号情報
 */
export type StudentClassInfoMap = Map<string, StudentClassInfo>

type ExamClassWithDetails = Prisma.ExamClassGetPayload<{
  include: {
    classroom: true
    exam: true
  }
}>

type ExamClassWithClass = Prisma.ExamClassGetPayload<{
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

export interface AddExamClassOptions {
  examId: string
  classroomId: string
  administered?: boolean
  teacherStat?: boolean
  studentReport?: boolean
}

export interface UpdateExamClassOptions {
  id: string
  administered?: boolean
  teacherStat?: boolean
  studentReport?: boolean
  order?: number
}

export interface ReorderExamClassesOptions {
  examId: string
  orderedIds: string[] // ExamClass IDs in new order
}

/**
 * Get all classes associated with a exam
 */
export const getExamClasses = async (
  examId: string
): Promise<ExamClassWithClass[]> => {
  try {
    // 受験日時点で在籍する所属のみ表示（受験日スナップショット）
    const referenceDate = await getExamReferenceDate(examId)
    return await prisma.examClass.findMany({
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
    console.error(`Failed to get exam classes for ${examId}:`, error)
    throw error
  }
}

/**
 * Get classes marked as administered (for adding students)
 */
export const getAdministeredClasses = async (
  examId: string
): Promise<ExamClassWithClass[]> => {
  try {
    // 受験日時点で在籍する所属のみ（受験日スナップショット）
    const referenceDate = await getExamReferenceDate(examId)
    return await prisma.examClass.findMany({
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
    console.error(`Failed to get administered classes for ${examId}:`, error)
    throw error
  }
}

/**
 * Add a class to a exam
 */
export const addExamClass = async (
  options: AddExamClassOptions
): Promise<ExamClassWithDetails> => {
  const {
    examId,
    classroomId,
    administered = false,
    teacherStat = false,
    studentReport = false,
  } = options

  try {
    // 現在の最大orderを取得して次の順序を決定
    const maxOrderResult = await prisma.examClass.aggregate({
      where: { examId },
      _max: { order: true },
    })
    const nextOrder = (maxOrderResult._max.order ?? -1) + 1

    const examClass = await prisma.examClass.create({
      data: {
        examId,
        classroomId,
        administered,
        teacherStat,
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
      entityType: "ExamClass",
      entityId: examClass.id,
      scopeId: examId,
      scopeLabel: examClass.exam?.examName ?? null,
      target: examClass.classroom?.name ?? null,
    })

    return examClass
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
export const updateExamClass = async (
  options: UpdateExamClassOptions
): Promise<ExamClassWithDetails> => {
  const { id, administered, teacherStat, studentReport, order } = options

  try {
    return await prisma.examClass.update({
      where: { id },
      data: {
        ...(administered !== undefined && { administered }),
        ...(teacherStat !== undefined && { teacherStat }),
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
 * Reorder exam classes
 */
export const reorderExamClasses = async (
  options: ReorderExamClassesOptions
): Promise<void> => {
  const { orderedIds } = options

  try {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.examClass.update({
          where: { id },
          data: { order: index },
        })
      )
    )
  } catch (error) {
    console.error("Failed to reorder exam classes:", error)
    throw error
  }
}

/**
 * Remove a class from a exam
 */
export const removeExamClass = async (id: string): Promise<ExamClass> => {
  try {
    const before = await prisma.examClass.findUnique({
      where: { id },
      select: { examId: true, classroom: { select: { name: true } } },
    })

    const deleted = await prisma.examClass.delete({
      where: { id },
    })

    const scope = before ? await resolveExamScope(before.examId) : null
    await recordAuditLog({
      action: "exam.class.unassign",
      entityType: "ExamClass",
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
export const removeExamClassByIds = async (
  examId: string,
  classroomId: string
): Promise<ExamClass> => {
  try {
    const cls = await prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { name: true },
    })

    const deleted = await prisma.examClass.delete({
      where: {
        examId_classroomId: { examId, classroomId },
      },
    })

    const scope = await resolveExamScope(examId)
    await recordAuditLog({
      action: "exam.class.unassign",
      entityType: "ExamClass",
      entityId: deleted.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      target: cls?.name ?? null,
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
 * Get all classes that are NOT in ExamClass for a exam
 * Used by ClassExamManager to show available classes to add
 */
export const getAvailableClassesForExam = async (
  examId: string
): Promise<
  {
    id: string
    name: string
    classCode: string | null
    grade: number | null
    studentCount: number
  }[]
> => {
  try {
    // Get classes already associated with this exam
    const existingExamClasses = await prisma.examClass.findMany({
      where: { examId },
      select: { classroomId: true },
    })
    const existingClassIds = existingExamClasses.map((pc) => pc.classroomId)

    // Get all classes not in ExamClass
    const availableClasses = await prisma.classroom.findMany({
      where: {
        id: {
          notIn: existingClassIds.length > 0 ? existingClassIds : undefined,
        },
      },
      include: {
        memberships: true,
      },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    })

    return availableClasses.map((cls) => ({
      id: cls.id,
      name: cls.name,
      classCode: cls.classCode,
      grade: cls.grade,
      studentCount: cls.memberships.length,
    }))
  } catch (error) {
    console.error(`Failed to get available classes for exam ${examId}:`, error)
    throw error
  }
}

/**
 * クラスから生徒を試験に追加（B案: 統合型フロー）
 *
 * 1. ExamClass を作成（administered=true, 次の order）
 * 2. クラスの生徒を出席番号順で ExamStudent に追加
 *
 * @returns 追加された生徒数とスキップされた生徒数
 */
export const addStudentsFromClass = async (
  examId: string,
  classroomId: string,
  activeOnly = true
): Promise<{
  added: number
  skipped: number
  examClass: ExamClass
}> => {
  try {
    const referenceDate = await getExamReferenceDate(examId)

    // 1. 現在の ExamClass の最大 order を取得
    const maxOrderResult = await prisma.examClass.aggregate({
      where: { examId },
      _max: { order: true },
    })
    const nextOrder = (maxOrderResult._max.order ?? -1) + 1

    // 2. ExamClass を作成（既に存在する場合は administered=true に更新）
    const examClass = await prisma.examClass.upsert({
      where: {
        examId_classroomId: { examId, classroomId },
      },
      create: {
        examId,
        classroomId,
        administered: true,
        teacherStat: true, // 生徒ごと追加した学級は教員集計の対象
        studentReport: true, // administered なので生徒表示の対象
        order: nextOrder,
      },
      // 再追加では構造（administered）のみ再宣言し、出力フラグ（teacherStat/studentReport）は
      // 08 画面で設定したユーザーの選択を尊重して触らない
      update: {
        administered: true,
      },
    })

    // 3. クラスの生徒を出席番号順で取得（activeOnlyなら基準日時点で在籍中のみ）
    const memberships = await prisma.studentClassMembership.findMany({
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
      existingExamStudents.map((ps) => ps.studentId)
    )

    // 5. 現在の最大 customOrder を取得
    const maxCustomOrder = existingExamStudents.reduce(
      (max, ps) => Math.max(max, ps.customOrder ?? 0),
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
          status: "PARTICIPATING",
          customOrder,
        })),
      })
    }

    return {
      added: studentsToAdd.length,
      skipped: memberships.length - studentsToAdd.length,
      examClass,
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
 * 試験内の全生徒の学級・出席番号情報を取得
 *
 * ロジック:
 * 1. ExamClass (administered=true) を order 順で取得
 * 2. 各クラスの StudentClassMembership を取得
 * 3. 生徒ごとに、最初にマッチするクラスの情報を返す
 *
 * @returns Map<studentId, StudentClassInfo>
 */
export const getStudentClassInfoForExam = async (
  examId: string
): Promise<Record<string, StudentClassInfo>> => {
  try {
    // 受験日時点で在籍する所属のみを解決対象とする（受験日スナップショット）
    const referenceDate = await getExamReferenceDate(examId)

    // 1. administered=true の ExamClass を order 順で取得
    const examClasses = await prisma.examClass.findMany({
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
            },
          },
        },
      },
      orderBy: { order: "asc" },
    })

    // 2. 生徒ごとの学級情報をマップに格納（order順で最初にマッチしたものを使用）
    const result: Record<string, StudentClassInfo> = {}

    for (const pc of examClasses) {
      for (const membership of pc.classroom.memberships) {
        // 既に情報がある生徒はスキップ（order優先順位を尊重）
        if (result[membership.studentId]) {
          continue
        }

        result[membership.studentId] = {
          className: pc.classroom.name,
          classCode: pc.classroom.classCode,
          grade: pc.classroom.grade,
          attendanceNumber: membership.attendanceNumber,
          classOrder: pc.order,
        }
      }
    }

    return result
  } catch (error) {
    console.error(`Failed to get student class info for exam ${examId}:`, error)
    throw error
  }
}

/**
 * 単一生徒の学級・出席番号情報を取得
 */
export const getStudentClassInfo = async (
  examId: string,
  studentId: string
): Promise<StudentClassInfo> => {
  try {
    // 受験日時点で在籍する所属のみを解決対象とする（受験日スナップショット）
    const referenceDate = await getExamReferenceDate(examId)

    // administered=true の ExamClass を order 順で取得
    const examClasses = await prisma.examClass.findMany({
      where: {
        examId,
        administered: true,
      },
      include: {
        classroom: {
          include: {
            memberships: {
              where: { studentId, ...membershipFilterAt(referenceDate) },
            },
          },
        },
      },
      orderBy: { order: "asc" },
    })

    // 最初にマッチするクラスを使用
    for (const pc of examClasses) {
      if (pc.classroom.memberships.length > 0) {
        const membership = pc.classroom.memberships[0]
        return {
          className: pc.classroom.name,
          classCode: pc.classroom.classCode,
          grade: pc.classroom.grade,
          attendanceNumber: membership.attendanceNumber,
          classOrder: pc.order,
        }
      }
    }

    // 該当なし
    return {
      className: null,
      classCode: null,
      grade: null,
      attendanceNumber: null,
      classOrder: null,
    }
  } catch (error) {
    console.error(
      `Failed to get student class info for student ${studentId} in exam ${examId}:`,
      error
    )
    throw error
  }
}

/**
 * 登録学級ごとの所属生徒（集計エンジン・Phase 1）
 *
 * 試験に登録された各 ExamClass について、**受験日時点で在籍する**生徒（class.memberships）を
 * 含む Prisma payload（{@link ExamClassWithMembers}）をそのまま返す。memberships は受験日
 * スナップショットで where 絞り込み・出席番号→学籍番号順にソート済み。採番
 * （getStudentClassInfoForExam）と異なり**1人の生徒は所属する全学級に重複カウント**される
 * （用途2/3の学級平均は「学級全体」を母集団とするため、order優先の単一化はしない）。
 *
 * order 昇順の全登録学級を返し、消費側が用途別にフィルタする
 * （Excel は teacherStat、個人成績表は studentReport）。所属生徒IDは
 * `ec.classroom.memberships.map((m) => m.studentId)` で取得する。
 */
export const getClassMembersForExam = async (
  examId: string
): Promise<ExamClassWithMembers[]> => {
  try {
    const referenceDate = await getExamReferenceDate(examId)

    return await prisma.examClass.findMany({
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
