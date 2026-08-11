/**
 * omr:detect-master-markers ハンドラの統合テスト
 *
 * 模範解答画像を ExamPage へ畳んだ際、旧実装の `if (!masterImage)` を機械的に
 * `if (!examPage)` へ置き換えた結果その条件が成立しなくなり、画像を持たないページで
 * `path.join(dataDir, "")` がデータディレクトリを sharp へ渡して**試験全体の検出が
 * 落ちる**不具合を作った（正常なページの結果ごと破棄されていた）。
 *
 * `imagePath` を nullable にしたので「ガードを外すとコンパイルが通らない」形にはなったが、
 * 「画像を持つページが1枚も無ければエラーを返す」という判断は型では守れない。
 * そこはハンドラ自身が持つ分岐なので、ここで実行時に確かめる。
 */
import * as fsPromises from "fs/promises"
import * as os from "os"
import * as path from "path"
import sharp from "sharp"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DATA_DIR = path.join(os.tmpdir(), "score-at-once-omr-master-markers")
process.env.SCORE_AT_ONCE_DATA_DIR = TEST_DATA_DIR

vi.mock("../../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import { omrHandlers } from "@/electron-src/ipc-handlers/omrHandlers"
import { getAbsolutePathFromData } from "@/electron-src/lib/dataManager"

import { captureIpcHandler } from "../../helpers/ipcHandlerHarness"
import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"

const prisma = getTestPrismaClient()

interface DetectResult {
  pages: Array<{ examPageId: string; pageNumber: number }>
}

const detectMasterMarkers = () =>
  captureIpcHandler(omrHandlers, "omr:detect-master-markers")

/** 白紙PNGを置き、data からの相対パスを返す（マーカーは無いので検出は失敗する） */
async function writeBlankPng(relativePath: string): Promise<string> {
  const absolutePath = getAbsolutePathFromData(relativePath)
  await fsPromises.mkdir(path.dirname(absolutePath), { recursive: true })
  await sharp({
    create: {
      width: 200,
      height: 280,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .png()
    .toFile(absolutePath)
  return relativePath
}

beforeEach(async () => {
  await cleanupTestDatabase()
  await fsPromises.rm(TEST_DATA_DIR, { recursive: true, force: true })
})

afterAll(async () => {
  await fsPromises.rm(TEST_DATA_DIR, { recursive: true, force: true })
  await disconnectTestPrisma()
})

describe("omr:detect-master-markers", () => {
  it("画像を持たないページを飛ばし、持つページの検出は行う", async () => {
    const exam = await prisma.exam.create({
      data: { examName: "マーカー検出" },
    })
    const withImage = await prisma.examPage.create({
      data: {
        examId: exam.id,
        pageNumber: 1,
        imagePath: await writeBlankPng(
          `exams/${exam.id}/master-images/page1.png`
        ),
      },
    })
    await prisma.examPage.create({
      data: { examId: exam.id, pageNumber: 2, imagePath: null },
    })

    const result = (await detectMasterMarkers()(exam.id)) as DetectResult

    // 画像の無いページで例外が出ると、この1件も含めて結果が丸ごと失われる
    expect(result.pages.map((page) => page.examPageId)).toEqual([withImage.id])
  })

  it("画像を持つページが1枚も無ければ例外を投げる", async () => {
    const exam = await prisma.exam.create({ data: { examName: "画像なし" } })
    await prisma.examPage.create({
      data: { examId: exam.id, pageNumber: 1, imagePath: null },
    })

    // ページ数ではなく検出対象の数で判定する。ページはあるが画像が無い状態を
    // 「検出0件で成功」にしてしまうと、UI が沈黙して原因が分からなくなる
    await expect(detectMasterMarkers()(exam.id)).rejects.toThrow(
      "マスター画像が見つかりません"
    )
  })

  it("ページが1枚も無ければ例外を投げる", async () => {
    const exam = await prisma.exam.create({ data: { examName: "ページなし" } })

    await expect(detectMasterMarkers()(exam.id)).rejects.toThrow(
      "マスター画像が見つかりません"
    )
  })
})
