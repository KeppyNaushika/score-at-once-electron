/**
 * 人が打つ値（username / 学級名 / 学籍番号）が重複している DB に、取り込みが当たったとき。
 *
 * 2026-08-22 にこの3つの `@unique` を外した（20260822140000_drop_human_name_uniques）ので、
 * **同じ値の行が2つ並ぶのは正常な状態**になった。名前で既存を探す経路は、当たった候補が
 * 1件とは限らなくなる。決めた振る舞いは electron-src/lib/import/humanKeyMatching.ts:
 *
 * - 採るのは**いちばん古い行**（createdAt 昇順、同時刻は id 昇順）。格納順で決めない
 * - **候補が2件以上あったことを必ず伝える**（warning / 照合理由）
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createArchiveClassesData,
  createArchiveStudentsData,
  createExtractedArchiveData,
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
  resolveClassrooms,
  resolveStudents,
} from "../../../electron-src/lib/import/coursework-archive/idRemapper"
import { preMatchClassrooms } from "../../../electron-src/lib/import/merge/matchers/classroomMatcher"
import { preMatchStudents } from "../../../electron-src/lib/import/merge/matchers/studentMatcher"

const prisma = getTestPrismaClient()

const OLD_DAY = new Date("2025-04-01T00:00:00.000Z")
const NEW_DAY = new Date("2026-04-01T00:00:00.000Z")

/** 学級を1つ作る（createdAt を指定して「どちらが古いか」を決める） */
const createClassroom = (
  id: string,
  name: string,
  createdAt: Date,
  classroomCode: string
) =>
  prisma.classroom.create({
    data: { id, name, classroomCode, createdAt },
  })

/** 生徒を1人作る */
const createStudent = (
  id: string,
  studentNumber: string,
  lastName: string,
  createdAt: Date
) =>
  prisma.student.create({
    data: {
      id,
      studentNumber,
      lastName,
      firstName: "太郎",
      lastNameKana: "セイ",
      firstNameKana: "タロウ",
      createdAt,
    },
  })

describe("人が打つ値が重複している DB", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  it("同じ username / 学級名 / 学籍番号の行を2つ作れる", async () => {
    await prisma.user.create({
      data: { id: generateId(), username: "suzuki", name: "鈴木一郎" },
    })
    await prisma.user.create({
      data: { id: generateId(), username: "suzuki", name: "鈴木花子" },
    })

    await createClassroom(generateId(), "3年1組", NEW_DAY, "2026-301")
    await createClassroom(generateId(), "3年1組", OLD_DAY, "2025-301")

    await createStudent(generateId(), "20260001", "山田", NEW_DAY)
    await createStudent(generateId(), "20260001", "佐藤", OLD_DAY)

    expect(await prisma.user.count({ where: { username: "suzuki" } })).toBe(2)
    expect(await prisma.classroom.count({ where: { name: "3年1組" } })).toBe(2)
    expect(
      await prisma.student.count({ where: { studentNumber: "20260001" } })
    ).toBe(2)
  })

  describe("学級名で既存を探す（resolveClassrooms）", () => {
    it("同名が2つあるとき、いちばん古い学級に結び付け、件数と相手を warning で伝える", async () => {
      // 古い方を先に作る。こうすると「格納順の最後」と「いちばん古い行」が食い違うので、
      // どちらの規則で選んでいるかがこのテストで分かれる
      const olderId = generateId()
      const newerId = generateId()
      await createClassroom(olderId, "3年1組", OLD_DAY, "2025-301")
      await createClassroom(newerId, "3年1組", NEW_DAY, "2026-301")

      const { map, warnings } = await resolveClassrooms(
        prisma,
        [
          {
            id: generateId(), // 取り込み先に無い uuid ＝ 名前で探すことになる
            name: "3年1組",
            classroomCode: null,
            grade: 3,
            description: null,
            isVisible: true,
          },
        ],
        { allowCreate: false }
      )

      expect([...map.values()]).toEqual([olderId])
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toContain("2件")
      expect(warnings[0]).toContain("2025-301")
    })

    it("同名が1つだけなら余計な warning を出さない", async () => {
      const onlyId = generateId()
      await createClassroom(onlyId, "3年1組", OLD_DAY, "2025-301")

      const { map, warnings } = await resolveClassrooms(
        prisma,
        [
          {
            id: generateId(),
            name: "3年1組",
            classroomCode: null,
            grade: 3,
            description: null,
            isVisible: true,
          },
        ],
        { allowCreate: false }
      )

      expect([...map.values()]).toEqual([onlyId])
      expect(warnings).toEqual([])
    })
  })

  describe("学籍番号で既存を探す（resolveStudents）", () => {
    it("同じ学籍番号が2人いるとき、いちばん古い生徒に結び付け、件数と相手を warning で伝える", async () => {
      // 学級と同じく、古い方を先に作る（格納順と古さを食い違わせる）
      const olderId = generateId()
      const newerId = generateId()
      await createStudent(olderId, "20260001", "佐藤", OLD_DAY)
      await createStudent(newerId, "20260001", "山田", NEW_DAY)

      const { map, createdIds, warnings } = await resolveStudents(
        prisma,
        [
          {
            id: generateId(), // 取り込み先に無い uuid ＝ 学籍番号で探すことになる
            studentNumber: "20260001",
            lastName: "田中",
            firstName: "次郎",
            lastNameKana: "タナカ",
            firstNameKana: "ジロウ",
            enrollmentYear: 2026,
            updatedAt: new Date().toISOString(),
          },
        ],
        { method: "studentNumber", allowCreate: false }
      )

      expect([...map.values()]).toEqual([olderId])
      expect(createdIds.size).toBe(0)
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toContain("2件")
      expect(warnings[0]).toContain("佐藤太郎")
    })
  })

  describe("取り込みウィザードの事前照合", () => {
    it("同じ学籍番号の生徒が複数いることを照合理由に載せる", async () => {
      const olderId = generateId()
      await createStudent(olderId, "20260001", "佐藤", OLD_DAY)
      await createStudent(generateId(), "20260001", "山田", NEW_DAY)

      const result = await preMatchStudents(
        createExtractedArchiveData({
          studentsData: createArchiveStudentsData([
            { studentNumber: "20260001", lastName: "田中", firstName: "次郎" },
          ]),
        })
      )

      const byStudentNumber = result.byStudentNumber ?? []
      expect(byStudentNumber).toHaveLength(1)
      expect(byStudentNumber[0].existingId).toBe(olderId)
      expect(byStudentNumber[0].matchReason).toContain("2件")
    })

    it("同名の学級が複数あることを照合理由に載せる", async () => {
      const olderId = generateId()
      await createClassroom(olderId, "3年1組", OLD_DAY, "2025-301")
      await createClassroom(generateId(), "3年1組", NEW_DAY, "2026-301")

      const result = await preMatchClassrooms(
        createExtractedArchiveData({
          classesData: createArchiveClassesData([{ name: "3年1組" }]),
        })
      )

      const byName = result.byName ?? []
      expect(byName).toHaveLength(1)
      expect(byName[0].existingId).toBe(olderId)
      expect(byName[0].matchReason).toContain("2件")
    })
  })
})
