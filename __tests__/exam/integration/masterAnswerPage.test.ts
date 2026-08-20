/**
 * 模範解答ページ（ExamPage）の差し替え・削除の統合テスト
 *
 * 模範解答画像は ExamPage 自身が持つ。そのため画像を取り替えるだけの操作と、
 * ページごと消す操作を取り違えると、答案や採点結果まで失われる。
 *
 * 検証すること:
 * - 差し替えは画像だけを入れ替え、採点領域・答案画像・採点結果を残す
 * - 差し替えは古い画像ファイルを消し、新しいファイルを置く
 * - 削除はページごと消し、答案画像と採点結果もカスケード削除する
 * - 削除は残りページの番号を1から振り直す
 * - 削除は答案画像の実ファイルも消す（ページが消えると参照する者が居なくなるため）
 */
import * as fsPromises from "fs/promises"
import * as os from "os"
import * as path from "path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

// getMasterAnswersDirectory がこのディレクトリを基準にするよう、import より前に設定する
const TEST_DATA_DIR = path.join(os.tmpdir(), "score-at-once-master-answer-test")
process.env.SCORE_AT_ONCE_DATA_DIR = TEST_DATA_DIR

vi.mock("../../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import { getAbsolutePathFromData } from "@/electron-src/lib/dataManager"
import {
  deleteMasterAnswer,
  moveExamPage,
  replaceMasterAnswerImage,
  uploadMasterAnswers,
} from "@/electron-src/lib/prisma/masterAnswer"

import { SAW_ALL_DELETION_COUNTS } from "../../helpers/deletionCounts"
import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"

const prisma = getTestPrismaClient()

/** アップロード1件分のダミー画像 */
const fileData = (name: string, content: string) => ({
  name,
  type: "image/png",
  buffer: new TextEncoder().encode(content).buffer as ArrayBuffer,
})

const exists = async (relativePath: string | null): Promise<boolean> => {
  if (!relativePath) return false
  try {
    await fsPromises.stat(getAbsolutePathFromData(relativePath))
    return true
  } catch {
    return false
  }
}

/** 2ページの試験を作り、1ページ目に採点領域・答案・採点結果を付ける */
async function seedExamWithScoredFirstPage() {
  const user = await prisma.user.create({
    data: { name: "採点者", username: `master-answer-${Date.now()}` },
  })
  const exam = await prisma.exam.create({
    data: { examName: "模範解答テスト" },
  })

  const pages = await uploadMasterAnswers(exam.id, [
    fileData("page1.png", "master-1"),
    fileData("page2.png", "master-2"),
  ])

  const student = await prisma.student.create({
    data: {
      studentNumber: `S${Date.now()}`,
      lastName: "山田",
      firstName: "花子",
      lastNameKana: "ヤマダ",
      firstNameKana: "ハナコ",
    },
  })
  const examStudent = await prisma.examStudent.create({
    data: { examId: exam.id, studentId: student.id, status: "participating" },
  })

  const cropRegion = await prisma.cropRegion.create({
    data: {
      examPageId: pages[0].id,
      label: "問1",
      type: "QUESTION_ANSWER",
      x: 0.1,
      y: 0.1,
      width: 0.2,
      height: 0.2,
      points: 10,
    },
  })

  // 答案画像は実ファイルも用意する（削除時に消えることを見るため）
  const answerImagePath = `exams/${exam.id}/answer-sheets/answer-1.png`
  const answerAbsolutePath = getAbsolutePathFromData(answerImagePath)
  await fsPromises.mkdir(path.dirname(answerAbsolutePath), { recursive: true })
  await fsPromises.writeFile(answerAbsolutePath, "answer")

  await prisma.studentAnswerImage.create({
    data: {
      examPageId: pages[0].id,
      examStudentId: examStudent.id,
      imagePath: answerImagePath,
    },
  })
  await prisma.questionScore.create({
    data: {
      cropRegionId: cropRegion.id,
      examStudentId: examStudent.id,
      userId: user.id,
      status: "correct",
    },
  })

  return { exam, pages, cropRegion, answerImagePath }
}

beforeEach(async () => {
  await cleanupTestDatabase()
  await fsPromises.rm(TEST_DATA_DIR, { recursive: true, force: true })
})

afterAll(async () => {
  await fsPromises.rm(TEST_DATA_DIR, { recursive: true, force: true })
  await disconnectTestPrisma()
})

describe("replaceMasterAnswerImage", () => {
  it("画像だけを入れ替え、採点領域・答案・採点結果を残す", async () => {
    const { pages, cropRegion } = await seedExamWithScoredFirstPage()

    const replaced = await replaceMasterAnswerImage(
      pages[0].id,
      fileData("new.png", "master-1-replaced")
    )

    expect(replaced.id).toBe(pages[0].id)
    expect(replaced.imagePath).not.toBe(pages[0].imagePath)
    expect(replaced.pageNumber).toBe(1)

    const survivors = await prisma.examPage.findUnique({
      where: { id: pages[0].id },
      include: { cropRegions: true, studentAnswerImages: true },
    })
    expect(survivors?.cropRegions).toHaveLength(1)
    expect(survivors?.studentAnswerImages).toHaveLength(1)
    expect(
      await prisma.questionScore.count({
        where: { cropRegionId: cropRegion.id },
      })
    ).toBe(1)
  })

  it("用紙サイズは引き継ぐ（教員が設定した値を差し替えで巻き戻さない）", async () => {
    const { pages } = await seedExamWithScoredFirstPage()
    await prisma.examPage.update({
      where: { id: pages[0].id },
      data: { pageSize: "B4" },
    })

    const replaced = await replaceMasterAnswerImage(
      pages[0].id,
      fileData("new.png", "master-1-replaced")
    )

    expect(replaced.pageSize).toBe("B4")
  })

  it("新しい画像を置いて古い画像を消す", async () => {
    const { pages } = await seedExamWithScoredFirstPage()

    const replaced = await replaceMasterAnswerImage(
      pages[0].id,
      fileData("new.png", "master-1-replaced")
    )

    expect(await exists(replaced.imagePath)).toBe(true)
    expect(await exists(pages[0].imagePath)).toBe(false)
  })

  it("DB更新に失敗したら書いたばかりの画像を片付ける", async () => {
    const { pages } = await seedExamWithScoredFirstPage()

    // ページを引いた後・更新する前に他の教員が消した、NAS上でDBがロックされた等。
    // 片付けないと、失敗のたびにフル解像度の画像が共有ディレクトリへ溜まる
    const masterDir = path.dirname(getAbsolutePathFromData(pages[0].imagePath!))
    const before = await fsPromises.readdir(masterDir)

    const update = vi
      .spyOn(prisma.examPage, "update")
      .mockRejectedValueOnce(new Error("DB is locked"))

    try {
      await expect(
        replaceMasterAnswerImage(pages[0].id, fileData("new.png", "orphan"))
      ).rejects.toThrow("DB is locked")
    } finally {
      update.mockRestore()
    }

    expect(await fsPromises.readdir(masterDir)).toEqual(before)
  })
})

describe("deleteMasterAnswer", () => {
  it("ページごと消し、答案と採点結果もカスケード削除する", async () => {
    const { pages, cropRegion } = await seedExamWithScoredFirstPage()

    const result = await deleteMasterAnswer(
      pages[0].id,
      SAW_ALL_DELETION_COUNTS
    )

    expect(result.deletedPage?.id).toBe(pages[0].id)
    expect(
      await prisma.examPage.findUnique({ where: { id: pages[0].id } })
    ).toBeNull()
    expect(
      await prisma.cropRegion.findUnique({ where: { id: cropRegion.id } })
    ).toBeNull()
    expect(await prisma.studentAnswerImage.count()).toBe(0)
    expect(await prisma.questionScore.count()).toBe(0)
  })

  it("残ったページの番号を1から振り直す", async () => {
    const { exam, pages } = await seedExamWithScoredFirstPage()

    await deleteMasterAnswer(pages[0].id, SAW_ALL_DELETION_COUNTS)

    const remaining = await prisma.examPage.findMany({
      where: { examId: exam.id },
    })
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(pages[1].id)
    expect(remaining[0].pageNumber).toBe(1)
  })

  it("模範解答と答案の画像ファイルを消す", async () => {
    const { pages, answerImagePath } = await seedExamWithScoredFirstPage()

    await deleteMasterAnswer(pages[0].id, SAW_ALL_DELETION_COUNTS)

    expect(await exists(pages[0].imagePath)).toBe(false)
    expect(await exists(answerImagePath)).toBe(false)
    // 消したのは対象ページの分だけ
    expect(await exists(pages[1].imagePath)).toBe(true)
  })

  it("存在しないページを指定しても失敗しない", async () => {
    const result = await deleteMasterAnswer(
      "no-such-page",
      SAW_ALL_DELETION_COUNTS
    )

    expect(result.deletedPage).toBeNull()
  })
})

describe("moveExamPage", () => {
  /** 画面に見えている並び。pageNumber は一意でないので id をタイブレークに入れる */
  const pagesInOrder = async (examId: string) =>
    prisma.examPage.findMany({
      where: { examId },
      orderBy: [{ pageNumber: "asc" }, { id: "asc" }],
    })

  const pageIdsInOrder = async (examId: string) =>
    (await pagesInOrder(examId)).map((page) => page.id)

  it("隣のページと入れ替わる", async () => {
    const { exam, pages } = await seedExamWithScoredFirstPage()

    const result = await moveExamPage(pages[0].id, "right")

    expect(result.moved).toBe(true)
    expect(await pageIdsInOrder(exam.id)).toEqual([pages[1].id, pages[0].id])
  })

  it("端のページは動かない", async () => {
    const { exam, pages } = await seedExamWithScoredFirstPage()

    const result = await moveExamPage(pages[0].id, "left")

    expect(result.moved).toBe(false)
    expect(await pageIdsInOrder(exam.id)).toEqual([pages[0].id, pages[1].id])
  })

  it("同じ番号のページがあっても、隣と1つだけ入れ替わる", async () => {
    // 2台が同時にページを足すと、同じ番号の行が別 id で並ぶ（sync のマージ）。
    // 番号の大小だけで隣を探すと同値を飛び越して2つ先と入れ替わっていた
    const exam = await prisma.exam.create({ data: { examName: "番号の同値" } })
    const pages = await uploadMasterAnswers(exam.id, [
      fileData("page1.png", "master-1"),
      fileData("page2.png", "master-2"),
      fileData("page3.png", "master-3"),
      fileData("page4.png", "master-4"),
    ])
    await prisma.examPage.update({
      where: { id: pages[2].id },
      data: { pageNumber: 2 },
    })

    // id のタイブレークで決まる実際の並びを見てから、2枚目を右へ動かす
    const before = await pageIdsInOrder(exam.id)
    const result = await moveExamPage(before[1], "right")

    expect(result.moved).toBe(true)
    expect(await pageIdsInOrder(exam.id)).toEqual([
      before[0],
      before[2],
      before[1],
      before[3],
    ])
  })

  it("番号が飛んでいても隣と入れ替わり、番号は 1..N へ直る", async () => {
    // 同期で片方の端末だけページが消えると、番号に穴が残ることがある
    const exam = await prisma.exam.create({ data: { examName: "番号飛び" } })
    const pages = await uploadMasterAnswers(exam.id, [
      fileData("page1.png", "master-1"),
      fileData("page2.png", "master-2"),
      fileData("page3.png", "master-3"),
    ])
    await prisma.examPage.update({
      where: { id: pages[1].id },
      data: { pageNumber: 5 },
    })
    await prisma.examPage.update({
      where: { id: pages[2].id },
      data: { pageNumber: 9 },
    })

    const result = await moveExamPage(pages[0].id, "right")

    expect(result.moved).toBe(true)
    const after = await pagesInOrder(exam.id)
    expect(after.map((page) => page.id)).toEqual([
      pages[1].id,
      pages[0].id,
      pages[2].id,
    ])
    expect(after.map((page) => page.pageNumber)).toEqual([1, 2, 3])
  })

  it("動いていないページの番号は書き換えない", async () => {
    const exam = await prisma.exam.create({
      data: { examName: "差分だけ書く" },
    })
    const pages = await uploadMasterAnswers(exam.id, [
      fileData("page1.png", "master-1"),
      fileData("page2.png", "master-2"),
      fileData("page3.png", "master-3"),
    ])
    const before = await pagesInOrder(exam.id)

    // 前2枚を入れ替える。3枚目は位置が変わらないので触られない
    await moveExamPage(pages[0].id, "right")

    const after = await pagesInOrder(exam.id)
    const untouched = after.find((page) => page.id === pages[2].id)!
    const original = before.find((page) => page.id === pages[2].id)!
    expect(untouched.updatedAt).toEqual(original.updatedAt)
  })

  it("他の教員が別のページを動かしていても、その結果を踏み潰さない", async () => {
    // 一覧を丸ごと送っていた頃は、手元が古いまま並び替えると相手の移動ごと
    // 上書きしていた。入れ替えは動かす2枚にしか触らない
    const exam = await prisma.exam.create({ data: { examName: "同時移動" } })
    const pages = await uploadMasterAnswers(exam.id, [
      fileData("page1.png", "master-1"),
      fileData("page2.png", "master-2"),
      fileData("page3.png", "master-3"),
      fileData("page4.png", "master-4"),
    ])

    // 別の教員が後ろ2枚を入れ替えた後で、こちらが前2枚を入れ替える
    await moveExamPage(pages[2].id, "right")
    await moveExamPage(pages[0].id, "right")

    expect(await pageIdsInOrder(exam.id)).toEqual([
      pages[1].id,
      pages[0].id,
      pages[3].id,
      pages[2].id,
    ])
  })
})
