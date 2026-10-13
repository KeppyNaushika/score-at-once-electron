/**
 * 生徒アーカイブ（.students）の取り込みで、学級の所属（在籍）の件数を正しく数える（issue #1514）
 *
 * テスト対象: electron-src/lib/import/student-archive/index.ts（executeStudentImport）と
 * electron-src/lib/import/merge/importSyncRecords.ts（processMemberships）
 *
 * 以前は対応表（idMappings.membership）の大きさを「作成」に数えていたので、既存の所属に
 * 当たった行（作っていない行）まで作成に数え、更新・変更なしは常に 0 だった。
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import type { ExtractedStudentArchiveData } from "../../../electron-src/lib/import/student-archive/archiveExtractor"
import type { StudentArchiveIdIntegrationConfig } from "../../../src/types/studentArchive.types"
import { STUDENT_CURRENT_VERSION } from "../../../src/types/studentArchive.types"
import {
  createArchiveClassesData,
  createArchiveStudentsData,
  generateId,
} from "../../helpers/testDataFactory"
import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"

// Prismaクライアントのモック: Electron依存を回避
vi.mock("../../../electron-src/lib/prisma/client", () => {
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import {
  executeStudentImport,
  performStudentPreMatching,
} from "../../../electron-src/lib/import/student-archive"

const prisma = getTestPrismaClient()

/** 既存の生徒・学級・所属を1つずつ作る（所属は古い時刻で） */
async function seedExistingMembership() {
  const studentId = generateId()
  const classroomId = generateId()
  const membershipId = generateId()
  await prisma.student.create({
    data: {
      id: studentId,
      studentNumber: "S001",
      lastName: "姓1",
      firstName: "名1",
      lastNameKana: "セイ1",
      firstNameKana: "メイ1",
      enrollmentYear: 2024,
    },
  })
  await prisma.classroom.create({
    data: { id: classroomId, name: "1年A組", classroomCode: "1A", grade: 1 },
  })
  await prisma.studentClassroomMembership.create({
    data: {
      id: membershipId,
      studentId,
      classroomId,
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      attendanceNumber: 1,
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    },
  })
  return { studentId, classroomId, membershipId }
}

function createStudentArchive(
  studentsData: ExtractedStudentArchiveData["studentsData"],
  classesData: ExtractedStudentArchiveData["classesData"]
): ExtractedStudentArchiveData {
  return {
    manifest: {
      archiveType: "students",
      version: STUDENT_CURRENT_VERSION,
      appVersion: "test",
      exportedAt: new Date().toISOString(),
      counts: {
        students: studentsData.students.length,
        classrooms: classesData.classrooms.length,
        memberships: classesData.memberships.length,
      },
    },
    studentsData,
    classesData,
    tempDir: "/tmp/unused",
  }
}

const integrationConfig: StudentArchiveIdIntegrationConfig = {
  student: { strategy: "by_student_number", decisions: [] },
  classroom: { strategy: "by_name", decisions: [] },
}

describe("生徒アーカイブの取り込み: 所属の件数", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  it("既存の所属に当たった行は作成に数えない（変更なし・作成を実際の結果で数える）", async () => {
    const existing = await seedExistingMembership()
    const newStudentId = generateId()

    const studentsData = createArchiveStudentsData([
      { id: existing.studentId, studentNumber: "S001" },
      { id: newStudentId, studentNumber: "S002" },
    ])
    const classesData = createArchiveClassesData(
      [{ id: existing.classroomId, name: "1年A組", classroomCode: "1A" }],
      [
        // 既存と同じ生徒×学級（別 id）。アーカイブの方が古いので書き換えない
        {
          studentId: existing.studentId,
          classroomId: existing.classroomId,
          attendanceNumber: 1,
        },
        // 新しい生徒の所属は作る
        {
          studentId: newStudentId,
          classroomId: existing.classroomId,
          attendanceNumber: 2,
        },
      ]
    )
    // 既存の所属より古い時刻にする（統合する＝新しい方を残す、なので変更なし）
    const staleMembership = {
      ...classesData.memberships[0],
      updatedAt: "2025-01-01T00:00:00.000Z",
    }
    const archive = createStudentArchive(studentsData, {
      ...classesData,
      memberships: [staleMembership, classesData.memberships[1]],
    })

    const preMatchResult = await performStudentPreMatching(archive)
    const { summary } = await executeStudentImport(
      archive,
      preMatchResult,
      integrationConfig,
      "merge"
    )

    expect(summary.created.memberships).toBe(1)
    expect(summary.unchanged.memberships).toBe(1)
    expect(summary.updated.memberships).toBe(0)
    expect(await prisma.studentClassroomMembership.count()).toBe(2)
  })

  it("既存の所属を新しい値で書き換えた行は更新に数える", async () => {
    const existing = await seedExistingMembership()

    const studentsData = createArchiveStudentsData([
      { id: existing.studentId, studentNumber: "S001" },
    ])
    const classesData = createArchiveClassesData(
      [{ id: existing.classroomId, name: "1年A組", classroomCode: "1A" }],
      [
        {
          studentId: existing.studentId,
          classroomId: existing.classroomId,
          attendanceNumber: 5,
        },
      ]
    )
    const archive = createStudentArchive(studentsData, classesData)

    const preMatchResult = await performStudentPreMatching(archive)
    const { summary } = await executeStudentImport(
      archive,
      preMatchResult,
      integrationConfig,
      "merge"
    )

    expect(summary.created.memberships).toBe(0)
    expect(summary.updated.memberships).toBe(1)
    expect(summary.unchanged.memberships).toBe(0)
    const membership =
      await prisma.studentClassroomMembership.findUniqueOrThrow({
        where: { id: existing.membershipId },
      })
    expect(membership.attendanceNumber).toBe(5)
  })
})
