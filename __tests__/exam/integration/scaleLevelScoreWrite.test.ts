/**
 * 類型評価の設問で、自分の採点行に類型を付ける・外す main 側（docs/vlm-grading-design.md §4-8-2・§4-8-6）。
 *
 * - 付けると評価済み（evaluated）・類型あり・部分点なし。行が無ければ作る
 * - 外すと、ある行だけを未採点に戻し、類型も外す（無い行は作らない）
 * - 設問の類型評価の類型でなければ拒む
 * - 点の採点の書き込みは評価済みを拒み、書くときは類型を外す
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

import { setQuestionScore } from "@/electron-src/lib/prisma/questionScoreWrite"
import { setScaleLevels } from "@/electron-src/lib/prisma/scaleLevelScoreWrite"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

let fixture: Awaited<ReturnType<typeof createFullTestExam>>
let levelIds: { a: string; b: string }

beforeEach(async () => {
  await cleanupTestDatabase()
  fixture = await createFullTestExam(testPrisma, {
    pageCount: 1,
    cropRegionsPerPage: 1,
    studentCount: 2,
    includeScores: false,
  })
  const scoreScale = await testPrisma.scoreScale.create({
    data: {
      examId: fixture.exam.id,
      name: "記述の3類型",
      levels: {
        create: [
          { label: "A", score: 10, sortOrder: 0 },
          { label: "B", score: 6, sortOrder: 1 },
        ],
      },
    },
    include: { levels: { orderBy: { sortOrder: "asc" } } },
  })
  levelIds = { a: scoreScale.levels[0].id, b: scoreScale.levels[1].id }
  await testPrisma.cropRegion.update({
    where: { id: fixture.cropRegions[0].id },
    data: { scoringMethod: "scale", scoreScaleId: scoreScale.id },
  })
})

afterAll(async () => {
  await disconnectTestPrisma()
  await testPrisma.$disconnect()
})

const cropRegionId = () => fixture.cropRegions[0].id
const actorId = () => fixture.user.id
const examStudentIds = () =>
  fixture.examStudents.map((examStudent) => examStudent.id)

describe("類型を付ける・外す", () => {
  it("行が無ければ作って評価済みにし、あれば類型を付け替える", async () => {
    const written = await setScaleLevels(
      {
        cropRegionId: cropRegionId(),
        examStudentIds: examStudentIds(),
        scaleLevelId: levelIds.a,
      },
      actorId()
    )
    expect(written).toHaveLength(2)
    expect(
      written.map((row) => [row.status, row.scaleLevelId, row.partialScore])
    ).toEqual([
      ["evaluated", levelIds.a, null],
      ["evaluated", levelIds.a, null],
    ])

    await setScaleLevels(
      {
        cropRegionId: cropRegionId(),
        examStudentIds: [examStudentIds()[0]],
        scaleLevelId: levelIds.b,
      },
      actorId()
    )
    const rows = await testPrisma.questionScore.findMany({
      where: { cropRegionId: cropRegionId() },
    })
    expect(rows).toHaveLength(2)
    expect(
      rows.find((row) => row.examStudentId === examStudentIds()[0])
        ?.scaleLevelId
    ).toBe(levelIds.b)
  })

  it("外すと、ある行だけを未採点に戻す（無い行は作らない）", async () => {
    await setScaleLevels(
      {
        cropRegionId: cropRegionId(),
        examStudentIds: [examStudentIds()[0]],
        scaleLevelId: levelIds.a,
      },
      actorId()
    )
    const cleared = await setScaleLevels(
      {
        cropRegionId: cropRegionId(),
        examStudentIds: examStudentIds(),
        scaleLevelId: null,
      },
      actorId()
    )
    expect(cleared).toHaveLength(1)
    expect([cleared[0].status, cleared[0].scaleLevelId]).toEqual([
      "unscored",
      null,
    ])
    expect(await testPrisma.questionScore.count()).toBe(1)
  })

  it("設問の類型評価の類型でなければ拒む", async () => {
    const otherScale = await testPrisma.scoreScale.create({
      data: {
        examId: null,
        levels: { create: [{ label: "X", score: 1 }] },
      },
      include: { levels: true },
    })
    await expect(
      setScaleLevels(
        {
          cropRegionId: cropRegionId(),
          examStudentIds: examStudentIds(),
          scaleLevelId: otherScale.levels[0].id,
        },
        actorId()
      )
    ).rejects.toThrow("この設問の類型評価の類型ではありません")
  })
})

describe("点の採点の書き込みとの関係", () => {
  it("点の採点の書き込みは評価済みを拒む", async () => {
    await expect(
      setQuestionScore({
        cropRegionId: cropRegionId(),
        examStudentId: examStudentIds()[0],
        userId: actorId(),
        status: "evaluated",
        partialScore: null,
      })
    ).rejects.toThrow("類型評価の書き込み")
  })

  it("保留などを点の採点の書き込みで付けると、類型は外れる", async () => {
    await setScaleLevels(
      {
        cropRegionId: cropRegionId(),
        examStudentIds: [examStudentIds()[0]],
        scaleLevelId: levelIds.a,
      },
      actorId()
    )
    const updated = await setQuestionScore({
      cropRegionId: cropRegionId(),
      examStudentId: examStudentIds()[0],
      userId: actorId(),
      status: "pending",
      partialScore: null,
    })
    expect([updated.status, updated.scaleLevelId]).toEqual(["pending", null])
  })
})
