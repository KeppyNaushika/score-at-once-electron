/**
 * 「消す前に数え直して中止する」の検証（docs/remaining-work.md 段階26）
 *
 * 削除の確認は「消すと何を巻き添えにするか」を数えて見せる。**数え終わってから
 * 利用者が押すまでの間に、他の教員が書き足す窓**がある。塞ぎ方は共通で、
 * 「見せた件数」を削除の要求に添え、main が消す直前に同じ定義で数え直し、
 * 増えていれば中止する（`electron-src/lib/prisma/deleteAfterRecount.ts`）。
 *
 * ここで固定するのは経路ごとに次の2つ。
 * - 見せた後に増えたら、削除は起きず対象も巻き添えも残っている
 * - 減っただけなら中止しない（利用者が承知した巻き添えより実際は少ないだけ）
 *
 * **この検査は「窓が閉じた」ことの証明ではない。** 数え直しから削除までは同じ
 * トランザクションに入るが、利用者が見た瞬間から数え直しまでの窓は残る。
 * ここが見ているのは「見せた後に増えたものを黙って消さない」ことだけである。
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

import { deleteExam } from "@/electron-src/lib/prisma/exam"
import { removeStudentsFromExam } from "@/electron-src/lib/prisma/examStudent"
import {
  addStudentsFromClassroomToGrade,
  removeClassroomFromGrade,
} from "@/electron-src/lib/prisma/gradeStudent"
import { deleteMasterAnswer } from "@/electron-src/lib/prisma/masterAnswer"
import { deleteStudentAnswer } from "@/electron-src/lib/prisma/studentAnswer/crud"
import { DELETION_COUNT_NAME } from "@/lib/shared/deletionCountNames"
import type { ConfirmedDeletionCount } from "@/types/deletionConfirmation.types"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/** 利用者に「巻き添えは何も無い」と見せた状態 */
const SHOWN_NOTHING: ConfirmedDeletionCount[] = []

/** 2生徒 × 2ページ × 1設問/ページ、全マス答案あり・全マス採点済み */
async function buildExam() {
  const exam = await createFullTestExam(testPrisma, {
    studentCount: 2,
    pageCount: 2,
    cropRegionsPerPage: 1,
    includeScores: true,
    includeStudentAnswerImages: true,
  })

  const [examStudentA] = exam.examStudents
  const page1 = exam.pages.find((page) => page.pageNumber === 1)!
  const region1 = exam.cropRegions.find(
    (cropRegion) => cropRegion.examPageId === page1.id
  )!
  const answerImage = exam.studentAnswerImages.find(
    (studentAnswerImage) =>
      studentAnswerImage.examPageId === page1.id &&
      studentAnswerImage.examStudentId === examStudentA.id
  )!

  return { exam, examStudentA, page1, region1, answerImage }
}

/** 全マスの採点を「まだ誰も採点していない」状態に戻す */
async function resetToUnscored(examStudentId: string) {
  await testPrisma.questionScore.updateMany({
    where: { examStudentId },
    data: { status: "unscored", partialScore: null },
  })
}

describe("消す前に数え直して中止する", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("答案: 「採点データなし」を見せた後に採点されたら中止し、答案も採点も残る", async () => {
    const { examStudentA, region1, answerImage } = await buildExam()
    // 利用者はこの状態を見た（採点実績 0 件）
    await resetToUnscored(examStudentA.id)

    // 押すまでの間に、別の教員が 07 でこの設問を採点した
    await testPrisma.questionScore.updateMany({
      where: { cropRegionId: region1.id, examStudentId: examStudentA.id },
      data: { status: "correct" },
    })

    await expect(
      deleteStudentAnswer(answerImage.id, SHOWN_NOTHING)
    ).rejects.toThrow(/採点済みの設問 0件 → 1件/)

    // 答案も採点も消えていない
    expect(
      await testPrisma.studentAnswerImage.findUnique({
        where: { id: answerImage.id },
      })
    ).not.toBeNull()
    expect(
      await testPrisma.questionScore.count({
        where: { cropRegionId: region1.id, examStudentId: examStudentA.id },
      })
    ).toBe(1)
  })

  it("答案: 見せたときより減っていても中止しない（承知した巻き添えより少ないだけ）", async () => {
    const { examStudentA, region1, answerImage } = await buildExam()

    // 利用者は「採点済みの設問 5問」を見た（その後、他の教員が採点を取り消した）
    await resetToUnscored(examStudentA.id)
    await testPrisma.questionScore.updateMany({
      where: { cropRegionId: region1.id, examStudentId: examStudentA.id },
      data: { status: "correct" },
    })

    await deleteStudentAnswer(answerImage.id, [
      { countedName: DELETION_COUNT_NAME.scoredQuestion, shownCount: 5 },
    ])

    expect(
      await testPrisma.studentAnswerImage.findUnique({
        where: { id: answerImage.id },
      })
    ).toBeNull()
  })

  it("受験生徒: 「採点データなし」を見せた後に答案が届いたら中止する", async () => {
    const exam = await createFullTestExam(testPrisma, {
      studentCount: 2,
      pageCount: 1,
      cropRegionsPerPage: 1,
      includeScores: false,
      includeStudentAnswerImages: false,
    })
    const [examStudentA] = exam.examStudents

    // 利用者は「採点データがないため安全に削除できます」を見た。押すまでの間に
    // 別の教員がこの生徒の答案を取り込んだ
    await testPrisma.studentAnswerImage.create({
      data: {
        id: crypto.randomUUID(),
        examPageId: exam.pages[0].id,
        examStudentId: examStudentA.id,
        imagePath: "answer-sheets/late.png",
      },
    })

    await expect(
      removeStudentsFromExam(
        exam.exam.id,
        [examStudentA.studentId],
        SHOWN_NOTHING
      )
    ).rejects.toThrow(/採点データ 0件 → 1件/)

    expect(
      await testPrisma.examStudent.findUnique({
        where: { id: examStudentA.id },
      })
    ).not.toBeNull()
  })

  it("模範解答ページ: 「答案なし」を見せた後に取り込まれたら中止する", async () => {
    const exam = await createFullTestExam(testPrisma, {
      studentCount: 1,
      pageCount: 2,
      cropRegionsPerPage: 1,
      includeScores: false,
      includeStudentAnswerImages: false,
    })
    const page1 = exam.pages.find((page) => page.pageNumber === 1)!

    // 利用者は「このページと、ページ上の採点領域が削除されます」を見た
    await testPrisma.studentAnswerImage.create({
      data: {
        id: crypto.randomUUID(),
        examPageId: page1.id,
        examStudentId: exam.examStudents[0].id,
        imagePath: "answer-sheets/late.png",
      },
    })

    await expect(deleteMasterAnswer(page1.id, SHOWN_NOTHING)).rejects.toThrow(
      /このページの答案 0件 → 1件/
    )

    expect(
      await testPrisma.examPage.findUnique({ where: { id: page1.id } })
    ).not.toBeNull()
  })

  it("試験: 見せた件数より答案が増えていたら中止し、試験ごと残る", async () => {
    const exam = await createFullTestExam(testPrisma, {
      studentCount: 1,
      pageCount: 1,
      cropRegionsPerPage: 1,
      includeScores: false,
      includeStudentAnswerImages: false,
    })

    // 利用者が見たのは「模範解答1件・採点領域1件」まで。押すまでの間に答案が届いた
    const shownCounts: ConfirmedDeletionCount[] = [
      { countedName: DELETION_COUNT_NAME.masterAnswer, shownCount: 1 },
      { countedName: DELETION_COUNT_NAME.cropRegion, shownCount: 1 },
    ]
    await testPrisma.studentAnswerImage.create({
      data: {
        id: crypto.randomUUID(),
        examPageId: exam.pages[0].id,
        examStudentId: exam.examStudents[0].id,
        imagePath: "answer-sheets/late.png",
      },
    })

    await expect(deleteExam(exam.exam.id, shownCounts)).rejects.toThrow(
      /答案 0件 → 1件/
    )

    expect(
      await testPrisma.exam.findUnique({ where: { id: exam.exam.id } })
    ).not.toBeNull()
  })

  it("学級: 「専属生徒はいません」を見せた後に在籍が増えたら中止し、生徒は残る", async () => {
    const grade = await testPrisma.grade.create({
      data: { id: crypto.randomUUID(), name: "数え直しの成績" },
    })
    const classroom = await testPrisma.classroom.create({
      data: { id: crypto.randomUUID(), name: "数え直しの学級", grade: 1 },
    })
    // 在籍0名の学級を成績へ登録する。利用者はここで
    // 「この学級にのみ所属する生徒はいません」を見た
    await addStudentsFromClassroomToGrade(grade.id, classroom.id, false)

    // 押すまでの間に、別の教員がこの学級へ生徒を在籍させた
    const student = await testPrisma.student.create({
      data: {
        id: crypto.randomUUID(),
        studentNumber: `S-late-${crypto.randomUUID()}`,
        lastName: "遅れて",
        firstName: "入った",
        lastNameKana: "オクレテ",
        firstNameKana: "ハイッタ",
        enrollmentYear: 2024,
      },
    })
    await testPrisma.studentClassroomMembership.create({
      data: {
        id: crypto.randomUUID(),
        studentId: student.id,
        classroomId: classroom.id,
        attendanceNumber: 1,
        startDate: new Date("2025-04-01"),
      },
    })

    await expect(
      removeClassroomFromGrade(grade.id, classroom.id, true, SHOWN_NOTHING)
    ).rejects.toThrow(/この学級にのみ所属する生徒 0件 → 1件/)

    // 学級の登録も在籍も残っている
    expect(
      await testPrisma.gradeClassroom.count({ where: { gradeId: grade.id } })
    ).toBe(1)
    expect(
      await testPrisma.studentClassroomMembership.count({
        where: { classroomId: classroom.id },
      })
    ).toBe(1)
  })
})
