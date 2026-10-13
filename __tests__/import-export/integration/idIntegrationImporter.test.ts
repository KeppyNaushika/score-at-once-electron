/**
 * idIntegrationImporter の統合テスト
 *
 * テスト対象: electron-src/lib/import/merge/idIntegrationImporter.ts
 * 実際のSQLiteテスト用DBを使用し、インポートパイプライン全体を検証する
 */

import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import sharp from "sharp"
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import {
  convertPixelLengthsToMm,
  overlayPixelsPerMm,
} from "../../../src/lib/answerOverlayPlacement"
import {
  createArchiveClassesData,
  createArchiveExamData,
  createArchiveScoresData,
  createArchiveStudentsData,
  createArchiveSubtotalsData,
  createArchiveUsersData,
  createDecision,
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

// Prismaクライアントのモック
vi.mock("../../../electron-src/lib/prisma/client", () => {
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

vi.mock("../../../electron-src/lib/dataManager", () => ({
  getSharedFilesDirectory: () => "/tmp/test-data",
}))

// 画像コピーのモック（ファイルI/Oのみモック）
vi.mock("../../../electron-src/lib/import/merge/imageImporter", () => ({
  copyImportImages: vi.fn().mockResolvedValue(undefined),
  createImportImageRecords: vi.fn().mockResolvedValue(undefined),
}))

import { executeIdIntegrationImport } from "../../../electron-src/lib/import/merge/idIntegrationImporter"

const prisma = getTestPrismaClient()

describe("executeIdIntegrationImport", () => {
  let currentUser: { id: string; username: string; name: string }

  beforeEach(async () => {
    await cleanupTestDatabase()
    currentUser = await createTestUser()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  /**
   * 基本的なテストデータを作成するヘルパー
   */
  function createBasicTestData(
    overrides: {
      examId?: string
      studentId?: string
      studentNumber?: string
      classroomId?: string
      className?: string
      groupId?: string
      groupName?: string
    } = {}
  ) {
    const examId = overrides.examId ?? generateId()
    const studentId = overrides.studentId ?? generateId()
    const classroomId = overrides.classroomId ?? generateId()
    const groupId = overrides.groupId ?? generateId()
    const studentNumber = overrides.studentNumber ?? `SN_${Date.now()}`
    const className = overrides.className ?? `Class_${Date.now()}`
    const groupName = overrides.groupName ?? `Group_${Date.now()}`

    const examData = createArchiveExamData({
      examId,
      pageCount: 1,
      cropRegionsPerPage: 1,
    })

    // ExamStudentを追加
    const examStudentId = generateId()
    examData.examStudents = [
      {
        id: examStudentId,
        examId,
        studentId,
        status: "PARTICIPATING",
        customOrder: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    // ExamClassroomを追加
    examData.examClassrooms = [
      {
        id: generateId(),
        examId,
        classroomId,
        administered: true,
        statistics: true,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    // ExamSubtotalGroupを追加
    examData.examSubtotalGroups = [
      {
        id: generateId(),
        examId,
        subtotalGroupId: groupId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    const subtotalsData = createArchiveSubtotalsData([
      {
        id: groupId,
        name: groupName,
        subtotals: [{ name: "小計1" }],
      },
    ])

    const regionId = examData.cropRegions[0].id
    const scoreId = generateId()

    const data = createExtractedArchiveData({
      examData,
      studentsData: createArchiveStudentsData([
        { id: studentId, studentNumber, lastName: "テスト", firstName: "太郎" },
      ]),
      classesData: createArchiveClassesData(
        [{ id: classroomId, name: className }],
        [
          {
            studentId,
            classroomId,
            attendanceNumber: 1,
          },
        ]
      ),
      usersData: createArchiveUsersData([{ id: generateId() }]),
      subtotalsData,
      scoresData: createArchiveScoresData([
        {
          id: scoreId,
          cropRegionId: regionId,
          examStudentId,
          status: "correct",
          partialScore: "10",
          userId: currentUser.id,
        },
      ]),
    })

    return {
      data,
      examId,
      studentId,
      examStudentId,
      classroomId,
      groupId,
      regionId,
      scoreId,
      studentNumber,
      className,
      groupName,
    }
  }

  /**
   * 全件noMatchのpreMatchを作るヘルパー（新規インポート用）
   */
  function buildNoMatchPreMatch(
    data: ReturnType<typeof createBasicTestData>["data"],
    examId: string
  ) {
    return createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
        })),
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト",
      },
    })
  }

  // II-1: 新規インポート: 全エンティティ作成（件数は DB と summary の両方で見る）
  it("II-1: 新規インポートで全エンティティが作成され、summary の件数と一致する", async () => {
    const { data, examId, studentId, classroomId, groupId, regionId } =
      createBasicTestData()

    const result = await executeIdIntegrationImport(
      data,
      buildNoMatchPreMatch(data, examId),
      createIdIntegrationConfig(),
      currentUser.id
    )

    expect(result.examId).toBe(examId)
    expect(await prisma.exam.count({ where: { id: examId } })).toBe(1)
    expect(await prisma.examPage.count({ where: { examId } })).toBe(1)
    expect(
      await prisma.cropRegion.count({ where: { examPage: { examId } } })
    ).toBe(1)
    expect(await prisma.student.count({ where: { id: studentId } })).toBe(1)
    expect(await prisma.classroom.count({ where: { id: classroomId } })).toBe(1)
    expect(await prisma.subtotalGroup.count({ where: { id: groupId } })).toBe(1)
    expect(
      await prisma.questionScore.count({ where: { cropRegionId: regionId } })
    ).toBe(1)

    expect(result.summary.created.pages).toBe(1)
    expect(result.summary.created.regions).toBe(1)
    expect(result.summary.created.scores).toBe(1)
  })

  /** 同じ試験・同じ生徒・学級・小計グループへ重ねて取り込むときの事前照合（全て id 一致） */
  function buildIdMatchPreMatch(ids: {
    examId: string
    studentId: string
    classroomId: string
    groupId: string
  }) {
    return createFileOverviewData({
      student: createPreMatchingResult({
        byId: [
          createMatchedItem({
            importId: ids.studentId,
            existingId: ids.studentId,
          }),
        ],
      }),
      classroom: createPreMatchingResult({
        byId: [
          createMatchedItem({
            importId: ids.classroomId,
            existingId: ids.classroomId,
          }),
        ],
      }),
      subtotalGroup: createPreMatchingResult({
        byId: [
          createMatchedItem({ importId: ids.groupId, existingId: ids.groupId }),
        ],
      }),
      exam: {
        isIdMatch: true,
        importExamId: ids.examId,
        existingExamId: ids.examId,
        importData: {},
        existingData: {},
        displayLabel: "テスト",
      },
    })
  }

  // II-4: 同一PCリインポート: スコアunchanged
  it("II-4: 同一試験再インポートでスコアがunchangedとなる", async () => {
    const basic = createBasicTestData()
    const { data, examId } = basic

    await executeIdIntegrationImport(
      data,
      buildNoMatchPreMatch(data, examId),
      createIdIntegrationConfig(),
      currentUser.id
    )

    // 2回目: 同一試験としてリインポート（中身は1回目と同じ）
    const result2 = await executeIdIntegrationImport(
      data,
      buildIdMatchPreMatch(basic),
      createIdIntegrationConfig(),
      currentUser.id
    )

    expect(result2.summary.unchanged.scores).toBe(1)
    expect(result2.summary.created.scores).toBe(0)
    expect(result2.summary.updated.scores).toBe(0)
  })

  // II-5: 同一PCリインポート+スコア更新: 統合（LWW）
  it("II-5: 統合を選ぶと、後に書かれた採点が採られる", async () => {
    const basic = createBasicTestData()
    const { data, examId, studentId, regionId } = basic

    await executeIdIntegrationImport(
      data,
      buildNoMatchPreMatch(data, examId),
      createIdIntegrationConfig(),
      currentUser.id
    )

    // アーカイブの採点を、取り込み先より後に書かれた別の判定にする
    data.scoresData.questionScores[0].status = "incorrect"
    data.scoresData.questionScores[0].partialScore = "0"
    data.scoresData.questionScores[0].updatedAt = new Date(
      "2099-01-01T00:00:00.000Z"
    ).toISOString()

    const result2 = await executeIdIntegrationImport(
      data,
      buildIdMatchPreMatch(basic),
      createIdIntegrationConfig({ exam: "merge" }),
      currentUser.id
    )

    expect(result2.summary.updated.scores).toBe(1)
    const scores = await prisma.questionScore.findMany({
      where: { cropRegionId: regionId, examStudent: { studentId } },
    })
    expect(scores).toHaveLength(1)
    expect(scores[0].status).toBe("incorrect")
    expect(Number(scores[0].partialScore)).toBe(0)
    // 勝ったときの updatedAt はアーカイブの値（取り込み時刻ではない）
    expect(scores[0].updatedAt.toISOString()).toBe("2099-01-01T00:00:00.000Z")
  })

  // II-6（上書きは時刻を見ない）は edgeCases.test.ts の EC-8 が DB の値まで見るので欠番

  // II-7: 統合＋アーカイブの方が古い
  it("II-7: 統合を選び、ファイルの採点が古ければこのPCの採点が残る", async () => {
    const basic = createBasicTestData()
    const { data, examId, studentId, regionId } = basic

    await executeIdIntegrationImport(
      data,
      buildNoMatchPreMatch(data, examId),
      createIdIntegrationConfig(),
      currentUser.id
    )

    // アーカイブの採点を、取り込み先より前に書かれた別の判定にする
    data.scoresData.questionScores[0].status = "incorrect"
    data.scoresData.questionScores[0].partialScore = "0"
    data.scoresData.questionScores[0].updatedAt = new Date(
      "2000-01-01T00:00:00.000Z"
    ).toISOString()

    const result = await executeIdIntegrationImport(
      data,
      buildIdMatchPreMatch(basic),
      createIdIntegrationConfig({ exam: "merge" }),
      currentUser.id
    )

    expect(result.summary.skipped.scores).toBe(1)
    expect(result.summary.updated.scores).toBe(0)
    const scores = await prisma.questionScore.findMany({
      where: { cropRegionId: regionId, examStudent: { studentId } },
    })
    expect(scores).toHaveLength(1)
    expect(scores[0].status).toBe("correct")
  })

  // II-8: 別PCインポート: by_student_numberマッチング
  it("II-8: by_student_number戦略で学籍番号マッチした生徒がマッピングされる", async () => {
    const existingStudentId = generateId()
    const studentNumber = `BSN_${Date.now()}`

    await prisma.student.create({
      data: {
        id: existingStudentId,
        studentNumber,
        lastName: "既存",
        firstName: "生徒",
        lastNameKana: "キゾン",
        firstNameKana: "セイト",
      },
    })

    const { data, examId, studentId } = createBasicTestData({
      studentNumber,
    })

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        byStudentNumber: [
          createMatchedItem({
            importId: studentId,
            existingId: existingStudentId,
          }),
        ],
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
        })),
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト",
      },
    })

    const config = createIdIntegrationConfig({
      student: {
        strategy: "by_student_number",
        decisions: [
          createDecision({
            importId: studentId,
            decisionType: "same_person",
            existingId: existingStudentId,
            idChoice: "use_existing_id",
          }),
        ],
      },
    })

    const result = await executeIdIntegrationImport(
      data,
      preMatch,
      config,
      currentUser.id
    )

    // 受験者は既存の生徒を指し、アーカイブの生徒は作られない
    const examStudents = await prisma.examStudent.findMany({
      where: { examId: result.examId },
    })
    expect(examStudents.map((examStudent) => examStudent.studentId)).toEqual([
      existingStudentId,
    ])
    expect(
      await prisma.student.findUnique({ where: { id: studentId } })
    ).toBeNull()
    expect(await prisma.student.count({ where: { studentNumber } })).toBe(1)
  })

  // II-9: 別PCインポート: by_nameマッチング
  it("II-9: by_name戦略で氏名マッチした生徒がマッピングされる", async () => {
    const existingStudentId = generateId()

    await prisma.student.create({
      data: {
        id: existingStudentId,
        studentNumber: `BYNAME_EXISTING_${Date.now()}`,
        lastName: "氏名",
        firstName: "一致",
        lastNameKana: "シメイ",
        firstNameKana: "イッチ",
      },
    })

    const { data, examId, studentId } = createBasicTestData()
    data.studentsData.students[0].lastName = "氏名"
    data.studentsData.students[0].firstName = "一致"

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        byName: [
          createMatchedItem({
            importId: studentId,
            existingId: existingStudentId,
          }),
        ],
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
        })),
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト",
      },
    })

    const config = createIdIntegrationConfig({
      student: {
        strategy: "by_name",
        decisions: [
          createDecision({
            importId: studentId,
            decisionType: "same_person",
            existingId: existingStudentId,
            idChoice: "use_existing_id",
          }),
        ],
      },
    })

    const result = await executeIdIntegrationImport(
      data,
      preMatch,
      config,
      currentUser.id
    )

    // 受験者は既存の生徒を指し、アーカイブの生徒は作られない
    const examStudents = await prisma.examStudent.findMany({
      where: { examId: result.examId },
    })
    expect(examStudents.map((examStudent) => examStudent.studentId)).toEqual([
      existingStudentId,
    ])
    expect(
      await prisma.student.findUnique({ where: { id: studentId } })
    ).toBeNull()
  })

  // II-10: 別PCインポート: create_new決定
  it("II-10: create_new決定で新規生徒が作成される", async () => {
    const { data, examId, studentId } = createBasicTestData()

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: [
          {
            importId: studentId,
            importData: data.studentsData.students[0] as unknown as Record<
              string,
              unknown
            >,
            displayLabel: "テスト太郎",
          },
        ],
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
        })),
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト",
      },
    })

    const config = createIdIntegrationConfig({
      student: {
        strategy: "all_new",
        decisions: [
          createDecision({
            importId: studentId,
            decisionType: "create_new",
          }),
        ],
      },
    })

    const result = await executeIdIntegrationImport(
      data,
      preMatch,
      config,
      currentUser.id
    )

    expect(result.summary.created.students).toBe(1)
    const createdStudent = await prisma.student.findUnique({
      where: { id: studentId },
    })
    expect(createdStudent).not.toBeNull()
    expect(createdStudent!.lastName).toBe("テスト")
    const examStudents = await prisma.examStudent.findMany({
      where: { examId: result.examId },
    })
    expect(examStudents.map((examStudent) => examStudent.studentId)).toEqual([
      studentId,
    ])
  })

  // II-13: 出力設定（正規化済み）の作成
  // 旧アーカイブの長さは答案画像の画素。取り込みで同梱の答案画像を読み、mm へ直して書く
  describe("II-13: 重ね描きのスタイル", () => {
    let answerSheetDirectory: string

    beforeEach(() => {
      answerSheetDirectory = fs.mkdtempSync(
        path.join(os.tmpdir(), "legacy-answer-sheets-")
      )
    })

    afterEach(() => {
      fs.rmSync(answerSheetDirectory, { recursive: true, force: true })
    })

    /** 画素の重ね描きスタイルを1件持つ旧アーカイブを取り込み、書かれた行を返す */
    async function importPixelMarkStyle(answerSheetPaths: string[]) {
      const { data, examId } = createBasicTestData()
      data.answerSheetPaths = answerSheetPaths

      data.examData.answerOverlayStyles = [
        {
          id: generateId(),
          examId,
          overlayKind: "mark",
          position: "top-left",
          anchor: "top-left",
          offsetX: 3,
          offsetY: -4,
          size: 50,
          color: "#ef4444",
          opacity: 100,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]

      const preMatch = createFileOverviewData({
        student: createPreMatchingResult({
          noMatch: data.studentsData.students.map((student) => ({
            importId: student.id,
            importData: { ...student },
            displayLabel: student.lastName,
          })),
        }),
        classroom: createPreMatchingResult({
          noMatch: data.classesData.classrooms.map((classroom) => ({
            importId: classroom.id,
            importData: { ...classroom },
            displayLabel: classroom.name,
          })),
        }),
        subtotalGroup: createPreMatchingResult({
          noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
            importId: subtotalGroup.id,
            importData: { ...subtotalGroup },
            displayLabel: subtotalGroup.name,
          })),
        }),
        exam: {
          isIdMatch: false,
          importExamId: examId,
          importData: {},
          displayLabel: "テスト",
        },
      })

      const result = await executeIdIntegrationImport(
        data,
        preMatch,
        createIdIntegrationConfig(),
        currentUser.id
      )

      return prisma.examAnswerOverlayStyle.findMany({
        where: { examId: result.examId! },
      })
    }

    const writeAnswerSheet = async (
      fileName: string,
      width: number,
      height: number
    ): Promise<string> => {
      const filePath = path.join(answerSheetDirectory, fileName)
      await sharp({
        create: { width, height, channels: 3, background: "#ffffff" },
      })
        .png()
        .toFile(filePath)
      return filePath
    }

    it("同梱の答案画像で mm へ変換して作成される（描く画素は変わらない）", async () => {
      // ラベルは A4（createArchiveExamData）だが、答案は A3 を 144dpi で読んだ画像
      const styles = await importPixelMarkStyle([
        await writeAnswerSheet("1.png", 1684, 2381),
        await writeAnswerSheet("2.png", 1684, 2381),
        await writeAnswerSheet("3.png", 1191, 1684),
      ])

      expect(styles.length).toBe(1)
      expect(styles[0].position).toBe("top-left")
      expect(styles[0].lengthUnit).toBe("mm")
      const pixelsPerMm = overlayPixelsPerMm("A4", 1684, 2381)
      const expected = convertPixelLengthsToMm(
        {
          overlayKind: "mark",
          position: "top-left",
          size: 50,
          offsetX: 3,
          offsetY: -4,
        },
        pixelsPerMm
      )
      expect(styles[0].size).toBeCloseTo(expected.size, 9)
      expect(styles[0].offsetX).toBeCloseTo(expected.offsetX, 9)
      expect(styles[0].offsetY).toBeCloseTo(expected.offsetY, 9)
      expect(styles[0].size * pixelsPerMm).toBeCloseTo(50, 9)
    })

    it("答案画像の無いアーカイブは 144dpi 相当で代用して mm にする", async () => {
      const styles = await importPixelMarkStyle([])

      expect(styles[0].lengthUnit).toBe("mm")
      expect(styles[0].size).toBeCloseTo((50 * 25.4) / 144, 9)
    })

    it("読めない答案画像があれば px のまま書く（起動時の変換が拾う）", async () => {
      const styles = await importPixelMarkStyle([
        await writeAnswerSheet("1.png", 1191, 1684),
        path.join(answerSheetDirectory, "missing.png"),
      ])

      expect(styles[0].lengthUnit).toBe("px")
      expect(styles[0].size).toBe(50)
      expect(styles[0].offsetX).toBe(3)
      expect(styles[0].offsetY).toBe(-4)
    })
  })

  // II-15: Tag/TagSubtotalGroup作成（II-14 は CropRegionMarkingOverride 廃止に伴い欠番）
  it("II-15: Tag/TagSubtotalGroupが作成される", async () => {
    const { data, examId, groupId } = createBasicTestData()

    const tagId = generateId()
    data.tagsData = {
      tags: [
        {
          id: tagId,
          name: `数学_${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      tagSubtotalGroups: [
        {
          id: generateId(),
          tagId,
          subtotalGroupId: groupId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      examTags: [],
    }

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
        })),
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト",
      },
    })

    await executeIdIntegrationImport(
      data,
      preMatch,
      createIdIntegrationConfig(),
      currentUser.id
    )

    const tags = await prisma.tag.findMany({
      where: { id: tagId },
    })
    expect(tags.length).toBe(1)

    const tagSubtotalGroups = await prisma.tagSubtotalGroup.findMany({
      where: { tagId },
    })
    expect(tagSubtotalGroups.length).toBe(1)
  })

  // II-16: QuestionScore重複回避 (B11)
  it("II-16: 同じcropRegion+studentのQuestionScoreが重複作成されない (B11 fix)", async () => {
    const { data, examId, studentId, regionId, classroomId, groupId } =
      createBasicTestData()

    // 初回インポート
    const preMatch1 = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
        })),
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト",
      },
    })

    await executeIdIntegrationImport(
      data,
      preMatch1,
      createIdIntegrationConfig(),
      currentUser.id
    )

    // スコアIDを変更して2回目インポート（ID違いだが同じregion+student）
    const newScoreId = generateId()
    data.scoresData.questionScores[0].id = newScoreId

    const preMatch2 = createFileOverviewData({
      student: createPreMatchingResult({
        byId: [
          createMatchedItem({ importId: studentId, existingId: studentId }),
        ],
      }),
      classroom: createPreMatchingResult({
        byId: [
          createMatchedItem({ importId: classroomId, existingId: classroomId }),
        ],
      }),
      subtotalGroup: createPreMatchingResult({
        byId: [createMatchedItem({ importId: groupId, existingId: groupId })],
      }),
      exam: {
        isIdMatch: true,
        importExamId: examId,
        existingExamId: examId,
        importData: {},
        existingData: {},
        displayLabel: "テスト",
      },
    })

    await executeIdIntegrationImport(
      data,
      preMatch2,
      createIdIntegrationConfig(),
      currentUser.id
    )

    // 同じregion+studentのスコアが重複していないことを確認
    const scores = await prisma.questionScore.findMany({
      where: { cropRegionId: regionId, examStudent: { studentId } },
    })
    expect(scores.length).toBe(1)
    // 試験・生徒も重複しない（同じアーカイブの2回目は冪等）
    expect(await prisma.exam.count({ where: { id: examId } })).toBe(1)
    expect(await prisma.student.count({ where: { id: studentId } })).toBe(1)
  })

  // II-17: メンバーシップの冪等性
  it("II-17: メンバーシップが冪等にインポートされる", async () => {
    const { data, examId, studentId, classroomId, groupId } =
      createBasicTestData()

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
        })),
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト",
      },
    })

    // 2回実行
    await executeIdIntegrationImport(
      data,
      preMatch,
      createIdIntegrationConfig(),
      currentUser.id
    )

    const preMatch2 = createFileOverviewData({
      student: createPreMatchingResult({
        byId: [
          createMatchedItem({ importId: studentId, existingId: studentId }),
        ],
      }),
      classroom: createPreMatchingResult({
        byId: [
          createMatchedItem({ importId: classroomId, existingId: classroomId }),
        ],
      }),
      subtotalGroup: createPreMatchingResult({
        byId: [createMatchedItem({ importId: groupId, existingId: groupId })],
      }),
      exam: {
        isIdMatch: true,
        importExamId: examId,
        existingExamId: examId,
        importData: {},
        existingData: {},
        displayLabel: "テスト",
      },
    })

    await executeIdIntegrationImport(
      data,
      preMatch2,
      createIdIntegrationConfig(),
      currentUser.id
    )

    // メンバーシップが重複していない
    const memberships = await prisma.studentClassroomMembership.findMany({
      where: { studentId, classroomId },
    })
    expect(memberships.length).toBe(1)
  })

  // II-18: ExamClassroomsの正しいマッピング
  it("II-18: ExamClassroomsが正しく作成される", async () => {
    const { data, examId, classroomId } = createBasicTestData()

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
        })),
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト",
      },
    })

    const result = await executeIdIntegrationImport(
      data,
      preMatch,
      createIdIntegrationConfig(),
      currentUser.id
    )

    const examClassrooms = await prisma.examClassroom.findMany({
      where: { examId: result.examId! },
    })
    expect(examClassrooms.length).toBe(1)
    expect(examClassrooms[0].classroomId).toBe(classroomId)
    expect(examClassrooms[0].administered).toBe(true)
  })

  // II-19: トランザクションエラー時の全ロールバック
  it("II-19: トランザクションエラー時に全変更がロールバックされる", async () => {
    const beforeStudents = await prisma.student.count()
    const beforeExams = await prisma.exam.count()

    const { data, examId } = createBasicTestData()

    // 取り込む人に存在しない利用者を渡すと、UserExam の作成（6. UserExam）が
    // 外部キー違反で失敗する。生徒（1.）と試験（5.）はそれより前に作られているので、
    // ロールバックが効かなければ件数が増えて残る
    const fakeUserId = "non-existent-user-id-for-rollback-test"

    const preMatch = createFileOverviewData({
      student: createPreMatchingResult({
        noMatch: data.studentsData.students.map((student) => ({
          importId: student.id,
          importData: { ...student },
          displayLabel: student.lastName,
        })),
      }),
      classroom: createPreMatchingResult({
        noMatch: data.classesData.classrooms.map((classroom) => ({
          importId: classroom.id,
          importData: { ...classroom },
          displayLabel: classroom.name,
        })),
      }),
      subtotalGroup: createPreMatchingResult({
        noMatch: data.subtotalsData.subtotalGroups.map((subtotalGroup) => ({
          importId: subtotalGroup.id,
          importData: { ...subtotalGroup },
          displayLabel: subtotalGroup.name,
        })),
      }),
      exam: {
        isIdMatch: false,
        importExamId: examId,
        importData: {},
        displayLabel: "テスト",
      },
    })

    // 例外が投げられる（FK違反）
    await expect(
      executeIdIntegrationImport(
        data,
        preMatch,
        createIdIntegrationConfig(),
        fakeUserId // 存在しないユーザーIDでFK違反
      )
    ).rejects.toThrow(/Foreign key constraint violated/)

    // DBが変更されていない（トランザクションがロールバック）
    const afterStudents = await prisma.student.count()
    const afterExams = await prisma.exam.count()
    expect(afterStudents).toBe(beforeStudents)
    expect(afterExams).toBe(beforeExams)
  })

  // II-22b: v1.20.0: 採点担当（CropRegionAssignment）が merge 経路でも復元される
  it("II-22b: 採点担当がmerge経路で作成され、idは取り込み先で振り直される", async () => {
    const { data, examId, regionId } = createBasicTestData()

    const now = new Date().toISOString()
    data.scoresData.cropRegionAssignments = [
      {
        cropRegionId: regionId,
        username: currentUser.username,
        createdAt: now,
        updatedAt: now,
      },
      // 移行先に存在しないユーザーは取り込まず、警告で伝える
      {
        cropRegionId: regionId,
        username: "no_such_user",
        createdAt: now,
        updatedAt: now,
      },
    ]

    const result = await executeIdIntegrationImport(
      data,
      buildNoMatchPreMatch(data, examId),
      createIdIntegrationConfig(),
      currentUser.id
    )

    const assignments = await prisma.cropRegionAssignment.findMany({
      where: { cropRegionId: regionId },
    })
    expect(assignments.length).toBe(1)
    expect(assignments[0].userId).toBe(currentUser.id)
    // idはアーカイブから持ち回らず、取り込み先で uuidv4 を振り直す
    expect(assignments[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )

    expect(
      result.warnings?.some((warning) => warning.includes("no_such_user"))
    ).toBe(true)
  })

  // II-22c: 同一試験の再インポートで採点担当が重複しない（冪等）
  it("II-22c: 同じ採点担当の再インポートは重複を作らない", async () => {
    const { data, examId, studentId, classroomId, regionId, groupId } =
      createBasicTestData()

    const now = new Date().toISOString()
    data.scoresData.cropRegionAssignments = [
      {
        cropRegionId: regionId,
        username: currentUser.username,
        createdAt: now,
        updatedAt: now,
      },
    ]

    await executeIdIntegrationImport(
      data,
      buildNoMatchPreMatch(data, examId),
      createIdIntegrationConfig(),
      currentUser.id
    )

    // 2回目は同一試験としてリインポート（II-4 と同じ形の突合）
    const rematch = createFileOverviewData({
      student: createPreMatchingResult({
        byId: [
          createMatchedItem({ importId: studentId, existingId: studentId }),
        ],
      }),
      classroom: createPreMatchingResult({
        byId: [
          createMatchedItem({ importId: classroomId, existingId: classroomId }),
        ],
      }),
      subtotalGroup: createPreMatchingResult({
        byId: [createMatchedItem({ importId: groupId, existingId: groupId })],
      }),
      exam: {
        isIdMatch: true,
        importExamId: examId,
        existingExamId: examId,
        importData: {},
        existingData: {},
        displayLabel: "テスト",
      },
    })

    await executeIdIntegrationImport(
      data,
      rematch,
      createIdIntegrationConfig(),
      currentUser.id
    )

    const assignments = await prisma.cropRegionAssignment.findMany({
      where: { cropRegionId: regionId },
    })
    expect(assignments.length).toBe(1)
  })

  // II-23: ScoreDecisionのLWW競合解決（decidedAtが新しい方を採用）
  it("II-23: ScoreDecision競合はdecidedAtが新しい方を採用する（LWW）", async () => {
    const {
      data,
      examId,
      studentId,
      examStudentId,
      regionId,
      classroomId,
      groupId,
    } = createBasicTestData()

    const scoreDecisionId = generateId()
    const oldDate = new Date("2025-06-01T00:00:00.000Z").toISOString()
    data.scoresData.scoreDecisions = [
      {
        id: scoreDecisionId,
        cropRegionId: regionId,
        examStudentId,
        verdict: "incorrect",
        score: "0",
        comment: "旧",
        decidedByUserId: currentUser.id,
        decidedAt: oldDate,
        createdAt: oldDate,
        updatedAt: oldDate,
      },
    ]

    // 初回インポート（古い確定）
    await executeIdIntegrationImport(
      data,
      buildNoMatchPreMatch(data, examId),
      createIdIntegrationConfig(),
      currentUser.id
    )

    // 2回目: 新しいdecidedAtの確定で同一試験に再インポート
    const newDate = new Date("2025-12-01T00:00:00.000Z").toISOString()
    data.scoresData.scoreDecisions![0].verdict = "correct"
    data.scoresData.scoreDecisions![0].score = "10"
    data.scoresData.scoreDecisions![0].comment = "新"
    data.scoresData.scoreDecisions![0].decidedAt = newDate

    const preMatch2 = createFileOverviewData({
      student: createPreMatchingResult({
        byId: [
          createMatchedItem({ importId: studentId, existingId: studentId }),
        ],
      }),
      classroom: createPreMatchingResult({
        byId: [
          createMatchedItem({ importId: classroomId, existingId: classroomId }),
        ],
      }),
      subtotalGroup: createPreMatchingResult({
        byId: [createMatchedItem({ importId: groupId, existingId: groupId })],
      }),
      exam: {
        isIdMatch: true,
        importExamId: examId,
        existingExamId: examId,
        importData: {},
        existingData: {},
        displayLabel: "テスト",
      },
    })

    await executeIdIntegrationImport(
      data,
      preMatch2,
      createIdIntegrationConfig(),
      currentUser.id
    )

    // 確定は1件のまま（重複なし）、新しい方が採用される
    const decisions = await prisma.scoreDecision.findMany({
      where: { cropRegionId: regionId, examStudent: { studentId } },
    })
    expect(decisions.length).toBe(1)
    expect(decisions[0].verdict).toBe("correct")
    expect(decisions[0].comment).toBe("新")
  })

  // II-24: ScoreDecisionのLWW（既存が新しい場合は上書きしない）
  it("II-24: ScoreDecision競合で既存が新しければ上書きしない（LWW）", async () => {
    const {
      data,
      examId,
      studentId,
      examStudentId,
      regionId,
      classroomId,
      groupId,
    } = createBasicTestData()

    const scoreDecisionId = generateId()
    const newDate = new Date("2025-12-01T00:00:00.000Z").toISOString()
    data.scoresData.scoreDecisions = [
      {
        id: scoreDecisionId,
        cropRegionId: regionId,
        examStudentId,
        verdict: "correct",
        score: "10",
        comment: "新しい既存",
        decidedByUserId: currentUser.id,
        decidedAt: newDate,
        createdAt: newDate,
        updatedAt: newDate,
      },
    ]

    await executeIdIntegrationImport(
      data,
      buildNoMatchPreMatch(data, examId),
      createIdIntegrationConfig(),
      currentUser.id
    )

    // 2回目: 古いdecidedAtの確定 → 上書きされないはず
    const oldDate = new Date("2025-06-01T00:00:00.000Z").toISOString()
    data.scoresData.scoreDecisions![0].verdict = "incorrect"
    data.scoresData.scoreDecisions![0].comment = "古い取り込み"
    data.scoresData.scoreDecisions![0].decidedAt = oldDate

    const preMatch2 = createFileOverviewData({
      student: createPreMatchingResult({
        byId: [
          createMatchedItem({ importId: studentId, existingId: studentId }),
        ],
      }),
      classroom: createPreMatchingResult({
        byId: [
          createMatchedItem({ importId: classroomId, existingId: classroomId }),
        ],
      }),
      subtotalGroup: createPreMatchingResult({
        byId: [createMatchedItem({ importId: groupId, existingId: groupId })],
      }),
      exam: {
        isIdMatch: true,
        importExamId: examId,
        existingExamId: examId,
        importData: {},
        existingData: {},
        displayLabel: "テスト",
      },
    })

    await executeIdIntegrationImport(
      data,
      preMatch2,
      createIdIntegrationConfig(),
      currentUser.id
    )

    const decisions = await prisma.scoreDecision.findMany({
      where: { cropRegionId: regionId, examStudent: { studentId } },
    })
    expect(decisions.length).toBe(1)
    // 既存（新しい方）が維持される
    expect(decisions[0].verdict).toBe("correct")
    expect(decisions[0].comment).toBe("新しい既存")
  })

  // II-25: 新しめモデル全部入りのアーカイブが1回のmergeで全て復元される
  // （merge経路が将来モデルをサイレントに取りこぼさないことの網羅regression）。
  // 採点者は取り込む人とは別の教員にする（取り込む人へ倒す実装を落とすため）
  it("II-25: OMR・複合解答・確定スコアを含む全モデルがmergeで復元され、採点者・確定者はアーカイブの人のまま", async () => {
    const { data, examId, regionId, studentId, examStudentId } =
      createBasicTestData()
    const colleague = await createTestUser({ username: "colleague" })
    const now = new Date().toISOString()
    const pageId = data.examData.examPages[0].id

    // OMR一式
    const omrConfigId = generateId()
    data.examData.omrConfigs = [
      {
        id: omrConfigId,
        cropRegionId: regionId,
        type: "choice",
        numChoices: 4,
        choiceLayout: "horizontal",
        colorThreshold: null,
        areaThreshold: null,
        createdAt: now,
        updatedAt: now,
      },
    ]
    data.examData.omrChoiceOptions = [
      {
        id: generateId(),
        omrConfigId: omrConfigId,
        choiceIndex: 0,
        label: "1",
        isCorrect: true,
        shape: "circle",
        normalizedCx: 0.5,
        normalizedCy: 0.5,
        normalizedWidth: 0.1,
        normalizedHeight: 0.1,
        createdAt: now,
        updatedAt: now,
      },
    ]

    // 複合解答一式
    const compoundAnswerId = generateId()
    data.examData.compoundAnswers = [
      {
        id: compoundAnswerId,
        examPageId: pageId,
        label: "複合1",
        answerFormat: "fraction",
        correctAnswer: "1/2",
        points: 5,
        orderIndex: 0,
        alternativeAnswers: null,
        requireReduced: false,
        createdAt: now,
        updatedAt: now,
      },
    ]
    data.examData.compoundAnswerMembers = [
      {
        id: generateId(),
        compoundAnswerId: compoundAnswerId,
        cropRegionId: regionId,
        order: 0,
        roleLabel: "分子",
        separator: null,
        createdAt: now,
        updatedAt: now,
      },
    ]
    data.examData.compoundAnswerScores = [
      {
        id: generateId(),
        compoundAnswerId: compoundAnswerId,
        examStudentId,
        userId: colleague.id,
        recognizedAnswer: "1/2",
        status: "correct",
        partialScore: "5",
        createdAt: now,
        updatedAt: now,
      },
    ]

    // 確定スコア
    data.scoresData.scoreDecisions = [
      {
        id: generateId(),
        cropRegionId: regionId,
        examStudentId,
        verdict: "correct",
        score: "10",
        comment: null,
        decidedByUserId: colleague.id,
        decidedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ]

    await executeIdIntegrationImport(
      data,
      createFileOverviewData({
        ...buildNoMatchPreMatch(data, examId),
        user: createUserPreMatchingResult([currentUser.id, colleague.id]),
      }),
      createIdIntegrationConfig(),
      currentUser.id
    )

    // OMR
    const omrConfigs = await prisma.cropRegionOmrConfig.findMany({
      where: { cropRegionId: regionId },
    })
    expect(omrConfigs).toHaveLength(1)
    const choiceOptions = await prisma.cropRegionOmrChoiceOption.findMany({
      where: { omrConfigId: omrConfigs[0].id },
    })
    expect(choiceOptions).toHaveLength(1)
    expect(choiceOptions[0].shape).toBe("circle")

    // 複合解答
    expect(
      await prisma.compoundAnswer.count({ where: { id: compoundAnswerId } })
    ).toBe(1)
    expect(
      await prisma.compoundAnswerMember.count({
        where: { compoundAnswerId: compoundAnswerId },
      })
    ).toBe(1)
    const compoundAnswerScores = await prisma.compoundAnswerScore.findMany({
      where: { compoundAnswerId: compoundAnswerId, examStudent: { studentId } },
    })
    expect(compoundAnswerScores).toHaveLength(1)
    // 採点者はアーカイブに書かれた人のまま（取り込んだ人ではない）
    expect(compoundAnswerScores[0].userId).toBe(colleague.id)

    // 確定
    const decisions = await prisma.scoreDecision.findMany({
      where: { cropRegionId: regionId, examStudent: { studentId } },
    })
    expect(decisions).toHaveLength(1)
    expect(decisions[0].verdict).toBe("correct")
    expect(decisions[0].decidedByUserId).toBe(colleague.id)
  })

  // II-26: アーカイブは正本。存在については忠実に復元する（issue #918）
  it("II-26: DrawingAnnotationがアーカイブから復元される", async () => {
    const { data, examId, scoreId } = createBasicTestData()

    const annotationId = generateId()
    const now = new Date().toISOString()
    data.scoresData.drawingAnnotations = [
      {
        id: annotationId,
        questionScoreId: scoreId,
        type: "circle",
        x: 5,
        y: 5,
        color: "#ff0000",
        strokeWidth: 2,
        width: 10,
        height: 10,
        endX: 0,
        endY: 0,
        lineStyle: "solid",
        text: "",
        fontSize: 12,
        textBoxWidth: 0,
        textBoxHeight: 0,
        horizontalAlign: "center",
        verticalAlign: "middle",
        anchorDirection: "none",
        displayX: 0,
        displayY: 0,
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
      },
    ]

    const result = await executeIdIntegrationImport(
      data,
      buildNoMatchPreMatch(data, examId),
      createIdIntegrationConfig(),
      currentUser.id
    )

    // アーカイブに在るものは作る。削除記録による復活防止は行わない
    const annotation = await prisma.drawingAnnotation.findUnique({
      where: { id: annotationId },
    })
    expect(annotation).not.toBeNull()
    expect(annotation!.type).toBe("circle")
    expect(annotation!.questionScoreId).toBe(scoreId)
    expect(result.summary.skipped.annotations).toBe(0)
  })

  describe("id が一致すれば同じ行", () => {
    it("II-30: 事前照合の後に同じ id の試験が入っても、新しく作らず同じ試験として取り込む", async () => {
      const basic = createBasicTestData()
      const { data, examId } = basic
      // 事前照合は「一致なし」のまま、先に同じ試験が入っている
      await executeIdIntegrationImport(
        data,
        buildNoMatchPreMatch(data, examId),
        createIdIntegrationConfig(),
        currentUser.id
      )

      const result = await executeIdIntegrationImport(
        data,
        buildNoMatchPreMatch(data, examId),
        createIdIntegrationConfig(),
        currentUser.id
      )

      expect(result.examId).toBe(examId)
      expect(await prisma.exam.count({ where: { id: examId } })).toBe(1)
      expect(await prisma.examPage.count({ where: { examId } })).toBe(1)
      expect(
        await prisma.questionScore.count({
          where: { cropRegionId: basic.regionId },
        })
      ).toBe(1)
    })

    it("II-31: 同じ試験の取り込みで、アーカイブにだけあるページと領域が足される", async () => {
      const basic = createBasicTestData()
      const { data, examId } = basic
      await executeIdIntegrationImport(
        data,
        buildNoMatchPreMatch(data, examId),
        createIdIntegrationConfig(),
        currentUser.id
      )

      const now = new Date().toISOString()
      const addedPageId = generateId()
      const addedRegionId = generateId()
      data.examData.examPages.push({
        ...data.examData.examPages[0],
        id: addedPageId,
        pageNumber: 2,
        createdAt: now,
        updatedAt: now,
      })
      data.examData.cropRegions.push({
        ...data.examData.cropRegions[0],
        id: addedRegionId,
        examPageId: addedPageId,
        createdAt: now,
        updatedAt: now,
      })

      await executeIdIntegrationImport(
        data,
        buildIdMatchPreMatch(basic),
        createIdIntegrationConfig(),
        currentUser.id
      )

      expect(await prisma.examPage.count({ where: { examId } })).toBe(2)
      expect(
        await prisma.cropRegion.findUnique({ where: { id: addedRegionId } })
      ).toMatchObject({ examPageId: addedPageId })
    })

    it("II-32: 採点行の id が一致すれば、採点者が変わっていても同じ行を書き換える", async () => {
      const colleague = await createTestUser()
      const basic = createBasicTestData()
      const { data, examId, regionId, scoreId } = basic
      await executeIdIntegrationImport(
        data,
        buildNoMatchPreMatch(data, examId),
        createIdIntegrationConfig(),
        currentUser.id
      )

      data.scoresData.questionScores[0] = {
        ...data.scoresData.questionScores[0],
        userId: colleague.id,
        status: "incorrect",
        partialScore: "0",
      }
      await executeIdIntegrationImport(
        data,
        createFileOverviewData({
          ...buildIdMatchPreMatch(basic),
          user: createUserPreMatchingResult([colleague.id]),
        }),
        createIdIntegrationConfig({ exam: "overwrite" }),
        currentUser.id
      )

      const scores = await prisma.questionScore.findMany({
        where: { cropRegionId: regionId },
      })
      expect(scores).toHaveLength(1)
      expect(scores[0]).toMatchObject({
        id: scoreId,
        userId: colleague.id,
        status: "incorrect",
      })
    })

    it("II-33: タグは名前より先に id で引き、改名を書く。別のタグと名前が重なるなら名前は変えない", async () => {
      const { data, examId } = createBasicTestData()
      const renamedTagId = generateId()
      const otherTagId = generateId()
      const old = new Date("2026-01-01T00:00:00.000Z")
      await prisma.tag.create({
        data: {
          id: renamedTagId,
          name: "数学",
          createdAt: old,
          updatedAt: old,
        },
      })
      await prisma.tag.create({
        data: { id: otherTagId, name: "理科", createdAt: old, updatedAt: old },
      })
      const now = new Date().toISOString()
      data.tagsData = {
        tags: [
          // 改名されたタグ（同じ id）
          { id: renamedTagId, name: "数学I", createdAt: now, updatedAt: now },
          // 別のタグと同じ名前になる改名
          { id: otherTagId, name: "数学I", createdAt: now, updatedAt: now },
        ],
        tagSubtotalGroups: [],
        examTags: [],
      }

      const result = await executeIdIntegrationImport(
        data,
        buildNoMatchPreMatch(data, examId),
        createIdIntegrationConfig(),
        currentUser.id
      )

      expect(
        await prisma.tag.findUniqueOrThrow({ where: { id: renamedTagId } })
      ).toMatchObject({ name: "数学I" })
      expect(
        await prisma.tag.findUniqueOrThrow({ where: { id: otherTagId } })
      ).toMatchObject({ name: "理科" })
      expect(result.warnings.some((warning) => warning.includes("理科"))).toBe(
        true
      )
      expect(await prisma.tag.count()).toBe(2)
    })

    it("II-34: id が一致した採点者は、利用者名・氏名を規則どおり書く（パスコードは書かない）", async () => {
      const grader = await createTestUser()
      await prisma.user.update({
        where: { id: grader.id },
        data: { passcode: "hashed", passcodeType: "4digit" },
      })
      const { data, examId } = createBasicTestData()
      data.usersData = createArchiveUsersData([
        { id: grader.id, username: "renamed", name: "改名した先生" },
      ])
      data.scoresData.questionScores[0].userId = grader.id

      await executeIdIntegrationImport(
        data,
        createFileOverviewData({
          ...buildNoMatchPreMatch(data, examId),
          user: createUserPreMatchingResult([grader.id]),
        }),
        createIdIntegrationConfig({ exam: "overwrite" }),
        currentUser.id
      )

      expect(
        await prisma.user.findUniqueOrThrow({ where: { id: grader.id } })
      ).toMatchObject({
        username: "renamed",
        name: "改名した先生",
        passcode: "hashed",
        passcodeType: "4digit",
      })
    })
  })
})
