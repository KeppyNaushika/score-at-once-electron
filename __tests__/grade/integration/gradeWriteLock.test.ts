/**
 * 成績算出のロックを、本物の DB で確かめる（Prisma のアダプタに挟んだ関所）。
 *
 * 1. **ロック中は、成績算出が読むテーブルへの書き込みを断る。** 1件の書き込み・
 *    一括の書き込み・トランザクションの中・入れ子の書き込みのどれも同じ
 * 2. **成績算出が読まないテーブル（タグ・統計対象の学級・監査ログなど）は止めない**
 * 3. **手放せば書ける。** 握り直したロックは、前の印の手放しでは外れない
 * 4. **断った例外は、Prisma が包んでも見分けられる**（IPC の境界が文言を置き換える）
 */

import * as path from "path"
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  holdGradeWriteLock,
  isGradeWriteLockedError,
  releaseGradeWriteLock,
  releaseGradeWriteLockOf,
} from "../../../electron-src/lib/prisma/gradeWriteLock"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
} from "../../helpers/testPrismaClient"

const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")
const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/** ロックを握った画面の id（このテストでは1つだけ） */
const OWNER_ID = 1

/** 書き込みを走らせ、ロックで断られたかを返す（ほかの失敗はそのまま投げる） */
async function refusedByLock(write: () => Promise<unknown>): Promise<boolean> {
  try {
    await write()
    return false
  } catch (error) {
    if (isGradeWriteLockedError(error)) return true
    throw error
  }
}

async function createExam() {
  return testPrisma.exam.create({ data: { examName: "中間" } })
}

beforeEach(async () => {
  await cleanupTestDatabase()
})

afterEach(() => {
  // 失敗したテストが握ったまま後片付けを止めないよう、必ず外す
  releaseGradeWriteLockOf(OWNER_ID)
})

afterAll(async () => {
  await cleanupTestDatabase()
  await testPrisma.$disconnect()
})

describe("成績算出のロック（DB の手前の関所）", () => {
  it("ロック中は、成績算出が読むテーブルへの書き込みを断る", async () => {
    const exam = await createExam()
    holdGradeWriteLock("token-1", OWNER_ID)

    expect(
      await refusedByLock(() =>
        testPrisma.exam.update({
          where: { id: exam.id },
          data: { examName: "期末" },
        })
      )
    ).toBe(true)
    expect(
      await refusedByLock(() =>
        testPrisma.examPage.create({
          data: { examId: exam.id, pageNumber: 1 },
        })
      )
    ).toBe(true)
    expect(
      await refusedByLock(() =>
        testPrisma.exam.deleteMany({ where: { id: exam.id } })
      )
    ).toBe(true)

    // DB は変わっていない
    releaseGradeWriteLock("token-1")
    const unchanged = await testPrisma.exam.findUniqueOrThrow({
      where: { id: exam.id },
    })
    expect(unchanged.examName).toBe("中間")
  })

  it("トランザクションの中の書き込みも断り、全体を巻き戻す", async () => {
    holdGradeWriteLock("token-1", OWNER_ID)

    expect(
      await refusedByLock(() =>
        testPrisma.$transaction(async (tx) => {
          await tx.tag.create({ data: { name: "先に書けるタグ" } })
          await tx.exam.create({ data: { examName: "後で断られる試験" } })
        })
      )
    ).toBe(true)

    releaseGradeWriteLock("token-1")
    expect(await testPrisma.tag.count()).toBe(0)
    expect(await testPrisma.exam.count()).toBe(0)
  })

  it("止めない表を起点にした入れ子の書き込みでも、止める表へ書くなら断る", async () => {
    holdGradeWriteLock("token-1", OWNER_ID)

    expect(
      await refusedByLock(() =>
        testPrisma.tag.create({
          data: {
            name: "タグ",
            examTags: { create: { exam: { create: { examName: "入れ子" } } } },
          },
        })
      )
    ).toBe(true)

    releaseGradeWriteLock("token-1")
    expect(await testPrisma.exam.count()).toBe(0)
  })

  it("成績算出が読まないテーブルへの書き込みは止めない", async () => {
    const exam = await createExam()
    const classroom = await testPrisma.classroom.create({
      data: { name: "1組" },
    })
    const examClassroom = await testPrisma.examClassroom.create({
      data: { examId: exam.id, classroomId: classroom.id },
    })
    holdGradeWriteLock("token-1", OWNER_ID)

    // タグ・試験のタグ付け・統計対象の学級・監査ログ
    const tag = await testPrisma.tag.create({ data: { name: "定期考査" } })
    await testPrisma.examTag.create({
      data: { examId: exam.id, tagId: tag.id },
    })
    await testPrisma.examClassroom.update({
      where: { id: examClassroom.id },
      data: { teacherStatistics: false },
    })
    await testPrisma.auditLog.create({
      data: {
        action: "test.action",
        category: "test",
        entityType: "Exam",
        entityId: exam.id,
        summary: "ロック中の監査ログ",
      },
    })

    expect(await testPrisma.examTag.count()).toBe(1)
  })

  it("手放せば書ける。握り直したロックは、前の印の手放しでは外れない", async () => {
    holdGradeWriteLock("token-old", OWNER_ID)
    holdGradeWriteLock("token-new", OWNER_ID)
    // 別の試験へ移ったとき、前の layout の後始末が後から届いても外さない
    releaseGradeWriteLock("token-old")

    expect(
      await refusedByLock(() =>
        testPrisma.exam.create({ data: { examName: "まだ断られる" } })
      )
    ).toBe(true)

    releaseGradeWriteLock("token-new")
    expect(
      await refusedByLock(() =>
        testPrisma.exam.create({ data: { examName: "書ける" } })
      )
    ).toBe(false)
  })

  it("握った画面が閉じたら外れる", async () => {
    holdGradeWriteLock("token-1", OWNER_ID)
    releaseGradeWriteLockOf(OWNER_ID)

    expect(
      await refusedByLock(() =>
        testPrisma.exam.create({ data: { examName: "書ける" } })
      )
    ).toBe(false)
  })
})
