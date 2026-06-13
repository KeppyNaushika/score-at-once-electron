import { ExamClass, Prisma } from "@prisma/client"

import type { StudentClassInfo } from "@/types/electron/examClassApi"

import prisma from "./client"
import { getExamReferenceDate } from "./examStudent"
import { membershipFilterAt } from "./membershipFilter"

/**
 * 試験内の全生徒の学級・出席番号情報
 */
export type StudentClassInfoMap = Map<string, StudentClassInfo>

type ExamClassWithDetails = Prisma.ExamClassGetPayload<{
  include: {
    class: true
    exam: true
  }
}>

type ExamClassWithClass = Prisma.ExamClassGetPayload<{
  include: {
    class: {
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
  classId: string
  administered?: boolean
  statistics?: boolean
}

export interface UpdateExamClassOptions {
  id: string
  administered?: boolean
  statistics?: boolean
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
    return await prisma.examClass.findMany({
      where: { examId },
      include: {
        class: {
          include: {
            memberships: {
              where: { endDate: null }, // Current memberships only
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
    return await prisma.examClass.findMany({
      where: {
        examId,
        administered: true,
      },
      include: {
        class: {
          include: {
            memberships: {
              where: { endDate: null },
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
 * Get classes marked for statistics aggregation
 */
export const getStatisticsClasses = async (
  examId: string
): Promise<ExamClassWithClass[]> => {
  try {
    return await prisma.examClass.findMany({
      where: {
        examId,
        statistics: true,
      },
      include: {
        class: {
          include: {
            memberships: {
              where: { endDate: null },
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
    console.error(`Failed to get statistics classes for ${examId}:`, error)
    throw error
  }
}

/**
 * Add a class to a exam
 */
export const addExamClass = async (
  options: AddExamClassOptions
): Promise<ExamClassWithDetails> => {
  const { examId, classId, administered = false, statistics = false } = options

  try {
    // 現在の最大orderを取得して次の順序を決定
    const maxOrderResult = await prisma.examClass.aggregate({
      where: { examId },
      _max: { order: true },
    })
    const nextOrder = (maxOrderResult._max.order ?? -1) + 1

    return await prisma.examClass.create({
      data: {
        examId,
        classId,
        administered,
        statistics,
        order: nextOrder,
      },
      include: {
        class: true,
        exam: true,
      },
    })
  } catch (error) {
    console.error(`Failed to add class ${classId} to exam ${examId}:`, error)
    throw error
  }
}

/**
 * Update a exam class relationship
 */
export const updateExamClass = async (
  options: UpdateExamClassOptions
): Promise<ExamClassWithDetails> => {
  const { id, administered, statistics, order } = options

  try {
    return await prisma.examClass.update({
      where: { id },
      data: {
        ...(administered !== undefined && { administered }),
        ...(statistics !== undefined && { statistics }),
        ...(order !== undefined && { order }),
      },
      include: {
        class: true,
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
    return await prisma.examClass.delete({
      where: { id },
    })
  } catch (error) {
    console.error(`Failed to remove exam class ${id}:`, error)
    throw error
  }
}

/**
 * Remove a class from a exam by examId and classId
 */
export const removeExamClassByIds = async (
  examId: string,
  classId: string
): Promise<ExamClass> => {
  try {
    return await prisma.examClass.delete({
      where: {
        examId_classId: { examId, classId },
      },
    })
  } catch (error) {
    console.error(
      `Failed to remove class ${classId} from exam ${examId}:`,
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
      select: { classId: true },
    })
    const existingClassIds = existingExamClasses.map((pc) => pc.classId)

    // Get all classes not in ExamClass
    const availableClasses = await prisma.class.findMany({
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
  classId: string,
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
        examId_classId: { examId, classId },
      },
      create: {
        examId,
        classId,
        administered: true,
        statistics: true,
        order: nextOrder,
      },
      update: {
        administered: true,
      },
    })

    // 3. クラスの生徒を出席番号順で取得（activeOnlyなら基準日時点で在籍中のみ）
    const memberships = await prisma.studentClassMembership.findMany({
      where: {
        classId,
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
      `Failed to add students from class ${classId} to exam ${examId}:`,
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
    // 1. administered=true の ExamClass を order 順で取得
    const examClasses = await prisma.examClass.findMany({
      where: {
        examId,
        administered: true,
      },
      include: {
        class: {
          include: {
            memberships: {
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
      for (const membership of pc.class.memberships) {
        // 既に情報がある生徒はスキップ（order優先順位を尊重）
        if (result[membership.studentId]) {
          continue
        }

        result[membership.studentId] = {
          className: pc.class.name,
          classCode: pc.class.classCode,
          grade: pc.class.grade,
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
    // administered=true の ExamClass を order 順で取得
    const examClasses = await prisma.examClass.findMany({
      where: {
        examId,
        administered: true,
      },
      include: {
        class: {
          include: {
            memberships: {
              where: { studentId },
            },
          },
        },
      },
      orderBy: { order: "asc" },
    })

    // 最初にマッチするクラスを使用
    for (const pc of examClasses) {
      if (pc.class.memberships.length > 0) {
        const membership = pc.class.memberships[0]
        return {
          className: pc.class.name,
          classCode: pc.class.classCode,
          grade: pc.class.grade,
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
