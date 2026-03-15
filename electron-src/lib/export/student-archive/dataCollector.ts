/**
 * 生徒アーカイブ データ収集
 *
 * 選択された生徒と関連する学級・所属データをPrismaから取得
 */

import type {
  ArchiveClassesData,
  ArchiveStudentsData,
} from "../../../../types/examArchive.types"
import type { StudentArchiveDataCounts } from "../../../../types/studentArchive.types"
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
  const relatedClassIds = [...new Set(allMemberships.map((m) => m.classId))]

  // classIdsが指定されていればフィルタ
  const targetClassIds = classIds
    ? relatedClassIds.filter((id) => classIds.includes(id))
    : relatedClassIds

  // 4. 学級を取得
  const classes = await prisma.class.findMany({
    where: { id: { in: targetClassIds } },
  })

  // 5. 所属をフィルタ（対象学級のもののみ）
  const targetClassIdSet = new Set(targetClassIds)
  const filteredMemberships = allMemberships.filter((m) =>
    targetClassIdSet.has(m.classId)
  )

  // 6. アーカイブ形式に整形
  const studentsData: ArchiveStudentsData = {
    students: students.map((s) => ({
      id: s.id,
      studentNumber: s.studentNumber,
      lastName: s.lastName,
      firstName: s.firstName,
      lastNameKana: s.lastNameKana,
      firstNameKana: s.firstNameKana,
      enrollmentYear: s.enrollmentYear,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
  }

  const classesData: ArchiveClassesData = {
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      classCode: c.classCode,
      grade: c.grade,
      description: c.description,
      isVisible: c.isVisible,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
    memberships: filteredMemberships.map((m) => ({
      id: m.id,
      studentId: m.studentId,
      classId: m.classId,
      startDate: m.startDate.toISOString(),
      endDate: m.endDate ? m.endDate.toISOString() : null,
      attendanceNumber: m.attendanceNumber,
      notes: m.notes,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
  }

  return {
    studentsData,
    classesData,
    counts: {
      students: students.length,
      classes: classes.length,
      memberships: filteredMemberships.length,
    },
  }
}
