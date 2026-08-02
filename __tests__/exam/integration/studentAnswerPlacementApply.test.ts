/**
 * applyStudentAnswerPlacements（view 方式B: 2軸移動 + carry/discard）の採点安全性テスト
 *
 * 検証対象:
 * - 2軸移動: examPageId が実際に更新される（旧 batchUpdate は finalPageNumber を無視していた）
 * - carry（同一ページ）: 採点が examStudentId 付け替えで追従し、DrawingAnnotation が温存される
 * - discard: 影響採点（両スコア表）が削除され、注釈は cascade で道連れになる
 * - ガード: carry かつページ変化はエラー（DBは不変）
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

import { applyStudentAnswerPlacements } from "@/electron-src/lib/prisma/studentAnswer/placementApply"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/** 単純な構成（2生徒 × 2ページ × 1設問/ページ、全マス答案あり）で試験を作る */
async function buildSimpleExam() {
  const exam = await createFullTestExam(testPrisma, {
    studentCount: 2,
    pageCount: 2,
    cropRegionsPerPage: 1,
    includeScores: true,
    includeStudentAnswerImages: true,
  })

  const [examStudentA, examStudentB] = exam.examStudents
  const page1 = exam.pages.find((page) => page.pageNumber === 1)!
  const page2 = exam.pages.find((page) => page.pageNumber === 2)!
  const region1 = exam.cropRegions.find(
    (region) => region.examPageId === page1.id
  )!
  const region2 = exam.cropRegions.find(
    (region) => region.examPageId === page2.id
  )!

  const image = (pageId: string, examStudentId: string) =>
    exam.studentAnswerImages.find(
      (answerImage) =>
        answerImage.examPageId === pageId &&
        answerImage.examStudentId === examStudentId
    )!
  const score = (cropRegionId: string, examStudentId: string) =>
    exam.questionScores.find(
      (questionScore) =>
        questionScore.cropRegionId === cropRegionId &&
        questionScore.examStudentId === examStudentId
    )!

  return {
    exam,
    examStudentA,
    examStudentB,
    page1,
    page2,
    region1,
    region2,
    image,
    score,
  }
}

describe("applyStudentAnswerPlacements", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("① 同一ページの生徒swap: carry で採点が追従し DrawingAnnotation が温存される", async () => {
    const { examStudentA, examStudentB, page1, region1, image, score } =
      await buildSimpleExam()

    const scoreA = score(region1.id, examStudentA.id)
    const scoreB = score(region1.id, examStudentB.id)

    // scoreA（examStudentA の r1 採点）に注釈を付ける
    const annotation = await testPrisma.drawingAnnotation.create({
      data: {
        id: crypto.randomUUID(),
        questionScoreId: scoreA.id,
        type: "circle",
        x: 5,
        y: 5,
      },
    })

    const result = await applyStudentAnswerPlacements([
      {
        fileId: image(page1.id, examStudentA.id).id,
        finalExamStudentId: examStudentB.id,
        finalExamPageId: page1.id,
        scorePolicy: "carry",
      },
      {
        fileId: image(page1.id, examStudentB.id).id,
        finalExamStudentId: examStudentA.id,
        finalExamPageId: page1.id,
        scorePolicy: "carry",
      },
    ])
    expect(result.success).toBe(true)

    // 画像の examStudentId が入れ替わり、ページは p1 のまま
    const imgAfterA = await testPrisma.studentAnswerImage.findUniqueOrThrow({
      where: { id: image(page1.id, examStudentA.id).id },
    })
    expect(imgAfterA.examStudentId).toBe(examStudentB.id)
    expect(imgAfterA.examPageId).toBe(page1.id)

    // 採点が examStudentId 付け替えで追従（行=id は保持）
    const scoreAAfter = await testPrisma.questionScore.findUniqueOrThrow({
      where: { id: scoreA.id },
    })
    const scoreBAfter = await testPrisma.questionScore.findUniqueOrThrow({
      where: { id: scoreB.id },
    })
    expect(scoreAAfter.examStudentId).toBe(examStudentB.id)
    expect(scoreBAfter.examStudentId).toBe(examStudentA.id)

    // DrawingAnnotation は同じ questionScore に紐付いたまま温存
    const annotationAfter = await testPrisma.drawingAnnotation.findUnique({
      where: { id: annotation.id },
    })
    expect(annotationAfter).not.toBeNull()
    expect(annotationAfter!.questionScoreId).toBe(scoreA.id)
  })

  it("① 同一ページ discard: 影響採点が削除され注釈も消える", async () => {
    const { examStudentA, examStudentB, page1, region1, image, score } =
      await buildSimpleExam()

    const scoreA = score(region1.id, examStudentA.id)
    await testPrisma.drawingAnnotation.create({
      data: {
        id: crypto.randomUUID(),
        questionScoreId: scoreA.id,
        type: "circle",
        x: 1,
        y: 1,
      },
    })

    const result = await applyStudentAnswerPlacements([
      {
        fileId: image(page1.id, examStudentA.id).id,
        finalExamStudentId: examStudentB.id,
        finalExamPageId: page1.id,
        scorePolicy: "discard",
      },
      {
        fileId: image(page1.id, examStudentB.id).id,
        finalExamStudentId: examStudentA.id,
        finalExamPageId: page1.id,
        scorePolicy: "discard",
      },
    ])
    expect(result.success).toBe(true)

    // r1 の採点（A・B とも）は削除
    const remaining = await testPrisma.questionScore.findMany({
      where: { cropRegionId: region1.id },
    })
    expect(remaining).toHaveLength(0)

    // 注釈も cascade 削除
    const annotations = await testPrisma.drawingAnnotation.findMany({
      where: { questionScoreId: scoreA.id },
    })
    expect(annotations).toHaveLength(0)
  })

  it("複合回答の採点も carry で追従し、discard で破棄される", async () => {
    const { examStudentA, examStudentB, page1, page2, image } =
      await buildSimpleExam()
    const user = await testPrisma.user.findFirstOrThrow()

    const compoundAnswer = await testPrisma.compoundAnswer.create({
      data: {
        id: crypto.randomUUID(),
        examPageId: page1.id,
        label: "アイ",
        answerFormat: "multi-digit",
        correctAnswer: "42",
        points: 5,
      },
    })
    const compoundScoreA = await testPrisma.compoundAnswerScore.create({
      data: {
        id: crypto.randomUUID(),
        compoundAnswerId: compoundAnswer.id,
        examStudentId: examStudentA.id,
        userId: user.id,
        status: "correct",
        recognizedAnswer: "42",
      },
    })

    // 同一ページで A → B へ carry（B 側に複合採点は無いので単独移動）
    const carried = await applyStudentAnswerPlacements([
      {
        fileId: image(page1.id, examStudentA.id).id,
        finalExamStudentId: examStudentB.id,
        finalExamPageId: page1.id,
        scorePolicy: "carry",
      },
      {
        fileId: image(page1.id, examStudentB.id).id,
        finalExamStudentId: examStudentA.id,
        finalExamPageId: page1.id,
        scorePolicy: "carry",
      },
    ])
    expect(carried.success).toBe(true)

    // 複合採点が B へ追従（unique 違反を起こさず1件のまま）
    const afterCarry = await testPrisma.compoundAnswerScore.findMany({
      where: { compoundAnswerId: compoundAnswer.id },
    })
    expect(afterCarry).toHaveLength(1)
    expect(afterCarry[0].examStudentId).toBe(examStudentB.id)
    expect(afterCarry[0].recognizedAnswer).toBe("42")
    expect(afterCarry[0].id).toBe(compoundScoreA.id)

    // ページ跨ぎ（discard）で複合採点は破棄される。
    // carry 後この画像は B のもの。p2×B と入れ替える形で p1→p2 へ動かす。
    const discarded = await applyStudentAnswerPlacements([
      {
        fileId: image(page1.id, examStudentA.id).id,
        finalExamStudentId: examStudentB.id,
        finalExamPageId: page2.id,
        scorePolicy: "discard",
      },
      {
        fileId: image(page2.id, examStudentB.id).id,
        finalExamStudentId: examStudentB.id,
        finalExamPageId: page1.id,
        scorePolicy: "discard",
      },
    ])
    expect(discarded.success).toBe(true)
    expect(
      await testPrisma.compoundAnswerScore.count({
        where: { compoundAnswerId: compoundAnswer.id },
      })
    ).toBe(0)
  })

  it("② ページ跨ぎ移動(discard): examPageId が更新され、移動元ページの採点が破棄される", async () => {
    const { examStudentA, page1, page2, region1, region2, image, score } =
      await buildSimpleExam()

    const imgP1A = image(page1.id, examStudentA.id)
    const imgP2A = image(page2.id, examStudentA.id)

    // A の p1画像 と p2画像 を入れ替え（両方ページが変わる→discard）
    const result = await applyStudentAnswerPlacements([
      {
        fileId: imgP1A.id,
        finalExamStudentId: examStudentA.id,
        finalExamPageId: page2.id,
        scorePolicy: "discard",
      },
      {
        fileId: imgP2A.id,
        finalExamStudentId: examStudentA.id,
        finalExamPageId: page1.id,
        scorePolicy: "discard",
      },
    ])
    expect(result.success).toBe(true)

    // examPageId が実際に更新される（旧 batchUpdate は無視していた核心バグの修正）
    const imgP1AAfter = await testPrisma.studentAnswerImage.findUniqueOrThrow({
      where: { id: imgP1A.id },
    })
    const imgP2AAfter = await testPrisma.studentAnswerImage.findUniqueOrThrow({
      where: { id: imgP2A.id },
    })
    expect(imgP1AAfter.examPageId).toBe(page2.id)
    expect(imgP2AAfter.examPageId).toBe(page1.id)

    // A の r1・r2 採点は破棄
    expect(
      await testPrisma.questionScore.findUnique({
        where: { id: score(region1.id, examStudentA.id).id },
      })
    ).toBeNull()
    expect(
      await testPrisma.questionScore.findUnique({
        where: { id: score(region2.id, examStudentA.id).id },
      })
    ).toBeNull()
  })

  it("carry かつページ変化はエラー（DBは不変）", async () => {
    const { examStudentA, page1, page2, image } = await buildSimpleExam()
    const imgP1A = image(page1.id, examStudentA.id)

    const result = await applyStudentAnswerPlacements([
      {
        fileId: imgP1A.id,
        finalExamStudentId: examStudentA.id,
        finalExamPageId: page2.id, // ページ変化
        scorePolicy: "carry", // 追従は不可
      },
    ])
    expect(result.success).toBe(false)

    // ロールバックで examPageId は元のまま
    const imgAfter = await testPrisma.studentAnswerImage.findUniqueOrThrow({
      where: { id: imgP1A.id },
    })
    expect(imgAfter.examPageId).toBe(page1.id)
  })

  it("carry: 移動先生徒の孤立採点は掃除され二重計上しない", async () => {
    const { examStudentA, examStudentB, page1, region1, image } =
      await buildSimpleExam()

    // B の p1 画像だけを直接削除し、採点を孤立させる（deleteStudentAnswer は採点も
    // 消すので、ここでは孤立状態を作るために低レベル API を使う）。
    // これで移動先 (p1,B) は空マスになり、B は r1 に孤立採点だけを持つ。
    await testPrisma.studentAnswerImage.delete({
      where: { id: image(page1.id, examStudentB.id).id },
    })

    const result = await applyStudentAnswerPlacements([
      {
        fileId: image(page1.id, examStudentA.id).id,
        finalExamStudentId: examStudentB.id,
        finalExamPageId: page1.id,
        scorePolicy: "carry",
      },
    ])
    expect(result.success).toBe(true)

    // r1 の採点は1件のみ（B の孤立採点は掃除、A の採点が B へ追従）
    const r1Scores = await testPrisma.questionScore.findMany({
      where: { cropRegionId: region1.id },
    })
    expect(r1Scores).toHaveLength(1)
    expect(r1Scores[0].examStudentId).toBe(examStudentB.id)
  })

  it("finalExamStudentId=null（削除）は拒否され、画像は残る", async () => {
    const { examStudentA, page1, image } = await buildSimpleExam()
    const imgP1A = image(page1.id, examStudentA.id)

    const result = await applyStudentAnswerPlacements([
      {
        fileId: imgP1A.id,
        finalExamStudentId: null,
        finalExamPageId: page1.id,
        scorePolicy: "discard",
      },
    ])
    expect(result.success).toBe(false)
    expect(
      await testPrisma.studentAnswerImage.findUnique({
        where: { id: imgP1A.id },
      })
    ).not.toBeNull()
  })

  it("移動先が batch 外の答案で占有されていればエラー（上書きしない）", async () => {
    const { examStudentA, examStudentB, page1, image } = await buildSimpleExam()
    const imgP1A = image(page1.id, examStudentA.id)

    // A の p1 を、占有済みの (p1,B) へ単独移動（入れ替えでない）→ 拒否
    const result = await applyStudentAnswerPlacements([
      {
        fileId: imgP1A.id,
        finalExamStudentId: examStudentB.id,
        finalExamPageId: page1.id,
        scorePolicy: "discard",
      },
    ])
    expect(result.success).toBe(false)

    // A は動いていない
    const imgAfter = await testPrisma.studentAnswerImage.findUniqueOrThrow({
      where: { id: imgP1A.id },
    })
    expect(imgAfter.examStudentId).toBe(examStudentA.id)
    expect(imgAfter.examPageId).toBe(page1.id)
  })
})
