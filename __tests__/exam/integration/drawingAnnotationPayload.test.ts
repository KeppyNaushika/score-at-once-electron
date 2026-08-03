/**
 * 採点マーク（描画アノテーション）の供給形の統合テスト
 *
 * 経路ごとに `select` の中身が違い、どれかが `examStudentId` を落としても `as` で潰した
 * 型が通ってしまう状態だった。include を SSOT 2 本（作成者のみ / 文脈つき）へ畳んだ結果、
 * 行をそのまま渡すことになり Decimal と Date が IPC を越えるようになった。
 *
 * ここでは「どの経路でも同じ形で届くこと」を固定する。
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
  toggleAnnotationFavorite,
  updateDrawingAnnotation,
} from "@/electron-src/lib/prisma/drawingAnnotation"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/**
 * 日時は Date のまま届く。structured clone が Date をそのまま通すため、
 * `serializePrisma` は Decimal だけを倒し Date には触れない。
 * 経路ごとに Date だったり文字列だったりすると、`updatedAt.getTime()` が
 * 片方の経路でだけ落ちる。
 */
function expectDateTimestamps(row: { createdAt: unknown; updatedAt: unknown }) {
  expect(row.createdAt).toBeInstanceOf(Date)
  expect(row.updatedAt).toBeInstanceOf(Date)
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

  it("どの読み取り経路でも日時は Date のまま届く", async () => {
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
    expectDateTimestamps(byQuestionScore[0])
    expectDateTimestamps(byExamStudent[0])
    expectDateTimestamps(byCropRegion[0])
    expectDateTimestamps(forBrowse[0])
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

  it("作成者は親の採点データからパスコードを除いて渡す", async () => {
    const fixture = await createFullTestExam(testPrisma, {
      includeScores: true,
      includeAnnotations: true,
    })

    const forBrowse = await getAnnotationsForBrowse(fixture.exam.id)
    const author = forBrowse[0].questionScore.user as unknown as Record<
      string,
      unknown
    >

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

    // DB 上は String。線種・揃えは既定へ倒して literal union にする
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

  it("描けない種別の行は読み取りの境界で除外される", async () => {
    const fixture = await createFullTestExam(testPrisma, {
      includeScores: true,
      includeAnnotations: true,
    })
    const [known] = fixture.drawingAnnotations

    // 旧バージョン・取り込み・DB 直編集で入りうる未知の種別。
    // 既定の "line" へ倒すと、終点を持たない（endX/endY は既定の 0.0）行が
    // 答案の原点へ向かう線として描かれてしまう。
    const unknown = await testPrisma.drawingAnnotation.create({
      data: {
        questionScoreId: known.questionScoreId,
        type: "circle",
        x: 20,
        y: 20,
      },
    })

    const byQuestionScore = await getDrawingAnnotationsByQuestionScore(
      known.questionScoreId
    )
    const forBrowse = await getAnnotationsForBrowse(fixture.exam.id)

    for (const rows of [byQuestionScore, forBrowse]) {
      expect(rows.map((row) => row.id)).toContain(known.id)
      expect(rows.map((row) => row.id)).not.toContain(unknown.id)
    }
  })

  it("更新は古い行を受け取ってもお気に入りを巻き戻さない", async () => {
    const fixture = await createFullTestExam(testPrisma, {
      includeScores: true,
      includeAnnotations: true,
    })
    const [target] = fixture.drawingAnnotations

    // Canvas は設問を開いた時点の行を抱え続ける。ここではその「古いコピー」を作る
    const staleRow = await getDrawingAnnotationsByQuestionScore(
      target.questionScoreId
    ).then((rows) => rows.find((row) => row.id === target.id))
    expect(staleRow?.isFavorite).toBe(false)

    // その間にサイドパネルが別経路でお気に入りを立てる
    await toggleAnnotationFavorite(target.id, true)

    // 古いコピーのまま位置だけ動かして書き戻す（＝マークをドラッグした状態）
    await updateDrawingAnnotation({ ...staleRow!, x: 0.42 })

    const saved = await testPrisma.drawingAnnotation.findUniqueOrThrow({
      where: { id: target.id },
    })
    expect(saved.x).toBe(0.42)
    expect(saved.isFavorite).toBe(true)
  })
})
