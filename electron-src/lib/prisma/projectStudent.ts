import prisma from './client'
import { ProjectStudentStatus } from '@prisma/client'

/**
 * プロジェクトに関連する生徒を取得
 */
export async function getStudentsForProject(projectId: string) {
  try {
    // プロジェクトに参加している生徒を取得
    const projectStudents = await prisma.projectStudent.findMany({
      where: { projectId },
      include: {
        student: {
          include: {
            memberships: {
              include: {
                class: true
              },
              where: {
                endDate: null
              },
              orderBy: {
                startDate: 'desc'
              }
            }
          }
        }
      }
    })

    const studentsWithStatus = projectStudents.map((projectStudent: any) => ({
      ...projectStudent.student,
      status: projectStudent.status.toLowerCase() as 'participating' | 'expected' | 'absent',
      isInProject: true,
      customOrder: projectStudent.customOrder
    }))

    return {
      success: true,
      students: studentsWithStatus
    }
  } catch (error) {
    console.error('Error fetching students for project:', error)
    return {
      success: false,
      error: 'Failed to fetch students for project'
    }
  }
}

/**
 * プロジェクトに生徒を追加
 */
export async function addStudentsToProject(projectId: string, studentIds: string[]) {
  try {
    // 既に参加している生徒を除外
    const existingProjectStudents = await prisma.projectStudent.findMany({
      where: {
        projectId,
        studentId: { in: studentIds }
      },
      select: { studentId: true }
    })
    const existingStudentIds = new Set(existingProjectStudents.map(ps => ps.studentId))
    const newStudentIds = studentIds.filter(id => !existingStudentIds.has(id))

    // 新しい生徒をプロジェクトに追加
    if (newStudentIds.length > 0) {
      await prisma.projectStudent.createMany({
        data: newStudentIds.map(studentId => ({
          projectId,
          studentId,
          status: ProjectStudentStatus.PARTICIPATING
        }))
      })
    }

    return {
      success: true
    }
  } catch (error) {
    console.error('Error adding students to project:', error)
    return {
      success: false,
      error: 'Failed to add students to project'
    }
  }
}

/**
 * プロジェクトから生徒を削除
 */
export async function removeStudentsFromProject(projectId: string, studentIds: string[]) {
  try {
    // プロジェクトから生徒を削除
    await prisma.projectStudent.deleteMany({
      where: {
        projectId,
        studentId: { in: studentIds }
      }
    })

    // 関連するAnswerSheetを削除
    await prisma.answerSheet.deleteMany({
      where: {
        projectId: projectId,
        studentId: {
          in: studentIds
        }
      }
    })

    return {
      success: true
    }
  } catch (error) {
    console.error('Error removing students from project:', error)
    return {
      success: false,
      error: 'Failed to remove students from project'
    }
  }
}

/**
 * プロジェクト内での生徒の状態を更新
 */
export async function updateStudentProjectStatus(
  projectId: string, 
  studentId: string, 
  status: 'participating' | 'expected' | 'absent'
) {
  try {
    // statusを大文字に変換してenumに合わせる
    const enumStatus = status.toUpperCase() as ProjectStudentStatus

    await prisma.projectStudent.updateMany({
      where: {
        projectId,
        studentId
      },
      data: {
        status: enumStatus
      }
    })

    return {
      success: true
    }
  } catch (error) {
    console.error('Error updating student project status:', error)
    return {
      success: false,
      error: 'Failed to update student project status'
    }
  }
}

/**
 * プロジェクト内での生徒の並び順を更新
 */
export async function updateStudentOrders(
  projectId: string,
  studentOrders: { studentId: string; customOrder: number }[]
) {
  try {
    // 各生徒の並び順を更新
    for (const { studentId, customOrder } of studentOrders) {
      // customOrderが-1の場合はnullにリセット（デフォルト順序）
      const orderValue = customOrder === -1 ? null : customOrder
      
      await prisma.projectStudent.updateMany({
        where: {
          projectId,
          studentId
        },
        data: {
          customOrder: orderValue
        }
      })
    }

    return {
      success: true
    }
  } catch (error) {
    console.error('Error updating student orders:', error)
    return {
      success: false,
      error: 'Failed to update student orders'
    }
  }
}

/**
 * プロジェクトに参加していない学級を取得
 */
export async function getClassesNotInProject(projectId: string) {
  try {
    // 全ての学級を取得
    const allClasses = await prisma.class.findMany({
      include: {
        memberships: {
          include: {
            student: true
          },
          where: {
            endDate: null
          }
        }
      }
    })

    // プロジェクトに既に参加している生徒IDを取得
    const projectStudents = await prisma.projectStudent.findMany({
      where: { projectId },
      select: { studentId: true }
    })
    const participatingStudentIds = new Set(projectStudents.map(ps => ps.studentId))

    // プロジェクトに参加していない学級を抽出
    const availableClasses = allClasses
      .map((cls: any) => {
        const activeStudents = cls.memberships.map((m: any) => m.student)
        const nonParticipatingStudents = activeStudents.filter(
          (student: any) => !participatingStudentIds.has(student.id)
        )
        
        return {
          ...cls,
          studentCount: nonParticipatingStudents.length
        }
      })
      .filter((cls: any) => cls.studentCount > 0)

    return {
      success: true,
      classes: availableClasses
    }
  } catch (error) {
    console.error('Error fetching classes not in project:', error)
    return {
      success: false,
      error: 'Failed to fetch available classes'
    }
  }
}