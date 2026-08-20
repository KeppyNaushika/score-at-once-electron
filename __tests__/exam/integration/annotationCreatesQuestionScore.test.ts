/**
 * 採点行を用意するのは、注釈を書くときだけであることの検証（段階21）。
 *
 * かつては renderer が**設問を表示した時点で** `ensureQuestionScore` を叩いていた。
 * 注釈（`DrawingAnnotation`）が親の `questionScoreId` を必須で持つため、描く前に
 * 置き場所の実体が要ったからである。その都合が「表示したら書き込む」という振る舞いに
 * なり、設問をめくるだけで `status:"unscored"` の空行が量産されていた
 * （docs/branch-review-findings.md #2）。
 *
 * いまは IPC が意図（「この答案のこの設問に、この採点者が描いた」）を運び、置き場所は
 * main の内側で用意する。ここで固定するのは3つ。
 *
 * - **読むだけでは行が増えない**（めくっただけで書き込まない）
 * - **保存すると行が無ければ用意され、注釈がぶら下がる**
 * - **既に採点済みの行があるとき、注釈の保存はその判定・部分点を書き換えない**
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
  batchCreateDrawingAnnotations,
  createDrawingAnnotation,
  deleteDrawingAnnotationsByTarget,
  getDrawingAnnotationsByTarget,
} from "@/electron-src/lib/prisma/drawingAnnotation"
import { setQuestionScore } from "@/electron-src/lib/prisma/questionScore"
import type { AnnotationTarget } from "@/types/drawingAnnotation.types"
import { newDrawingAnnotation } from "@/types/drawingAnnotation.types"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

let fixture: Awaited<ReturnType<typeof createFullTestExam>>
let target: AnnotationTarget

beforeEach(async () => {
  await cleanupTestDatabase()
  fixture = await createFullTestExam(testPrisma, { includeScores: false })
  target = {
    examStudentId: fixture.examStudents[0].id,
    cropRegionId: fixture.cropRegions[0].id,
    userId: fixture.user.id,
  }
})

afterAll(async () => {
  await disconnectTestPrisma()
  await testPrisma.$disconnect()
})

/** その行き先の採点行を全部引く（1行に保たれているかも見たいので findMany） */
async function questionScoreRowsFor(annotationTarget: AnnotationTarget) {
  return testPrisma.questionScore.findMany({
    where: {
      examStudentId: annotationTarget.examStudentId,
      cropRegionId: annotationTarget.cropRegionId,
      userId: annotationTarget.userId,
    },
  })
}

describe("採点行は、注釈を書くときに用意される", () => {
  it("注釈を読むだけでは採点行が増えない", async () => {
    const annotations = await getDrawingAnnotationsByTarget(target)

    expect(annotations).toEqual([])
    expect(await testPrisma.questionScore.count()).toBe(0)
  })

  it("行き先ごとの削除でも採点行は増えない", async () => {
    await deleteDrawingAnnotationsByTarget(target)

    expect(await testPrisma.questionScore.count()).toBe(0)
  })

  it("注釈を保存すると採点行が用意され、注釈がぶら下がる", async () => {
    expect(await questionScoreRowsFor(target)).toHaveLength(0)

    const created = await createDrawingAnnotation(
      target,
      newDrawingAnnotation({ type: "line", x: 0.1, y: 0.2 })
    )

    const rows = await questionScoreRowsFor(target)
    expect(rows).toHaveLength(1)
    // 用意された行は採点の意思表示ではない
    expect(rows[0].status).toBe("unscored")
    expect(rows[0].partialScore).toBeNull()
    expect(created.questionScore.id).toBe(rows[0].id)

    const saved = await testPrisma.drawingAnnotation.findUniqueOrThrow({
      where: { id: created.id },
    })
    expect(saved.questionScoreId).toBe(rows[0].id)
  })

  it("採点済みの行があるとき、注釈の保存は判定も部分点も書き換えない", async () => {
    await setQuestionScore({
      examStudentId: target.examStudentId,
      cropRegionId: target.cropRegionId,
      userId: target.userId,
      status: "partial",
      partialScore: 3,
    })

    await createDrawingAnnotation(
      target,
      newDrawingAnnotation({ type: "rectangle", x: 0.3, y: 0.4 })
    )

    const rows = await questionScoreRowsFor(target)
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe("partial")
    expect(Number(rows[0].partialScore)).toBe(3)
  })

  it("同じ行き先へまとめて保存しても採点行は1行のまま", async () => {
    // 置き場所の用意は「探して、無ければ作る」なので、並行に走らせると
    // どちらも見つけられずに二重の採点行ができる（unique が無く DB は止めない）
    const annotations = [
      newDrawingAnnotation({ type: "line", x: 0.1, y: 0.1 }),
      newDrawingAnnotation({ type: "line", x: 0.2, y: 0.2 }),
      newDrawingAnnotation({ type: "line", x: 0.3, y: 0.3 }),
    ]

    const created = await batchCreateDrawingAnnotations(
      annotations.map((annotation) => ({ target, annotation }))
    )

    expect(created).toHaveLength(3)
    const rows = await questionScoreRowsFor(target)
    expect(rows).toHaveLength(1)
    expect(
      await testPrisma.drawingAnnotation.count({
        where: { questionScoreId: rows[0].id },
      })
    ).toBe(3)
  })

  it("行き先が違えば採点行も別に用意される", async () => {
    const otherTarget: AnnotationTarget = {
      ...target,
      cropRegionId: fixture.cropRegions[1].id,
    }

    await createDrawingAnnotation(
      target,
      newDrawingAnnotation({ type: "line", x: 0.1, y: 0.1 })
    )
    await createDrawingAnnotation(
      otherTarget,
      newDrawingAnnotation({ type: "line", x: 0.1, y: 0.1 })
    )

    expect(await questionScoreRowsFor(target)).toHaveLength(1)
    expect(await questionScoreRowsFor(otherTarget)).toHaveLength(1)
    expect(await testPrisma.questionScore.count()).toBe(2)
  })

  it("保存した注釈は同じ行き先で読み直せる", async () => {
    const created = await createDrawingAnnotation(
      target,
      newDrawingAnnotation({ type: "ellipse", x: 0.5, y: 0.5 })
    )

    const annotations = await getDrawingAnnotationsByTarget(target)

    expect(annotations.map((annotation) => annotation.id)).toEqual([created.id])
    // 採点行は1行のまま（読み直しで増えない）
    expect(await questionScoreRowsFor(target)).toHaveLength(1)
  })
})
