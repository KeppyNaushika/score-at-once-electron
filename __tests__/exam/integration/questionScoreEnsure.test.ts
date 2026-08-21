/**
 * 採点行を「用意する」口と「採点する」口が別であることの検証。
 *
 * かつては1本の `createQuestionScore` が両方を兼ねており、**名前に反して set**
 * （有れば `status` と `partialScore` を上書きする）だった。設問を表示しただけで出る
 * 自動作成と、保存済み注釈のドラッグがこれを `status:"unscored"` で叩くので、
 * **採点した直後にその採点が消えていた**（docs/branch-review-findings.md #2・#4）。
 *
 * ここで固定するのは「`ensureQuestionScore` は既にある行を触らない」こと。関門は
 * renderer 側のキャッシュで、採点の直後は「行が無い」と見えるため、**main 側が
 * 触らないことだけが最後の砦**になる。
 */

import * as path from "path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")

vi.mock("electron", () => ({
  app: { getVersion: () => "test", getAppPath: () => process.cwd() },
}))

vi.mock("../../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import {
  ensureQuestionScore,
  setQuestionScore,
} from "@/electron-src/lib/prisma/questionScore"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

let fixture: Awaited<ReturnType<typeof createFullTestExam>>

beforeEach(async () => {
  await cleanupTestDatabase()
  fixture = await createFullTestExam(testPrisma, { includeScores: false })
})

afterAll(async () => {
  await disconnectTestPrisma()
  await testPrisma.$disconnect()
})

/** その組み合わせの採点行を全部引く（1行に保たれているかも見たいので findMany） */
async function rowsFor(cropRegionId: string, examStudentId: string) {
  return testPrisma.questionScore.findMany({
    where: { cropRegionId, examStudentId },
  })
}

describe("採点行を用意する口は、採点を上書きしない", () => {
  it("採点したあとに用意しても、判定と部分点が残る", async () => {
    const cropRegionId = fixture.cropRegions[0].id
    const examStudentId = fixture.examStudents[0].id
    const userId = fixture.user.id

    await setQuestionScore({
      cropRegionId,
      examStudentId,
      userId,
      status: "partial",
      partialScore: 3,
    })

    // 設問を表示しただけで出る自動作成に相当する。**採点の直後**に来る
    const ensured = await ensureQuestionScore({
      cropRegionId,
      examStudentId,
      userId,
    })

    expect(ensured.status).toBe("partial")
    expect(Number(ensured.partialScore)).toBe(3)

    const rows = await rowsFor(cropRegionId, examStudentId)
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe("partial")
    expect(Number(rows[0].partialScore)).toBe(3)
  })

  it("行が無ければ未採点で作る", async () => {
    const cropRegionId = fixture.cropRegions[0].id
    const examStudentId = fixture.examStudents[1].id
    const userId = fixture.user.id

    expect(await rowsFor(cropRegionId, examStudentId)).toHaveLength(0)

    const ensured = await ensureQuestionScore({
      cropRegionId,
      examStudentId,
      userId,
    })

    expect(ensured.status).toBe("unscored")
    expect(ensured.partialScore).toBeNull()
    expect(await rowsFor(cropRegionId, examStudentId)).toHaveLength(1)
  })

  it("繰り返し呼んでも行は増えず、同じ行を返す", async () => {
    const cropRegionId = fixture.cropRegions[1].id
    const examStudentId = fixture.examStudents[0].id
    const userId = fixture.user.id

    const first = await ensureQuestionScore({
      cropRegionId,
      examStudentId,
      userId,
    })
    const second = await ensureQuestionScore({
      cropRegionId,
      examStudentId,
      userId,
    })

    expect(second.id).toBe(first.id)
    expect(await rowsFor(cropRegionId, examStudentId)).toHaveLength(1)
  })

  it("採点する口は、これまでどおり上書きする", async () => {
    const cropRegionId = fixture.cropRegions[0].id
    const examStudentId = fixture.examStudents[2].id
    const userId = fixture.user.id

    await setQuestionScore({
      cropRegionId,
      examStudentId,
      userId,
      status: "correct",
      partialScore: null,
    })
    await setQuestionScore({
      cropRegionId,
      examStudentId,
      userId,
      status: "incorrect",
      partialScore: null,
    })

    const rows = await rowsFor(cropRegionId, examStudentId)
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe("incorrect")
  })
})
