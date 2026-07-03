/**
 * 生徒アーカイブ データ収集
 *
 * 選択された生徒と関連する学級・所属データをPrismaから取得
 */

import type {
  ArchiveClassesData,
  ArchiveStudentsData,
} from "../../../../src/types/examArchive.types"
import type { StudentArchiveDataCounts } from "../../../../src/types/studentArchive.types"
import prisma from "../../prisma/client"

export interface CollectedStudentArchiveData {
  studentsData: ArchiveStudentsData
  classesData: ArchiveClassesData
  counts: StudentArchiveDataCounts
}

/**
 * 生徒アーカイブ用のデータを収集
 *
 * @param studentIds - エクスポート対象の生徒ID
 * @param classIds - エクスポート対象の学級ID（省略時: 選択生徒に関連する全学級）
 */
export async function collectStudentArchiveData(
  studentIds: string[],
  classIds?: string[]
): Promise<CollectedStudentArchiveData> {
  // 1. 生徒を取得
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
  })

  // 2. 全ての所属を取得
  const allMemberships = await prisma.studentClassMembership.findMany({
    where: { studentId: { in: studentIds } },
  })

  // 3. 関連する学級IDを導出
  const relatedClassIds = [
    ...new Set(allMemberships.map((membership) => membership.classroomId)),
  ]

  // classIdsが指定されていればフィルタ
  const targetClassIds = classIds
    ? relatedClassIds.filter((id) => classIds.includes(id))
    : relatedClassIds

  // 4. 学級を取得
  const classes = await prisma.classroom.findMany({
    where: { id: { in: targetClassIds } },
  })

  // 5. 所属をフィルタ（対象学級のもののみ）
  const targetClassIdSet = new Set(targetClassIds)
  const filteredMemberships = allMemberships.filter((membership) =>
    targetClassIdSet.has(membership.classroomId)
  )

  // 6. アーカイブ形式に整形
  const studentsData: ArchiveStudentsData = {
    students: students.map((student) => ({
      id: student.id,
      studentNumber: student.studentNumber,
      lastName: student.lastName,
      firstName: student.firstName,
      lastNameKana: student.lastNameKana,
      firstNameKana: student.firstNameKana,
      enrollmentYear: student.enrollmentYear,
      createdAt: student.createdAt.toISOString(),
      updatedAt: student.updatedAt.toISOString(),
    })),
  }

  const classesData: ArchiveClassesData = {
    classrooms: classes.map((classroom) => ({
      id: classroom.id,
      name: classroom.name,
      classCode: classroom.classCode,
      grade: classroom.grade,
      description: classroom.description,
      isVisible: classroom.isVisible,
      createdAt: classroom.createdAt.toISOString(),
      updatedAt: classroom.updatedAt.toISOString(),
    })),
    memberships: filteredMemberships.map((membership) => ({
      id: membership.id,
      studentId: membership.studentId,
      classroomId: membership.classroomId,
      startDate: membership.startDate.toISOString(),
      endDate: membership.endDate ? membership.endDate.toISOString() : null,
      attendanceNumber: membership.attendanceNumber,
      notes: membership.notes,
      createdAt: membership.createdAt.toISOString(),
      updatedAt: membership.updatedAt.toISOString(),
    })),
  }

  return {
    studentsData,
    classesData,
    counts: {
      students: students.length,
      classrooms: classes.length,
      memberships: filteredMemberships.length,
    },
  }
}
