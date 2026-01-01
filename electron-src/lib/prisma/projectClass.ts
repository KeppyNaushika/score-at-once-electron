import type { StudentClassInfo } from "@/types/electron.d"
import { Prisma, ProjectClass } from "@prisma/client"
import prisma from "./client"

/**
 * プロジェクト内の全生徒の学級・出席番号情報
 */
export type StudentClassInfoMap = Map<string, StudentClassInfo>

type ProjectClassWithDetails = Prisma.ProjectClassGetPayload<{
  include: {
    class: true
    project: true
  }
}>

type ProjectClassWithClass = Prisma.ProjectClassGetPayload<{
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

export interface AddProjectClassOptions {
  projectId: string
  classId: string
  administered?: boolean
  statistics?: boolean
}

export interface UpdateProjectClassOptions {
  id: string
  administered?: boolean
  statistics?: boolean
  order?: number
}

export interface ReorderProjectClassesOptions {
  projectId: string
  orderedIds: string[] // ProjectClass IDs in new order
}

/**
 * Get all classes associated with a project
 */
export const getProjectClasses = async (
  projectId: string
): Promise<ProjectClassWithClass[]> => {
  try {
    return await prisma.projectClass.findMany({
      where: { projectId },
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
                { student: { studentId: "asc" } },
              ],
            },
          },
        },
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    })
  } catch (error) {
    console.error(`Failed to get project classes for ${projectId}:`, error)
    throw error
  }
}

/**
 * Get classes marked as administered (for adding students)
 */
export const getAdministeredClasses = async (
  projectId: string
): Promise<ProjectClassWithClass[]> => {
  try {
    return await prisma.projectClass.findMany({
      where: {
        projectId,
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
                { student: { studentId: "asc" } },
              ],
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })
  } catch (error) {
    console.error(`Failed to get administered classes for ${projectId}:`, error)
    throw error
  }
}

/**
 * Get classes marked for statistics aggregation
 */
export const getStatisticsClasses = async (
  projectId: string
): Promise<ProjectClassWithClass[]> => {
  try {
    return await prisma.projectClass.findMany({
      where: {
        projectId,
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
                { student: { studentId: "asc" } },
              ],
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })
  } catch (error) {
    console.error(`Failed to get statistics classes for ${projectId}:`, error)
    throw error
  }
}

/**
 * Add a class to a project
 */
export const addProjectClass = async (
  options: AddProjectClassOptions
): Promise<ProjectClassWithDetails> => {
  const {
    projectId,
    classId,
    administered = false,
    statistics = false,
  } = options

  try {
    return await prisma.projectClass.create({
      data: {
        projectId,
        classId,
        administered,
        statistics,
      },
      include: {
        class: true,
        project: true,
      },
    })
  } catch (error) {
    console.error(
      `Failed to add class ${classId} to project ${projectId}:`,
      error
    )
    throw error
  }
}

/**
 * Update a project class relationship
 */
export const updateProjectClass = async (
  options: UpdateProjectClassOptions
): Promise<ProjectClassWithDetails> => {
  const { id, administered, statistics, order } = options

  try {
    return await prisma.projectClass.update({
      where: { id },
      data: {
        ...(administered !== undefined && { administered }),
        ...(statistics !== undefined && { statistics }),
        ...(order !== undefined && { order }),
      },
      include: {
        class: true,
        project: true,
      },
    })
  } catch (error) {
    console.error(`Failed to update project class ${id}:`, error)
    throw error
  }
}

/**
 * Reorder project classes
 */
export const reorderProjectClasses = async (
  options: ReorderProjectClassesOptions
): Promise<void> => {
  const { orderedIds } = options

  try {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.projectClass.update({
          where: { id },
          data: { order: index },
        })
      )
    )
  } catch (error) {
    console.error("Failed to reorder project classes:", error)
    throw error
  }
}

/**
 * Remove a class from a project
 */
export const removeProjectClass = async (id: string): Promise<ProjectClass> => {
  try {
    return await prisma.projectClass.delete({
      where: { id },
    })
  } catch (error) {
    console.error(`Failed to remove project class ${id}:`, error)
    throw error
  }
}

/**
 * Remove a class from a project by projectId and classId
 */
export const removeProjectClassByIds = async (
  projectId: string,
  classId: string
): Promise<ProjectClass> => {
  try {
    return await prisma.projectClass.delete({
      where: {
        projectId_classId: { projectId, classId },
      },
    })
  } catch (error) {
    console.error(
      `Failed to remove class ${classId} from project ${projectId}:`,
      error
    )
    throw error
  }
}

/**
 * Get all classes that are NOT in ProjectClass for a project
 * Used by ClassProjectManager to show available classes to add
 */
export const getAvailableClassesForProject = async (
  projectId: string
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
    // Get classes already associated with this project
    const existingProjectClasses = await prisma.projectClass.findMany({
      where: { projectId },
      select: { classId: true },
    })
    const existingClassIds = existingProjectClasses.map((pc) => pc.classId)

    // Get all classes not in ProjectClass
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
    console.error(
      `Failed to get available classes for project ${projectId}:`,
      error
    )
    throw error
  }
}

/**
 * クラスから生徒をプロジェクトに追加（B案: 統合型フロー）
 *
 * 1. ProjectClass を作成（administered=true, 次の order）
 * 2. クラスの生徒を出席番号順で ProjectStudent に追加
 *
 * @returns 追加された生徒数とスキップされた生徒数
 */
export const addStudentsFromClass = async (
  projectId: string,
  classId: string
): Promise<{
  added: number
  skipped: number
  projectClass: ProjectClass
}> => {
  try {
    // 1. 現在の ProjectClass の最大 order を取得
    const maxOrderResult = await prisma.projectClass.aggregate({
      where: { projectId },
      _max: { order: true },
    })
    const nextOrder = (maxOrderResult._max.order ?? -1) + 1

    // 2. ProjectClass を作成（既に存在する場合は administered=true に更新）
    const projectClass = await prisma.projectClass.upsert({
      where: {
        projectId_classId: { projectId, classId },
      },
      create: {
        projectId,
        classId,
        administered: true,
        statistics: true,
        order: nextOrder,
      },
      update: {
        administered: true,
      },
    })

    // 3. クラスの生徒を出席番号順で取得
    const memberships = await prisma.studentClassMembership.findMany({
      where: { classId },
      orderBy: [{ attendanceNumber: "asc" }],
      include: { student: true },
    })

    // 4. 既存の ProjectStudent を取得
    const existingProjectStudents = await prisma.projectStudent.findMany({
      where: { projectId },
      select: { studentId: true, customOrder: true },
    })
    const existingStudentIds = new Set(
      existingProjectStudents.map((ps) => ps.studentId)
    )

    // 5. 現在の最大 customOrder を取得
    const maxCustomOrder = existingProjectStudents.reduce(
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
      await prisma.projectStudent.createMany({
        data: studentsToAdd.map(({ studentId, customOrder }) => ({
          projectId,
          studentId,
          status: "PARTICIPATING",
          customOrder,
        })),
      })
    }

    return {
      added: studentsToAdd.length,
      skipped: memberships.length - studentsToAdd.length,
      projectClass,
    }
  } catch (error) {
    console.error(
      `Failed to add students from class ${classId} to project ${projectId}:`,
      error
    )
    throw error
  }
}

/**
 * プロジェクト内の全生徒の学級・出席番号情報を取得
 *
 * ロジック:
 * 1. ProjectClass (administered=true) を order 順で取得
 * 2. 各クラスの StudentClassMembership を取得
 * 3. 生徒ごとに、最初にマッチするクラスの情報を返す
 *
 * @returns Map<studentId, StudentClassInfo>
 */
export const getStudentClassInfoForProject = async (
  projectId: string
): Promise<Record<string, StudentClassInfo>> => {
  try {
    // 1. administered=true の ProjectClass を order 順で取得
    const projectClasses = await prisma.projectClass.findMany({
      where: {
        projectId,
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

    for (const pc of projectClasses) {
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
    console.error(
      `Failed to get student class info for project ${projectId}:`,
      error
    )
    throw error
  }
}

/**
 * 単一生徒の学級・出席番号情報を取得
 */
export const getStudentClassInfo = async (
  projectId: string,
  studentId: string
): Promise<StudentClassInfo> => {
  try {
    // administered=true の ProjectClass を order 順で取得
    const projectClasses = await prisma.projectClass.findMany({
      where: {
        projectId,
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
    for (const pc of projectClasses) {
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
      `Failed to get student class info for student ${studentId} in project ${projectId}:`,
      error
    )
    throw error
  }
}
