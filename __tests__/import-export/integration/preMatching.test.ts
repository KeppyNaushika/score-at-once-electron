/**
 * preMatching の統合テスト
 *
 * テスト対象: electron-src/lib/import/merge/matcher.ts + matchers/
 * 実際のSQLiteテスト用DBを使用し、事前照合ロジックを検証する
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createArchiveClassesData,
  createArchiveExamData,
  createArchiveStudentsData,
  createArchiveSubtotalsData,
  createExtractedArchiveData,
  generateId,
} from "../../helpers/testDataFactory"
import {
  cleanupTestDatabase,
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

import { performPreMatching } from "../../../electron-src/lib/import/merge/matcher"

const prisma = getTestPrismaClient()

describe("preMatching", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  // PM-2: 生徒学籍番号一致マッチ
  it("PM-2: 学籍番号が一致する生徒がbyStudentNumberに分類される", async () => {
    const existingId = generateId()
    const importId = generateId()
    const studentNumber = `SN_MATCH_${Date.now()}`

    await prisma.student.create({
      data: {
        id: existingId,
        studentNumber,
        lastName: "佐藤",
        firstName: "花子",
        lastNameKana: "サトウ",
        firstNameKana: "ハナコ",
      },
    })

    const data = createExtractedArchiveData({
      studentsData: createArchiveStudentsData([
        {
          id: importId,
          studentNumber,
          lastName: "佐藤",
          firstName: "花子",
        },
      ]),
    })

    const result = await performPreMatching(data)

    expect(result.student.byStudentNumber).toBeDefined()
    expect(result.student.byStudentNumber!.length).toBe(1)
    expect(result.student.byStudentNumber![0].importId).toBe(importId)
    expect(result.student.byStudentNumber![0].existingId).toBe(existingId)
  })

  // PM-1（ID一致）・PM-3（氏名一致）・PM-4（一致なし）は PM-9 の部分集合なので PM-9 へ統合した

  // PM-5: 学級byId/byNameマッチ
  it("PM-5: 学級がID一致・名前一致で分類される", async () => {
    const classIdMatch = generateId()
    const classNameMatchExisting = generateId()
    const classNameMatchImport = generateId()
    const className = `テストクラス_${Date.now()}`

    // ID一致用
    await prisma.classroom.create({
      data: { id: classIdMatch, name: `IDクラス_${Date.now()}` },
    })

    // 名前一致用
    await prisma.classroom.create({
      data: { id: classNameMatchExisting, name: className },
    })

    const data = createExtractedArchiveData({
      classesData: createArchiveClassesData(
        [
          { id: classIdMatch, name: `IDクラス_renamed_${Date.now()}` },
          { id: classNameMatchImport, name: className },
        ],
        []
      ),
    })

    const result = await performPreMatching(data)

    expect(result.classroom.byId.length).toBe(1)
    expect(result.classroom.byId[0].importId).toBe(classIdMatch)

    expect(result.classroom.byName).toBeDefined()
    expect(result.classroom.byName!.length).toBe(1)
    expect(result.classroom.byName![0].importId).toBe(classNameMatchImport)
    expect(result.classroom.byName![0].existingId).toBe(classNameMatchExisting)
  })

  // PM-6: 小計グループbyId/byNameマッチ
  it("PM-6: 小計グループがID一致・名前一致で分類される", async () => {
    const groupIdMatch = generateId()
    const groupNameMatchExisting = generateId()
    const groupNameMatchImport = generateId()
    const groupName = `小計G_${Date.now()}`

    await prisma.subtotalGroup.create({
      data: { id: groupIdMatch, name: `IDグループ_${Date.now()}` },
    })

    await prisma.subtotalGroup.create({
      data: { id: groupNameMatchExisting, name: groupName },
    })

    const data = createExtractedArchiveData({
      subtotalsData: createArchiveSubtotalsData([
        { id: groupIdMatch, name: `IDグループ_renamed_${Date.now()}` },
        { id: groupNameMatchImport, name: groupName },
      ]),
    })

    const result = await performPreMatching(data)

    expect(result.subtotalGroup.byId.length).toBe(1)
    expect(result.subtotalGroup.byId[0].importId).toBe(groupIdMatch)

    expect(result.subtotalGroup.byName).toBeDefined()
    expect(result.subtotalGroup.byName!.length).toBe(1)
    expect(result.subtotalGroup.byName![0].importId).toBe(groupNameMatchImport)
    expect(result.subtotalGroup.byName![0].existingId).toBe(
      groupNameMatchExisting
    )
  })

  // PM-7: 試験ID一致
  it("PM-7: 試験ID一致時にisIdMatch=trueとなる", async () => {
    const examId = generateId()

    // 既存試験作成
    await prisma.exam.create({
      data: { id: examId, examName: "既存試験" },
    })

    const data = createExtractedArchiveData({
      examData: createArchiveExamData({ examId }),
    })

    const result = await performPreMatching(data)

    expect(result.exam).toBeDefined()
    expect(result.exam!.isIdMatch).toBe(true)
    expect(result.exam!.existingExamId).toBe(examId)
  })

  // PM-8: 試験ID不一致
  it("PM-8: 試験ID不一致時にisIdMatch=falseとなる", async () => {
    const data = createExtractedArchiveData({
      examData: createArchiveExamData({ examId: generateId() }),
    })

    const result = await performPreMatching(data)

    expect(result.exam).toBeDefined()
    expect(result.exam!.isIdMatch).toBe(false)
    expect(result.exam!.existingExamId).toBeUndefined()
  })

  // PM-9: 混合シナリオ（byId+byName+noMatch）
  it("PM-9: 複数生徒の混合マッチシナリオが正しく分類される", async () => {
    const studentIdMatch = generateId()
    const studentNameMatchExisting = generateId()
    const studentNameMatchImport = generateId()
    const noMatchImport = generateId()

    // ID一致用
    await prisma.student.create({
      data: {
        id: studentIdMatch,
        studentNumber: `MIXED_ID_${Date.now()}`,
        lastName: "ID一致",
        firstName: "生徒",
        lastNameKana: "IDイッチ",
        firstNameKana: "セイト",
      },
    })

    // 氏名一致用
    await prisma.student.create({
      data: {
        id: studentNameMatchExisting,
        studentNumber: `MIXED_NAME_${Date.now()}`,
        lastName: "名前一致",
        firstName: "生徒",
        lastNameKana: "ナマエイッチ",
        firstNameKana: "セイト",
      },
    })

    const data = createExtractedArchiveData({
      studentsData: createArchiveStudentsData([
        {
          id: studentIdMatch,
          studentNumber: `MIXED_ID_IMPORT_${Date.now()}`,
          lastName: "ID一致",
          firstName: "生徒",
        },
        {
          id: studentNameMatchImport,
          studentNumber: `MIXED_NAME_IMPORT_${Date.now()}`,
          lastName: "名前一致",
          firstName: "生徒",
        },
        {
          id: noMatchImport,
          studentNumber: `NO_MATCH_${Date.now()}`,
          lastName: "マッチなし",
          firstName: "生徒",
        },
      ]),
    })

    const result = await performPreMatching(data)

    expect(result.student.byId.length).toBe(1)
    expect(result.student.byId[0].importId).toBe(studentIdMatch)
    expect(result.student.byId[0].existingId).toBe(studentIdMatch)

    expect(result.student.byName!.length).toBe(1)
    expect(result.student.byName![0].importId).toBe(studentNameMatchImport)
    expect(result.student.byName![0].existingId).toBe(studentNameMatchExisting)

    expect(result.student.noMatch.length).toBe(1)
    expect(result.student.noMatch[0].importId).toBe(noMatchImport)
  })
})
