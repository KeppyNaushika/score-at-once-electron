/**
 * 成績のセルの書き込み入口でのスコープ検査（#962 Phase C）。
 *
 * セルは対象者（GradeStudent）と評価項目（GradeItem）の2つを参照する。FK が保証するのは
 * それぞれが実在することだけで、両者が同じ Grade に属することは強制されない。どちらの id も
 * string なので取り違えてもコンパイルは通り、書けてしまうと成績 A の対象者に成績 B の項目の
 * 上書き・確定値がぶら下がる（どちらの画面にも出ないのに DB には残る）。
 */

import * as path from "path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")

vi.mock("../../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import { setGradeItemExclusion } from "@/electron-src/lib/prisma/gradeItemExclusion"
import { upsertGradeOverride } from "@/electron-src/lib/prisma/gradeOverride"

import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

interface Fixture {
  /** 成績A の対象者 */
  gradeStudentId: string
  /** 成績A の評価項目 */
  gradeItemId: string
  /** 成績B（別の成績）の評価項目 */
  otherGradeItemId: string
}

async function buildFixture(): Promise<Fixture> {
  const suffix = Date.now()
  const student = await testPrisma.student.create({
    data: {
      studentNumber: `SG${suffix}`,
      lastName: "山田",
      firstName: "太郎",
      lastNameKana: "ヤマダ",
      firstNameKana: "タロウ",
    },
  })

  const grade = await testPrisma.grade.create({ data: { name: "1学期成績" } })
  const gradeStudent = await testPrisma.gradeStudent.create({
    data: { gradeId: grade.id, studentId: student.id },
  })
  const gradeItem = await testPrisma.gradeItem.create({
    data: { gradeId: grade.id, name: "知識・技能", order: 0 },
  })

  const otherGrade = await testPrisma.grade.create({
    data: { name: "2学期成績" },
  })
  const otherGradeItem = await testPrisma.gradeItem.create({
    data: { gradeId: otherGrade.id, name: "知識・技能", order: 0 },
  })

  return {
    gradeStudentId: gradeStudent.id,
    gradeItemId: gradeItem.id,
    otherGradeItemId: otherGradeItem.id,
  }
}

describe("成績のセルのスコープ検査", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("同じ成績の対象者・評価項目なら書ける", async () => {
    const fixture = await buildFixture()

    await upsertGradeOverride({
      gradeStudentId: fixture.gradeStudentId,
      gradeItemId: fixture.gradeItemId,
      overrideLabel: "A",
    })
    expect(await testPrisma.gradeOverride.count()).toBe(1)
  })

  it("別の成績の評価項目には上書きを書けない", async () => {
    const fixture = await buildFixture()

    await expect(
      upsertGradeOverride({
        gradeStudentId: fixture.gradeStudentId,
        gradeItemId: fixture.otherGradeItemId,
        overrideLabel: "A",
      })
    ).rejects.toThrow(/別の成績/)
    expect(await testPrisma.gradeOverride.count()).toBe(0)
  })

  it("別の成績の評価項目には除外設定を書けない", async () => {
    const fixture = await buildFixture()

    await expect(
      setGradeItemExclusion({
        gradeStudentId: fixture.gradeStudentId,
        gradeItemId: fixture.otherGradeItemId,
        excluded: true,
      })
    ).rejects.toThrow()
    expect(await testPrisma.gradeItemExclusion.count()).toBe(0)
  })

  it("存在しない対象者を指した書き込みは弾かれる", async () => {
    const fixture = await buildFixture()

    await expect(
      upsertGradeOverride({
        gradeStudentId: "missing-grade-student",
        gradeItemId: fixture.gradeItemId,
        overrideLabel: "A",
      })
    ).rejects.toThrow()
    expect(await testPrisma.gradeOverride.count()).toBe(0)
  })
})
