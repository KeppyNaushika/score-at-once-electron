/**
 * 取り込みが「誰の採点か」を壊さないことの統合テスト
 *
 * 採点行の同一性は (設問, 受験者, **採点者**) の3つ組。QuestionScore に unique が
 * 無いのは、同じマスに教員の数だけ行が並ぶのが正常だから。採点者を見ずに1行拾って
 * 上書きすると、**別の教員の採点が黙って消える**。
 *
 * 併せて、並び順の詰め直しが「行が増えないとき」も走ることを見る。上書き／統合は
 * 既存行の customOrder も書き換えるので、行が増えない取り込みでも番号は重なる。
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createArchiveClassesData,
  createArchiveExamData,
  createArchiveScoresData,
  createArchiveStudentsData,
  createArchiveSubtotalsData,
  createArchiveUsersData,
  createExtractedArchiveData,
  createFileOverviewData,
  createIdIntegrationConfig,
  createMatchedItem,
  createPreMatchingResult,
  createUserPreMatchingResult,
  generateId,
} from "../../helpers/testDataFactory"
import {
  cleanupTestDatabase,
  createTestUser,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"

vi.mock("../../../electron-src/lib/prisma/client", () => {
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

vi.mock("../../../electron-src/lib/dataManager", () => ({
  getDataDirectory: () => "/tmp/test-data",
}))

vi.mock("../../../electron-src/lib/import/merge/imageImporter", () => ({
  copyImportImages: vi.fn().mockResolvedValue(undefined),
  createImportImageRecords: vi.fn().mockResolvedValue(undefined),
}))

import { executeIdIntegrationImport } from "../../../electron-src/lib/import/merge/idIntegrationImporter"

const prisma = getTestPrismaClient()

/** アーカイブの受験者1行 */
function archiveExamStudent(options: {
  id: string
  examId: string
  studentId: string
  customOrder: number | null
  updatedAt: string
}) {
  return {
    id: options.id,
    examId: options.examId,
    studentId: options.studentId,
    status: "participating",
    customOrder: options.customOrder,
    createdAt: new Date("2026-01-01").toISOString(),
    updatedAt: options.updatedAt,
  }
}

describe("取り込みと採点者", () => {
  let importer: { id: string; username: string; name: string }

  beforeEach(async () => {
    await cleanupTestDatabase()
    importer = await createTestUser({ username: "importer" })
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  /**
   * 生徒1人・設問1つの試験を1件だけ持つアーカイブを組み立てる。
   * 採点行の採点者は `graderUserId`。
   */
  function createArchive(options: {
    graderUserId: string
    graderUsername: string
    scoreStatus: string
    scorePartialScore: string
    scoreUpdatedAt: string
    students: Array<{ id: string; studentNumber: string; customOrder: number }>
  }) {
    const examData = createArchiveExamData({
      pageCount: 1,
      cropRegionsPerPage: 1,
    })
    const examId = examData.exam.id
    const cropRegionId = examData.cropRegions[0].id
    const examStudentIdByStudentId = new Map(
      options.students.map((student) => [student.id, generateId()])
    )
    examData.examStudents = options.students.map((student) =>
      archiveExamStudent({
        id: examStudentIdByStudentId.get(student.id)!,
        examId,
        studentId: student.id,
        customOrder: student.customOrder,
        updatedAt: options.scoreUpdatedAt,
      })
    )

    const firstStudent = options.students[0]
    const data = createExtractedArchiveData({
      examData,
      studentsData: createArchiveStudentsData(
        options.students.map((student) => ({
          id: student.id,
          studentNumber: student.studentNumber,
        }))
      ),
      classesData: createArchiveClassesData(),
      usersData: createArchiveUsersData([
        {
          id: options.graderUserId,
          username: options.graderUsername,
          name: options.graderUsername,
        },
      ]),
      subtotalsData: createArchiveSubtotalsData(),
      scoresData: createArchiveScoresData([
        {
          cropRegionId,
          examStudentId: examStudentIdByStudentId.get(firstStudent.id)!,
          status: options.scoreStatus,
          partialScore: options.scorePartialScore,
          userId: options.graderUserId,
        },
      ]),
    })
    data.scoresData.questionScores[0].updatedAt = options.scoreUpdatedAt

    return { data, examId, cropRegionId, examStudentIdByStudentId }
  }

  /** 全て新規（試験ID不一致）として取り込むときの事前照合 */
  function freshPreMatch(
    data: ReturnType<typeof createArchive>["data"],
    examId: string,
    graderUserIds: string[]
  ) {
    return createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      user: createUserPreMatchingResult(graderUserIds),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト試験",
      },
    })
  }

  /** 同じ試験へ重ねて取り込むときの事前照合 */
  function mergePreMatch(
    data: ReturnType<typeof createArchive>["data"],
    examId: string,
    graderUserIds: string[]
  ) {
    return createFileOverviewData({
      student: createPreMatchingResult({
        byId: data.studentsData.students.map((student) =>
          createMatchedItem({ importId: student.id, existingId: student.id })
        ),
      }),
      user: createUserPreMatchingResult(graderUserIds),
      exam: {
        isIdMatch: true,
        importExamId: examId,
        existingExamId: examId,
        importData: {},
        existingData: {},
        displayLabel: "テスト試験",
      },
    })
  }

  it("同じマスに別の教員の採点があっても、その行は残り、その教員のものであり続ける", async () => {
    const otherTeacher = await createTestUser({ username: "teacher-b" })
    const studentId = generateId()

    // 1回目: 取り込む人（importer）の採点だけを持つアーカイブを入れる
    const first = createArchive({
      graderUserId: importer.id,
      graderUsername: importer.username,
      scoreStatus: "unscored",
      scorePartialScore: "0",
      scoreUpdatedAt: new Date("2026-02-01").toISOString(),
      students: [{ id: studentId, studentNumber: "S001", customOrder: 1 }],
    })
    await executeIdIntegrationImport(
      first.data,
      freshPreMatch(first.data, first.examId, [importer.id]),
      createIdIntegrationConfig(),
      importer.id
    )

    const examStudent = await prisma.examStudent.findFirstOrThrow({
      where: { examId: first.examId, studentId },
    })

    // 2回目の取り込みの前に、別の教員が同じマスへ採点を入れる
    const otherTeacherScore = await prisma.questionScore.create({
      data: {
        id: generateId(),
        cropRegionId: first.cropRegionId,
        examStudentId: examStudent.id,
        status: "incorrect",
        partialScore: 0,
        comment: "B先生の覚え書き",
        userId: otherTeacher.id,
        updatedAt: new Date("2026-03-01"),
      },
    })

    // 2回目: 同じマスに、取り込む人の新しい採点が入ったアーカイブを重ねる
    first.data.scoresData.questionScores[0].status = "correct"
    first.data.scoresData.questionScores[0].partialScore = "10"
    first.data.scoresData.questionScores[0].updatedAt = new Date(
      "2026-04-01"
    ).toISOString()

    await executeIdIntegrationImport(
      first.data,
      mergePreMatch(first.data, first.examId, [importer.id]),
      createIdIntegrationConfig({ exam: "merge" }),
      importer.id
    )

    // 別の教員の行は残り、中身も持ち主も変わらない
    const survivingScore = await prisma.questionScore.findUnique({
      where: { id: otherTeacherScore.id },
    })
    expect(survivingScore).not.toBeNull()
    expect(survivingScore!.userId).toBe(otherTeacher.id)
    expect(survivingScore!.status).toBe("incorrect")
    expect(survivingScore!.partialScore?.toNumber() ?? null).toBe(0)
    expect(survivingScore!.comment).toBe("B先生の覚え書き")

    // 取り込んだ側の行は、取り込む人の行だけが書き換わる
    const importerScores = await prisma.questionScore.findMany({
      where: {
        cropRegionId: first.cropRegionId,
        examStudentId: examStudent.id,
        userId: importer.id,
      },
    })
    expect(importerScores).toHaveLength(1)
    expect(importerScores[0].status).toBe("correct")
  })

  it("アーカイブの採点者がこのPCに居なければ、その人を作ってその人の採点として入れる", async () => {
    const studentId = generateId()
    const archiveGraderId = generateId()
    const archive = createArchive({
      graderUserId: archiveGraderId,
      graderUsername: "grader-from-other-pc",
      scoreStatus: "correct",
      scorePartialScore: "10",
      scoreUpdatedAt: new Date("2026-02-01").toISOString(),
      students: [{ id: studentId, studentNumber: "S001", customOrder: 1 }],
    })

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: archive.data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      // 別PCの採点者なので、id でも利用者名でも当たらない
      user: createPreMatchingResult({
        noMatch: [
          {
            importId: archiveGraderId,
            importData: {},
            displayLabel: "grader-from-other-pc",
          },
        ],
      }),
      exam: {
        isIdMatch: false,
        importExamId: archive.examId,
        importData: {},
        displayLabel: "テスト試験",
      },
    })

    await executeIdIntegrationImport(
      archive.data,
      preMatch,
      createIdIntegrationConfig(),
      importer.id
    )

    const createdGrader = await prisma.user.findUnique({
      where: { id: archiveGraderId },
    })
    expect(createdGrader).not.toBeNull()
    expect(createdGrader!.username).toBe("grader-from-other-pc")

    const scores = await prisma.questionScore.findMany({
      where: { cropRegion: { examPage: { examId: archive.examId } } },
    })
    expect(scores).toHaveLength(1)
    // 取り込んだ人のものにはしない
    expect(scores[0].userId).toBe(archiveGraderId)
  })

  it("人が「既存の利用者に結ぶ」を選べば、その利用者の採点として入る", async () => {
    const localTeacher = await createTestUser({ username: "local-teacher" })
    const studentId = generateId()
    const archiveGraderId = generateId()
    const archive = createArchive({
      graderUserId: archiveGraderId,
      graderUsername: "grader-from-other-pc",
      scoreStatus: "correct",
      scorePartialScore: "10",
      scoreUpdatedAt: new Date("2026-02-01").toISOString(),
      students: [{ id: studentId, studentNumber: "S001", customOrder: 1 }],
    })

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: archive.data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      user: createPreMatchingResult({
        noMatch: [
          {
            importId: archiveGraderId,
            importData: {},
            displayLabel: "grader-from-other-pc",
          },
        ],
      }),
      exam: {
        isIdMatch: false,
        importExamId: archive.examId,
        importData: {},
        displayLabel: "テスト試験",
      },
    })

    await executeIdIntegrationImport(
      archive.data,
      preMatch,
      createIdIntegrationConfig({
        user: {
          strategy: "individual",
          decisions: [
            {
              importId: archiveGraderId,
              decisionType: "same_person",
              existingId: localTeacher.id,
            },
          ],
        },
      }),
      importer.id
    )

    expect(
      await prisma.user.findUnique({ where: { id: archiveGraderId } })
    ).toBeNull()
    const scores = await prisma.questionScore.findMany({
      where: { cropRegion: { examPage: { examId: archive.examId } } },
    })
    expect(scores).toHaveLength(1)
    expect(scores[0].userId).toBe(localTeacher.id)
  })

  it("行が1つも増えない取り込みでも、名簿の並びは 1..n へ詰め直される", async () => {
    const firstStudentId = generateId()
    const secondStudentId = generateId()

    // 1回目: 2人ぶんの名簿を入れる（1番・2番）
    const both = createArchive({
      graderUserId: importer.id,
      graderUsername: importer.username,
      scoreStatus: "unscored",
      scorePartialScore: "0",
      scoreUpdatedAt: new Date("2026-02-01").toISOString(),
      students: [
        { id: firstStudentId, studentNumber: "S001", customOrder: 1 },
        { id: secondStudentId, studentNumber: "S002", customOrder: 2 },
      ],
    })
    await executeIdIntegrationImport(
      both.data,
      freshPreMatch(both.data, both.examId, [importer.id]),
      createIdIntegrationConfig(),
      importer.id
    )

    // 2回目: 1人目だけを含み、その並び順が 2 になったアーカイブを重ねる。
    // 行は1つも増えないが、既存行の customOrder は書き換わるので 2 が2つ並ぶ
    both.data.examData.examStudents = [both.data.examData.examStudents[0]]
    both.data.examData.examStudents[0].customOrder = 2
    both.data.examData.examStudents[0].updatedAt = new Date(
      "2026-05-01"
    ).toISOString()
    both.data.studentsData.students = [both.data.studentsData.students[0]]

    const result = await executeIdIntegrationImport(
      both.data,
      mergePreMatch(both.data, both.examId, [importer.id]),
      createIdIntegrationConfig({ exam: "merge" }),
      importer.id
    )
    expect(result.summary.created.students).toBe(0)

    const examStudents = await prisma.examStudent.findMany({
      where: { examId: both.examId },
      include: { student: true },
    })
    expect(examStudents).toHaveLength(2)
    expect(
      examStudents
        .map((examStudent) => examStudent.customOrder)
        .sort((left, right) => (left ?? 0) - (right ?? 0))
    ).toEqual([1, 2])
  })

  it("何も変わらない取り込みでは、名簿の updatedAt を動かさない", async () => {
    const studentId = generateId()
    const archive = createArchive({
      graderUserId: importer.id,
      graderUsername: importer.username,
      scoreStatus: "correct",
      scorePartialScore: "10",
      scoreUpdatedAt: new Date("2026-02-01").toISOString(),
      students: [{ id: studentId, studentNumber: "S001", customOrder: 1 }],
    })
    await executeIdIntegrationImport(
      archive.data,
      freshPreMatch(archive.data, archive.examId, [importer.id]),
      createIdIntegrationConfig(),
      importer.id
    )

    const before = await prisma.examStudent.findFirstOrThrow({
      where: { examId: archive.examId },
    })

    await executeIdIntegrationImport(
      archive.data,
      mergePreMatch(archive.data, archive.examId, [importer.id]),
      createIdIntegrationConfig({ exam: "merge" }),
      importer.id
    )

    const after = await prisma.examStudent.findUniqueOrThrow({
      where: { id: before.id },
    })
    expect(after.updatedAt.toISOString()).toBe(before.updatedAt.toISOString())
    expect(after.customOrder).toBe(before.customOrder)
  })
})
