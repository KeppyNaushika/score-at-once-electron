/**
 * 採点マーク（描画アノテーション）の供給形の統合テスト
 *
 * 経路ごとに `select` の中身が違い、どれかが `examStudentId` を落としても `as` で潰した
 * 型が通ってしまう状態だった。include を SSOT 2 本（作成者のみ / 文脈つき）へ畳んだ結果、
 * 行をそのまま渡すことになり Decimal と Date が IPC を越えるようになった。
 *
 * ここでは「どの経路でも同じ形で届くこと」と「シリアライズ済みであること」を固定する。
 * 07 採点画面（個別・グリッド・ブラウザ）はこの形に依存している。
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
  getAnnotationsForBrowse,
  getDrawingAnnotationsByCropRegion,
  getDrawingAnnotationsByExamStudent,
  getDrawingAnnotationsByQuestionScore,
} from "@/electron-src/lib/prisma/drawingAnnotation"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/** Date のままだと structured clone は通るが、経路ごとに型が食い違う */
function expectSerializedTimestamps(row: {
  createdAt: unknown
  updatedAt: unknown
}) {
  expect(typeof row.createdAt).toBe("string")
  expect(typeof row.updatedAt).toBe("string")
}

describe("採点マークの供給形", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("どの読み取り経路でも日時はシリアライズ済みで届く", async () => {
    const fixture = await createFullTestExam(testPrisma, {
      includeScores: true,
      includeAnnotations: true,
    })
    const [annotation] = fixture.drawingAnnotations
    const questionScore = fixture.questionScores.find(
      (candidate) => candidate.id === annotation.questionScoreId
    )!

    const byQuestionScore = await getDrawingAnnotationsByQuestionScore(
      annotation.questionScoreId
    )
    const byExamStudent = await getDrawingAnnotationsByExamStudent(
      questionScore.examStudentId
    )
    const byCropRegion = await getDrawingAnnotationsByCropRegion(
      questionScore.cropRegionId
    )
    const forBrowse = await getAnnotationsForBrowse(fixture.exam.id)

    // 経路ごとに Date のままだったり文字列だったりすると、
    // `updatedAt.getTime()` が片方でだけ落ちる
    expectSerializedTimestamps(byQuestionScore[0])
    expectSerializedTimestamps(byExamStudent[0])
    expectSerializedTimestamps(byCropRegion[0])
    expectSerializedTimestamps(forBrowse[0])
  })

  it("文脈つきの経路は受験者と設問の実体を同梱する", async () => {
    const fixture = await createFullTestExam(testPrisma, {
      includeScores: true,
      includeAnnotations: true,
    })
    const [annotation] = fixture.drawingAnnotations
    const questionScore = fixture.questionScores.find(
      (candidate) => candidate.id === annotation.questionScoreId
    )!

    const forBrowse = await getAnnotationsForBrowse(fixture.exam.id)
    const target = forBrowse.find((row) => row.id === annotation.id)!

    // examStudentId を落とすとグリッドの注釈が実行時に消える
    expect(target.questionScore.examStudentId).toBe(questionScore.examStudentId)
    expect(target.questionScore.cropRegion.id).toBe(questionScore.cropRegionId)
    // 注釈ブラウザの氏名表示と生徒フィルタが読む
    expect(target.questionScore.examStudent.student.lastName).toBeTruthy()
  })

  it("作成者はパスコードを除いて渡す", async () => {
    const fixture = await createFullTestExam(testPrisma, {
      includeScores: true,
      includeAnnotations: true,
    })

    const forBrowse = await getAnnotationsForBrowse(fixture.exam.id)
    const author = forBrowse[0].user as unknown as Record<string, unknown>

    // 縮小射影ではなく機密除去。表示に要る列は残す
    expect(author.username).toBe(fixture.user.username)
    expect(author.name).toBe(fixture.user.name)
    expect("passcode" in author).toBe(false)
  })

  it("union 列は境界で literal へ絞られる", async () => {
    const fixture = await createFullTestExam(testPrisma, {
      includeScores: true,
      includeAnnotations: true,
    })

    const forBrowse = await getAnnotationsForBrowse(fixture.exam.id)
    const target = forBrowse[0]

    // DB 上は String。既定へ倒して literal union にする（"circle" は未知の値）
    expect(["text", "line", "rectangle", "ellipse"]).toContain(target.type)
    expect([
      "solid",
      "wave",
      "zigzag",
      "double",
      "arrow",
      "both_arrow",
    ]).toContain(target.lineStyle)
  })
})
