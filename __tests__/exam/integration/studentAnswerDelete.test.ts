/**
 * deleteStudentAnswer / getStudentAnswerScoreSummary の採点データ整合性テスト
 *
 * 背景: StudentAnswerImage は採点系の子リレーションを持たず（採点は
 * `(cropRegionId, examStudentId)` / `(compoundAnswerId, examStudentId)` 座標に紐づく）、
 * 画像を消しても cascade は走らない。かつて画像だけを削除していたため採点が孤児化していた。
 *
 * 検証対象:
 * - 削除でページ scoped の QuestionScore / ScoreDecision / CompoundAnswerScore が消える
 * - DrawingAnnotation は親の cascade で消える
 * - 他生徒・他ページの採点は巻き添えにしない
 * - サマリは unscored の初期化行を「採点データあり」と誤判定しない
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
  SCORE_TARGET_DELETED,
  updateQuestionScore,
} from "@/electron-src/lib/prisma/questionScore"
import {
  deleteStudentAnswer,
  getStudentAnswerDeletionCounts,
} from "@/electron-src/lib/prisma/studentAnswer/crud"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/**
 * 「いま画面に出ている件数を見て押した」削除。
 *
 * 段階26 で削除は「見せた件数」を要求するようになった。ここでは直前に数えた
 * 件数をそのまま添えるので、数え直しは必ず一致する（＝中止されない）。
 * 「見せた後に増える」側の検証は deleteAfterRecount.test.ts にある。
 */
async function deleteAnswerAsSeen(answerSheetId: string) {
  return await deleteStudentAnswer(
    answerSheetId,
    await getStudentAnswerDeletionCounts(answerSheetId)
  )
}

/** 2生徒 × 2ページ × 1設問/ページ、全マス答案あり・全マス採点済み */
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

  const user = await testPrisma.user.findFirstOrThrow()

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
    user,
  }
}

describe("deleteStudentAnswer", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("答案削除でそのマスの採点データが全て消え、他マスは残る", async () => {
    const {
      examStudentA,
      examStudentB,
      page1,
      page2,
      region1,
      region2,
      image,
      score,
      user,
    } = await buildSimpleExam()

    // examStudentA の p1 に確定値・注釈・複合回答の採点を足す
    const annotation = await testPrisma.drawingAnnotation.create({
      data: {
        id: crypto.randomUUID(),
        questionScoreId: score(region1.id, examStudentA.id).id,
        type: "circle",
        x: 5,
        y: 5,
      },
    })
    await testPrisma.scoreDecision.create({
      data: {
        id: crypto.randomUUID(),
        cropRegionId: region1.id,
        examStudentId: examStudentA.id,
        verdict: "correct",
        decidedByUserId: user.id,
      },
    })
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
    await testPrisma.compoundAnswerScore.create({
      data: {
        id: crypto.randomUUID(),
        compoundAnswerId: compoundAnswer.id,
        examStudentId: examStudentA.id,
        userId: user.id,
        status: "correct",
        recognizedAnswer: "42",
      },
    })

    await deleteAnswerAsSeen(image(page1.id, examStudentA.id).id)

    // 画像本体
    expect(
      await testPrisma.studentAnswerImage.findUnique({
        where: { id: image(page1.id, examStudentA.id).id },
      })
    ).toBeNull()

    // 当該マス (p1 × A) の採点は全滅
    expect(
      await testPrisma.questionScore.count({
        where: { cropRegionId: region1.id, examStudentId: examStudentA.id },
      })
    ).toBe(0)
    expect(
      await testPrisma.scoreDecision.count({
        where: { cropRegionId: region1.id, examStudentId: examStudentA.id },
      })
    ).toBe(0)
    expect(
      await testPrisma.compoundAnswerScore.count({
        where: {
          compoundAnswerId: compoundAnswer.id,
          examStudentId: examStudentA.id,
        },
      })
    ).toBe(0)
    // DrawingAnnotation は親 QuestionScore の cascade で消える
    expect(
      await testPrisma.drawingAnnotation.findUnique({
        where: { id: annotation.id },
      })
    ).toBeNull()

    // 他生徒（p1 × B）・他ページ（p2 × A）は巻き添えにしない
    expect(
      await testPrisma.questionScore.count({
        where: { cropRegionId: region1.id, examStudentId: examStudentB.id },
      })
    ).toBe(1)
    expect(
      await testPrisma.questionScore.count({
        where: { cropRegionId: region2.id, examStudentId: examStudentA.id },
      })
    ).toBe(1)
    expect(
      await testPrisma.studentAnswerImage.findUnique({
        where: { id: image(page2.id, examStudentA.id).id },
      })
    ).not.toBeNull()
  })

  it("削除した DrawingAnnotation は親 QuestionScore の cascade で消える", async () => {
    const { examStudentA, page1, region1, image, score } =
      await buildSimpleExam()

    const annotation = await testPrisma.drawingAnnotation.create({
      data: {
        id: crypto.randomUUID(),
        questionScoreId: score(region1.id, examStudentA.id).id,
        type: "circle",
        x: 5,
        y: 5,
      },
    })

    await deleteAnswerAsSeen(image(page1.id, examStudentA.id).id)

    // 削除の伝搬は sqlite-nas-sync の `_tombstone` が担うため、
    // アプリ側で削除記録を持つ必要はない（issue #918）
    expect(
      await testPrisma.drawingAnnotation.findUnique({
        where: { id: annotation.id },
      })
    ).toBeNull()
  })

  it("削除直前の採点実績を返す（モーダルと同じ定義）", async () => {
    const { examStudentA, page1, image } = await buildSimpleExam()

    const { deletedCounts } = await deleteAnswerAsSeen(
      image(page1.id, examStudentA.id).id
    )
    expect(deletedCounts).toContainEqual({
      countedName: "採点済みの設問",
      shownCount: 1,
    })
  })

  it("未採点の答案では採点実績なしを返す（トーストの文言が変わる）", async () => {
    const { examStudentA, page1, region1, image } = await buildSimpleExam()

    await testPrisma.questionScore.updateMany({
      where: { cropRegionId: region1.id, examStudentId: examStudentA.id },
      data: { status: "unscored", partialScore: null },
    })

    const { deletedCounts } = await deleteAnswerAsSeen(
      image(page1.id, examStudentA.id).id
    )
    expect(deletedCounts).toEqual([])
  })

  it("協調採点では全教員分の採点行が消える（自分の行だけ残さない）", async () => {
    const { examStudentA, page1, region1, image, user } =
      await buildSimpleExam()

    // 別教員2名の提案行を同じマスに追加（QuestionScore に unique は無い）
    const otherTeachers = await Promise.all(
      [1, 2].map((index) =>
        testPrisma.user.create({
          data: {
            id: crypto.randomUUID(),
            name: `別の教員${index}`,
            username: `teacher-${crypto.randomUUID()}`,
          },
        })
      )
    )
    for (const teacher of otherTeachers) {
      await testPrisma.questionScore.create({
        data: {
          id: crypto.randomUUID(),
          cropRegionId: region1.id,
          examStudentId: examStudentA.id,
          userId: teacher.id,
          status: "incorrect",
        },
      })
    }
    // 3教員（元の1名 + 追加2名）分の行がある状態
    expect(
      await testPrisma.questionScore.count({
        where: { cropRegionId: region1.id, examStudentId: examStudentA.id },
      })
    ).toBe(3)

    await deleteAnswerAsSeen(image(page1.id, examStudentA.id).id)

    // 教員を問わず全滅している（userId で絞っていないことの保証）
    expect(
      await testPrisma.questionScore.count({
        where: { cropRegionId: region1.id, examStudentId: examStudentA.id },
      })
    ).toBe(0)
    for (const teacher of [user, ...otherTeachers]) {
      expect(
        await testPrisma.questionScore.count({
          where: {
            cropRegionId: region1.id,
            examStudentId: examStudentA.id,
            userId: teacher.id,
          },
        })
      ).toBe(0)
    }
  })

  it("削除後に別教員が同じ採点を保存すると target-deleted を返す（協調採点）", async () => {
    const { examStudentA, page1, region1, image, score } =
      await buildSimpleExam()
    const scoreId = score(region1.id, examStudentA.id).id

    // 教員Aが答案を削除 → 教員Bが開いたままの採点を保存しようとする
    await deleteAnswerAsSeen(image(page1.id, examStudentA.id).id)

    const result = await updateQuestionScore(scoreId, {
      status: "correct",
      partialScore: null,
    })
    // 例外ではなく「対象が消えている」という結果が値で返る（協調採点で他教員が
    // 答案ごと削除したケース）
    expect(result.status).toBe(SCORE_TARGET_DELETED)
  })

  it("存在しない答案は例外を投げ、DB は変化しない", async () => {
    const { region1, examStudentA } = await buildSimpleExam()

    await expect(deleteStudentAnswer(crypto.randomUUID(), [])).rejects.toThrow()
    expect(
      await testPrisma.questionScore.count({
        where: { cropRegionId: region1.id, examStudentId: examStudentA.id },
      })
    ).toBe(1)
  })
})

describe("getStudentAnswerDeletionCounts", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  /** 数えた結果から1項目ぶんの件数を取り出す（無ければ0件） */
  const countOf = (
    deletionCounts: { countedName: string; shownCount: number }[],
    countedName: string
  ) =>
    deletionCounts.find(
      (deletionCount) => deletionCount.countedName === countedName
    )?.shownCount ?? 0

  it("採点済みなら内訳を件数で返す", async () => {
    const { examStudentA, page1, region1, image, score } =
      await buildSimpleExam()

    await testPrisma.drawingAnnotation.create({
      data: {
        id: crypto.randomUUID(),
        questionScoreId: score(region1.id, examStudentA.id).id,
        type: "circle",
        x: 5,
        y: 5,
      },
    })

    const result = await getStudentAnswerDeletionCounts(
      image(page1.id, examStudentA.id).id
    )
    expect(result.length).toBeGreaterThan(0)
    expect(countOf(result, "採点済みの設問")).toBe(1)
    expect(countOf(result, "答案への書き込み")).toBe(1)
    // 0件の項目は出さない（見せていない＝0件と見せた扱い）
    expect(countOf(result, "確定した点数")).toBe(0)
  })

  it("協調採点で1設問に複数教員の行があっても設問数で数える", async () => {
    const { examStudentA, page1, region1, image } = await buildSimpleExam()

    // 別教員の提案行を同じ設問に追加（QuestionScore に unique は無い）
    const otherTeacher = await testPrisma.user.create({
      data: {
        id: crypto.randomUUID(),
        name: "別の教員",
        username: `teacher-${crypto.randomUUID()}`,
      },
    })
    await testPrisma.questionScore.create({
      data: {
        id: crypto.randomUUID(),
        cropRegionId: region1.id,
        examStudentId: examStudentA.id,
        userId: otherTeacher.id,
        status: "incorrect",
      },
    })

    const result = await getStudentAnswerDeletionCounts(
      image(page1.id, examStudentA.id).id
    )
    // 行数は2だが設問は1問
    expect(countOf(result, "採点済みの設問")).toBe(1)
  })

  it("部分点のみ入力された複合回答も採点済みとして数える", async () => {
    const { examStudentA, page1, region1, image } = await buildSimpleExam()
    const user = await testPrisma.user.findFirstOrThrow()

    // 設問側は未採点に戻し、複合回答の部分点だけがある状態にする
    await testPrisma.questionScore.updateMany({
      where: { cropRegionId: region1.id, examStudentId: examStudentA.id },
      data: { status: "unscored", partialScore: null },
    })
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
    await testPrisma.compoundAnswerScore.create({
      data: {
        id: crypto.randomUUID(),
        compoundAnswerId: compoundAnswer.id,
        examStudentId: examStudentA.id,
        userId: user.id,
        status: "unscored",
        recognizedAnswer: null,
        partialScore: 3,
      },
    })

    const result = await getStudentAnswerDeletionCounts(
      image(page1.id, examStudentA.id).id
    )
    expect(countOf(result, "採点済みの複合回答")).toBe(1)
    expect(result.length).toBeGreaterThan(0)
  })

  it("unscored の初期化行だけなら何も数えない", async () => {
    const { examStudentA, page1, region1, image } = await buildSimpleExam()

    // 初期化直後の状態（status=unscored・部分点なし）に戻す
    await testPrisma.questionScore.updateMany({
      where: { cropRegionId: region1.id, examStudentId: examStudentA.id },
      data: { status: "unscored", partialScore: null },
    })

    const result = await getStudentAnswerDeletionCounts(
      image(page1.id, examStudentA.id).id
    )
    expect(result).toEqual([])
  })

  it("未採点でも削除時は初期化行ごと消える", async () => {
    const { examStudentA, page1, region1, image } = await buildSimpleExam()

    await testPrisma.questionScore.updateMany({
      where: { cropRegionId: region1.id, examStudentId: examStudentA.id },
      data: { status: "unscored", partialScore: null },
    })

    await deleteAnswerAsSeen(image(page1.id, examStudentA.id).id)
    expect(
      await testPrisma.questionScore.count({
        where: { cropRegionId: region1.id, examStudentId: examStudentA.id },
      })
    ).toBe(0)
  })
})
