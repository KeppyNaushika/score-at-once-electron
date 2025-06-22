import prisma from './client'
import type { StudentWithMemberships } from '../../../types/electron'

// プロジェクトに参加する生徒の状態を管理するためのテーブル（メモリ上で管理）
const projectStudentStatus = new Map<string, Map<string, 'participating' | 'absent' | 'unknown'>>()

/**
 * プロジェクトに関連する生徒を取得
 */
export async function getStudentsForProject(projectId: string) {
  try {
    // 全ての生徒を取得
    const allStudents = await prisma.student.findMany({
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
    })

    // プロジェクトの生徒状態を取得
    const projectStatusMap = projectStudentStatus.get(projectId) || new Map()

    // 既にプロジェクトに追加されている生徒IDを取得
    const existingAnswerSheets = await prisma.answerSheet.findMany({
      where: { projectId },
      select: { studentId: true }
    })
    const existingStudentIds = new Set(
      existingAnswerSheets
        .map(sheet => sheet.studentId)
        .filter((id): id is string => id !== null)
    )

    const studentsWithStatus = allStudents.map(student => ({
      ...student,
      status: projectStatusMap.get(student.id) || 'unknown' as const,
      isInProject: existingStudentIds.has(student.id)
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
    // プロジェクトの状態マップを初期化（存在しない場合）
    if (!projectStudentStatus.has(projectId)) {
      projectStudentStatus.set(projectId, new Map())
    }
    const statusMap = projectStudentStatus.get(projectId)!

    // 生徒をプロジェクトに追加（状態を'unknown'に設定）
    studentIds.forEach(studentId => {
      if (!statusMap.has(studentId)) {
        statusMap.set(studentId, 'unknown')
      }
    })

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
    const statusMap = projectStudentStatus.get(projectId)
    if (statusMap) {
      studentIds.forEach(studentId => {
        statusMap.delete(studentId)
      })
    }

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
  status: 'participating' | 'absent'
) {
  try {
    if (!projectStudentStatus.has(projectId)) {
      projectStudentStatus.set(projectId, new Map())
    }
    const statusMap = projectStudentStatus.get(projectId)!
    statusMap.set(studentId, status)

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
    const projectStatusMap = projectStudentStatus.get(projectId) || new Map()
    const participatingStudentIds = new Set(Array.from(projectStatusMap.keys()))

    // プロジェクトに参加していない学級を抽出
    const availableClasses = allClasses
      .map(cls => {
        const activeStudents = cls.memberships.map(m => m.student)
        const nonParticipatingStudents = activeStudents.filter(
          student => !participatingStudentIds.has(student.id)
        )
        
        return {
          ...cls,
          studentCount: nonParticipatingStudents.length
        }
      })
      .filter(cls => cls.studentCount > 0)

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