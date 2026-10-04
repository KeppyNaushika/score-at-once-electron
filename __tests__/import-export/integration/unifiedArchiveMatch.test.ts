/**
 * 統合アーカイブ（.sao）の照合の候補
 *
 * テスト対象:
 *   electron-src/lib/import/unified-archive/archiveMatchCandidates.ts
 *
 * アーカイブ側の行をテスト DB に作って archive.db として写し、テスト DB を空にしてから
 * 取り込み先の行を作る。規則は docs/unified-archive-design.md §7.1 の3と、今の matcher:
 * - 生徒は学籍番号 → 姓名の順に試し、最初に当たった鍵の候補を全部、いちばん古い順で返す
 * - 学級・小計グループは名前、利用者は利用者名
 * - id が一致する行は候補に出さない。当たらない行は候補なしで返す
 * - 利用者の passcode / passcodeType は返さない
 * - 既定の決定は、今の画面の既定（生徒は学籍番号で紐づける）に合わせる
 */

import Database from "better-sqlite3"
import * as crypto from "crypto"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  type ArchiveMatchCandidate,
  findArchiveMatchCandidates,
  suggestedMatchDecisions,
} from "../../../electron-src/lib/import/unified-archive/archiveMatchCandidates"
import type { ArchiveTargetConnection } from "../../../electron-src/lib/import/unified-archive/archiveRowImporter"
import {
  archiveRowKey,
  type OpenedUnifiedArchive,
} from "../../../electron-src/lib/import/unified-archive/types"
import { UNIFIED_ARCHIVE_FORMAT } from "../../../src/types/unifiedArchive.types"
import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"

const prisma = getTestPrismaClient()
const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")
const WORK_DIR = path.join(os.tmpdir(), "unified-archive-match")

/** テスト DB への読み書き（照合は読むだけ） */
const target: ArchiveTargetConnection = {
  query<Row>(sql: string, params: readonly unknown[]) {
    return prisma.$queryRawUnsafe<Row[]>(sql, ...params)
  },
  execute(sql: string, params: readonly unknown[]) {
    return prisma.$executeRawUnsafe(sql, ...params)
  },
}

const createStudent = (student: {
  id?: string
  studentNumber: string
  lastName: string
  firstName: string
  createdAt?: Date
}) =>
  prisma.student.create({
    data: {
      id: student.id ?? crypto.randomUUID(),
      studentNumber: student.studentNumber,
      lastName: student.lastName,
      firstName: student.firstName,
      lastNameKana: "",
      firstNameKana: "",
      ...(student.createdAt ? { createdAt: student.createdAt } : {}),
    },
  })

/** アーカイブ側の行の id */
const archiveIds = {
  studentByNumber: crypto.randomUUID(),
  studentByName: crypto.randomUUID(),
  studentWithTwoCandidates: crypto.randomUUID(),
  studentUnmatched: crypto.randomUUID(),
  studentSameId: crypto.randomUUID(),
  classroomMatched: crypto.randomUUID(),
  classroomUnmatched: crypto.randomUUID(),
  subtotalGroup: crypto.randomUUID(),
  user: crypto.randomUUID(),
}

/** 取り込み先の行の id */
const existingIds = {
  studentByNumber: crypto.randomUUID(),
  studentNameOnly: crypto.randomUUID(),
  studentByName: crypto.randomUUID(),
  studentNewer: crypto.randomUUID(),
  studentOlder: crypto.randomUUID(),
  classroom: crypto.randomUUID(),
  subtotalGroup: crypto.randomUUID(),
  user: crypto.randomUUID(),
}

/** アーカイブ側の行を作り、archive.db として写す */
const createArchive = async (): Promise<OpenedUnifiedArchive> => {
  await createStudent({
    id: archiveIds.studentByNumber,
    studentNumber: "1001",
    lastName: "山田",
    firstName: "太郎",
  })
  // 学籍番号が空なので姓名で当たる
  await createStudent({
    id: archiveIds.studentByName,
    studentNumber: "",
    lastName: "佐藤",
    firstName: "花子",
  })
  await createStudent({
    id: archiveIds.studentWithTwoCandidates,
    studentNumber: "3001",
    lastName: "鈴木",
    firstName: "一郎",
  })
  await createStudent({
    id: archiveIds.studentUnmatched,
    studentNumber: "4001",
    lastName: "高橋",
    firstName: "次郎",
  })
  await createStudent({
    id: archiveIds.studentSameId,
    studentNumber: "5001",
    lastName: "伊藤",
    firstName: "三郎",
  })
  await prisma.classroom.create({
    data: { id: archiveIds.classroomMatched, name: "1年1組" },
  })
  await prisma.classroom.create({
    data: { id: archiveIds.classroomUnmatched, name: "2年2組" },
  })
  await prisma.subtotalGroup.create({
    data: { id: archiveIds.subtotalGroup, name: "観点別" },
  })
  await prisma.user.create({
    data: {
      id: archiveIds.user,
      username: "tanaka",
      name: "田中",
      passcode: "archive-hash",
      passcodeType: "pin",
    },
  })

  const openedDirectory = path.join(WORK_DIR, `opened-${crypto.randomUUID()}`)
  const filesDirectory = path.join(openedDirectory, "files")
  fs.mkdirSync(filesDirectory, { recursive: true })
  const databasePath = path.join(openedDirectory, "archive.db")
  const testDatabase = new Database(TEST_DB_PATH, {
    readonly: true,
    fileMustExist: true,
  })
  try {
    await testDatabase.backup(databasePath)
  } finally {
    testDatabase.close()
  }
  return {
    manifest: {
      format: UNIFIED_ARCHIVE_FORMAT,
      formatVersion: 1,
      appVersion: "test",
      lastMigration: null,
      exportedAt: "2026-10-04T00:00:00.000Z",
      exportedByUserId: null,
      selection: {
        roots: {},
        shared: {},
        scoring: { kind: "all" },
        includeAnswers: true,
        optionalItems: [],
      },
      exclusions: { requested: {}, excludedRowCounts: {} },
      rowCounts: {},
      files: { count: 0, missing: [] },
    },
    databasePath,
    filesDirectory,
    appliedMigrations: [],
    migratedRowIds: {},
  }
}

/** 取り込み先の行を作る */
const createTargetRows = async (): Promise<void> => {
  await createStudent({
    id: existingIds.studentByNumber,
    studentNumber: "1001",
    lastName: "山田",
    firstName: "健",
  })
  // 姓名だけが同じ生徒。学籍番号で当たったなら、こちらは候補に出ない
  await createStudent({
    id: existingIds.studentNameOnly,
    studentNumber: "1999",
    lastName: "山田",
    firstName: "太郎",
  })
  await createStudent({
    id: existingIds.studentByName,
    studentNumber: "2001",
    lastName: "佐藤",
    firstName: "花子",
  })
  // 同じ学籍番号が2人。新しい方を先に作り、並びが作った順でなく古い順になることを見る
  await createStudent({
    id: existingIds.studentNewer,
    studentNumber: "3001",
    lastName: "鈴木",
    firstName: "一郎",
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
  })
  await createStudent({
    id: existingIds.studentOlder,
    studentNumber: "3001",
    lastName: "鈴木",
    firstName: "一朗",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  })
  // id が一致する生徒（学籍番号は違っても照合しない）
  await createStudent({
    id: archiveIds.studentSameId,
    studentNumber: "5999",
    lastName: "伊藤",
    firstName: "三郎",
  })
  await prisma.classroom.create({
    data: { id: existingIds.classroom, name: "1年1組" },
  })
  await prisma.subtotalGroup.create({
    data: { id: existingIds.subtotalGroup, name: "観点別" },
  })
  await prisma.user.create({
    data: {
      id: existingIds.user,
      username: "tanaka",
      name: "田中 太",
      passcode: "existing-hash",
      passcodeType: "pin",
    },
  })
}

describe("統合アーカイブの照合の候補", () => {
  let matchCandidates: ArchiveMatchCandidate[]

  const candidateOf = (archiveId: string): ArchiveMatchCandidate => {
    const matchCandidate = matchCandidates.find(
      (candidate) => candidate.archiveId === archiveId
    )
    if (!matchCandidate) throw new Error(`候補がありません: ${archiveId}`)
    return matchCandidate
  }
  const candidateIdsOf = (archiveId: string): string[] =>
    candidateOf(archiveId).candidates.map(
      (candidateRow) => candidateRow.existingId
    )

  beforeAll(async () => {
    await cleanupTestDatabase()
    const archive = await createArchive()
    await cleanupTestDatabase()
    await createTargetRows()
    matchCandidates = await findArchiveMatchCandidates(target, archive)
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await disconnectTestPrisma()
    fs.rmSync(WORK_DIR, { recursive: true, force: true })
  })

  it("学籍番号で当たると、姓名が同じだけの生徒は候補に出さない", () => {
    expect(candidateOf(archiveIds.studentByNumber).matchedBy).toBe(
      "studentNumber"
    )
    expect(candidateIdsOf(archiveIds.studentByNumber)).toEqual([
      existingIds.studentByNumber,
    ])
    expect(candidateOf(archiveIds.studentByNumber).archiveRow).toMatchObject({
      id: archiveIds.studentByNumber,
      studentNumber: "1001",
      lastName: "山田",
      firstName: "太郎",
    })
  })

  it("学籍番号が空なら照合せず、姓名で当たる", () => {
    expect(candidateOf(archiveIds.studentByName).matchedBy).toBe("name")
    expect(candidateIdsOf(archiveIds.studentByName)).toEqual([
      existingIds.studentByName,
    ])
  })

  it("同じ学籍番号の既存が2人いれば、候補は2件でいちばん古い順", () => {
    expect(candidateIdsOf(archiveIds.studentWithTwoCandidates)).toEqual([
      existingIds.studentOlder,
      existingIds.studentNewer,
    ])
  })

  it("どの鍵でも当たらない行は、候補なしで返す", () => {
    expect(candidateOf(archiveIds.studentUnmatched)).toMatchObject({
      table: "Student",
      matchedBy: null,
      candidates: [],
    })
    expect(candidateOf(archiveIds.classroomUnmatched)).toMatchObject({
      table: "Classroom",
      matchedBy: null,
      candidates: [],
    })
  })

  it("取り込み先に同じ id がある行は候補に出さない", () => {
    expect(
      matchCandidates.some(
        (candidate) => candidate.archiveId === archiveIds.studentSameId
      )
    ).toBe(false)
  })

  it("利用者は利用者名で当たり、passcode / passcodeType はどちらの行にも出さない", () => {
    const userCandidate = candidateOf(archiveIds.user)
    expect(userCandidate.matchedBy).toBe("username")
    expect(candidateIdsOf(archiveIds.user)).toEqual([existingIds.user])
    for (const row of [
      userCandidate.archiveRow,
      ...userCandidate.candidates.map(
        (candidateRow) => candidateRow.existingRow
      ),
    ]) {
      expect(row).not.toHaveProperty("passcode")
      expect(row).not.toHaveProperty("passcodeType")
      expect(row).toHaveProperty("username", "tanaka")
    }
  })

  it("学級と小計グループは名前で当たる", () => {
    expect(candidateOf(archiveIds.classroomMatched).matchedBy).toBe("name")
    expect(candidateIdsOf(archiveIds.classroomMatched)).toEqual([
      existingIds.classroom,
    ])
    expect(candidateOf(archiveIds.subtotalGroup).matchedBy).toBe("name")
    expect(candidateIdsOf(archiveIds.subtotalGroup)).toEqual([
      existingIds.subtotalGroup,
    ])
  })

  it("既定の決定は今の画面と同じ: 学籍番号・学級名・グループ名・利用者名で当たれば先頭へ同じもの（取り込み先の id）、姓名だけ・当たらなければ新規", () => {
    const sameAsExisting = (existingId: string) => ({
      kind: "same",
      existingId,
      adoptId: "existing",
    })
    expect(suggestedMatchDecisions(matchCandidates)).toEqual({
      [archiveRowKey("Student", archiveIds.studentByNumber)]: sameAsExisting(
        existingIds.studentByNumber
      ),
      [archiveRowKey("Student", archiveIds.studentByName)]: { kind: "new" },
      [archiveRowKey("Student", archiveIds.studentWithTwoCandidates)]:
        sameAsExisting(existingIds.studentOlder),
      [archiveRowKey("Student", archiveIds.studentUnmatched)]: { kind: "new" },
      [archiveRowKey("Classroom", archiveIds.classroomMatched)]: sameAsExisting(
        existingIds.classroom
      ),
      [archiveRowKey("Classroom", archiveIds.classroomUnmatched)]: {
        kind: "new",
      },
      [archiveRowKey("SubtotalGroup", archiveIds.subtotalGroup)]:
        sameAsExisting(existingIds.subtotalGroup),
      [archiveRowKey("User", archiveIds.user)]: sameAsExisting(
        existingIds.user
      ),
    })
  })
})
