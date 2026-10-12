/**
 * 類型評価（類型の組）と類型の main 側（docs/vlm-grading-design.md §4-8-3・§4-8-8）。
 *
 * - 組は類型 A/B/C つきで作られ、試験で選べるのはその試験のものと共通のものだけ
 * - 点数は 0 以上（配点を超えてよい）。Decimal は数で返る
 * - 使われている組・類型は消せない（main でも数え直して拒む）
 * - 共通にする／試験に戻す。ほかの試験の設問が使っていれば戻せない
 * - 設問が選べるのは共通の組と、その設問の試験の組だけ
 * - 複製は類型ごと写し、渡した設問を複製へ付け替える
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

import {
  createScoreScale,
  createScoreScaleLevel,
  deleteScoreScale,
  deleteScoreScaleLevel,
  duplicateScoreScale,
  listScoreScales,
  reorderScoreScaleLevels,
  setCropRegionScoreScale,
  setScoreScaleExam,
  updateScoreScaleLevel,
} from "@/electron-src/lib/prisma/scoreScale"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

let fixture: Awaited<ReturnType<typeof createFullTestExam>>
let otherFixture: Awaited<ReturnType<typeof createFullTestExam>>

beforeEach(async () => {
  await cleanupTestDatabase()
  fixture = await createFullTestExam(testPrisma, {
    pageCount: 1,
    cropRegionsPerPage: 2,
    studentCount: 1,
    includeScores: false,
  })
  otherFixture = await createFullTestExam(testPrisma, {
    pageCount: 1,
    cropRegionsPerPage: 1,
    studentCount: 1,
    includeScores: false,
  })
})

afterAll(async () => {
  await disconnectTestPrisma()
  await testPrisma.$disconnect()
})

const actorId = () => fixture.user.id

/** 類型 A/B/C（10・6・3点）で組を作る */
const ABC_LEVELS = [
  { label: "A", score: 10 },
  { label: "B", score: 6 },
  { label: "C", score: 3 },
]
const createScale = (
  input: { examId: string | null; name: string },
  actorUserId: string
) => createScoreScale({ ...input, levels: ABC_LEVELS }, actorUserId)
const examId = () => fixture.exam.id

describe("類型評価（類型の組）", () => {
  it("渡した類型つきで作られ、点数は数で返る", async () => {
    const scoreScale = await createScale(
      { examId: examId(), name: "記述3段階" },
      actorId()
    )
    expect(
      scoreScale.levels.map((level) => [level.label, level.score])
    ).toEqual([
      ["A", 10],
      ["B", 6],
      ["C", 3],
    ])
  })

  it("試験で選べるのは、その試験のものと共通のものだけ", async () => {
    const own = await createScale(
      { examId: examId(), name: "この試験" },
      actorId()
    )
    const shared = await createScale({ examId: null, name: "共通" }, actorId())
    await createScale(
      { examId: otherFixture.exam.id, name: "ほかの試験" },
      actorId()
    )

    const listed = await listScoreScales({ examId: examId() })
    expect(listed.map((scoreScale) => scoreScale.id).sort()).toEqual(
      [own.id, shared.id].sort()
    )
    expect(await listScoreScales({ examId: null })).toHaveLength(3)
  })

  it("点数は配点を超えてよく、負の数は書かない", async () => {
    const scoreScale = await createScale(
      { examId: examId(), name: "" },
      actorId()
    )
    const level = await createScoreScaleLevel(
      { scaleId: scoreScale.id, label: "S", description: "", score: 12 },
      actorId()
    )
    expect(level.score).toBe(12)
    expect(level.sortOrder).toBe(3)

    await expect(
      updateScoreScaleLevel(level.id, { score: -0.5 }, actorId())
    ).rejects.toThrow("0 以上")
  })

  it("類型を並べ替えられる", async () => {
    const scoreScale = await createScale(
      { examId: examId(), name: "" },
      actorId()
    )
    const [levelA, levelB, levelC] = scoreScale.levels
    await reorderScoreScaleLevels(
      scoreScale.id,
      [
        { id: levelC.id, sortOrder: 0 },
        { id: levelA.id, sortOrder: 1 },
        { id: levelB.id, sortOrder: 2 },
      ],
      actorId()
    )
    const [listed] = await listScoreScales({ examId: examId() })
    expect(listed.levels.map((level) => level.label)).toEqual(["C", "A", "B"])
  })
})

describe("消す", () => {
  it("使っている設問があれば組を消せず、外せば消せる", async () => {
    const scoreScale = await createScale(
      { examId: examId(), name: "" },
      actorId()
    )
    const cropRegionId = fixture.cropRegions[0].id
    await setCropRegionScoreScale(cropRegionId, scoreScale.id, actorId())

    await expect(deleteScoreScale(scoreScale.id, actorId())).rejects.toThrow(
      "1問の設問が使っている"
    )

    await setCropRegionScoreScale(cropRegionId, null, actorId())
    await deleteScoreScale(scoreScale.id, actorId())
    expect(
      await testPrisma.scoreScaleLevel.count({
        where: { scaleId: scoreScale.id },
      })
    ).toBe(0)
    // 既に消えていても投げない
    await deleteScoreScale(scoreScale.id, actorId())
  })

  it("付けた採点がある類型は消せない", async () => {
    const scoreScale = await createScale(
      { examId: examId(), name: "" },
      actorId()
    )
    const [levelA, levelB] = scoreScale.levels
    await testPrisma.questionScore.create({
      data: {
        cropRegionId: fixture.cropRegions[0].id,
        examStudentId: fixture.examStudents[0].id,
        userId: actorId(),
        status: "evaluated",
        scaleLevelId: levelA.id,
      },
    })

    await expect(deleteScoreScaleLevel(levelA.id, actorId())).rejects.toThrow(
      "使われている"
    )
    await deleteScoreScaleLevel(levelB.id, actorId())
    const [listed] = await listScoreScales({ examId: examId() })
    expect(listed.levels.map((level) => level.label)).toEqual(["A", "C"])
    expect(listed.levels[0].questionScores).toHaveLength(1)
  })

  it("試験を消すと試験の組だけが消え、共通の組は残る", async () => {
    await createScale({ examId: examId(), name: "試験" }, actorId())
    const shared = await createScale({ examId: null, name: "共通" }, actorId())
    await testPrisma.exam.delete({ where: { id: examId() } })
    const remaining = await testPrisma.scoreScale.findMany()
    expect(remaining.map((scoreScale) => scoreScale.id)).toEqual([shared.id])
  })
})

describe("共通にする・試験に戻す", () => {
  it("共通にでき、その試験の設問だけが使っていれば試験に戻せる", async () => {
    const scoreScale = await createScale(
      { examId: examId(), name: "" },
      actorId()
    )
    await setCropRegionScoreScale(
      fixture.cropRegions[0].id,
      scoreScale.id,
      actorId()
    )
    expect(
      (await setScoreScaleExam(scoreScale.id, null, actorId())).examId
    ).toBeNull()
    expect(
      (await setScoreScaleExam(scoreScale.id, examId(), actorId())).examId
    ).toBe(examId())
  })

  it("ほかの試験の設問が使っていれば、試験に戻せない", async () => {
    const scoreScale = await createScale({ examId: null, name: "" }, actorId())
    await setCropRegionScoreScale(
      otherFixture.cropRegions[0].id,
      scoreScale.id,
      actorId()
    )
    await expect(
      setScoreScaleExam(scoreScale.id, examId(), actorId())
    ).rejects.toThrow("ほかの試験")
  })
})

describe("設問の組を選ぶ", () => {
  it("ほかの試験の組は選べない", async () => {
    const otherScale = await createScale(
      { examId: otherFixture.exam.id, name: "" },
      actorId()
    )
    await expect(
      setCropRegionScoreScale(
        fixture.cropRegions[0].id,
        otherScale.id,
        actorId()
      )
    ).rejects.toThrow("ほかの試験")
  })

  it("組を消すと設問の組は null に戻る（同期で届いた削除）", async () => {
    const scoreScale = await createScale(
      { examId: examId(), name: "" },
      actorId()
    )
    const cropRegionId = fixture.cropRegions[0].id
    await setCropRegionScoreScale(cropRegionId, scoreScale.id, actorId())
    await testPrisma.scoreScale.delete({ where: { id: scoreScale.id } })
    const cropRegion = await testPrisma.cropRegion.findUniqueOrThrow({
      where: { id: cropRegionId },
    })
    expect(cropRegion.scoreScaleId).toBeNull()
  })
})

describe("複製", () => {
  it("類型ごと写し、渡した設問を複製へ付け替える", async () => {
    const shared = await createScale(
      { examId: null, name: "共通3段階" },
      actorId()
    )
    const [firstRegion, secondRegion] = fixture.cropRegions
    await setCropRegionScoreScale(firstRegion.id, shared.id, actorId())
    await setCropRegionScoreScale(secondRegion.id, shared.id, actorId())
    await setCropRegionScoreScale(
      otherFixture.cropRegions[0].id,
      shared.id,
      actorId()
    )

    const copy = await duplicateScoreScale(
      {
        scoreScaleId: shared.id,
        examId: examId(),
        reassignCropRegionIds: [firstRegion.id, secondRegion.id],
      },
      actorId()
    )
    expect(copy.examId).toBe(examId())
    expect(copy.name).toBe("共通3段階（複製）")
    expect(copy.levels.map((level) => [level.label, level.score])).toEqual(
      shared.levels.map((level) => [level.label, level.score])
    )
    expect(copy.cropRegions.map((cropRegion) => cropRegion.id).sort()).toEqual(
      [firstRegion.id, secondRegion.id].sort()
    )
    const otherRegion = await testPrisma.cropRegion.findUniqueOrThrow({
      where: { id: otherFixture.cropRegions[0].id },
    })
    expect(otherRegion.scoreScaleId).toBe(shared.id)
  })

  it("ほかの試験の設問は付け替えられない", async () => {
    const shared = await createScale({ examId: null, name: "" }, actorId())
    await expect(
      duplicateScoreScale(
        {
          scoreScaleId: shared.id,
          examId: examId(),
          reassignCropRegionIds: [otherFixture.cropRegions[0].id],
        },
        actorId()
      )
    ).rejects.toThrow("ほかの試験")
  })
})
