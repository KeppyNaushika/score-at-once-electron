/**
 * プロンプトの問題の画像（何枚でも。docs/vlm-grading-design.md §3-1）。
 *
 * - 取り込み：中身を確かめて試験フォルダの ai-question-images に乱数の名前で保存する
 * - 行の作成：プロンプトを作るときに、渡した順のまま画像の行を作る。取り込み先の外は受け付けない
 * - 引き継ぎ：直した版・項目の一覧が変わって作り直した版にも、並び順のまま画像の行を作る
 * - 送信：1段目の固定部に並び順で入り、見積もりの材料にも並び順で出る
 *
 * 画像は合成したもの。外部へは何も送らない（偽の事業者）。
 */

import * as fs from "fs"
import * as path from "path"
import sharp from "sharp"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DB_PATH = path.resolve(__dirname, "../../data/test-database.db")

vi.mock("../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import { createGradingJobRunner } from "@/electron-src/lib/aiGrading/gradingJobRunner"
import { importAiQuestionImage } from "@/electron-src/lib/aiGrading/questionImageImport"
import { measureRunImageSizes } from "@/electron-src/lib/aiGrading/sendingImageInspection"
import {
  createAiPrompt,
  ensurePromptRendersRubricItems,
  getAiPrompt,
} from "@/electron-src/lib/prisma/aiPrompt"

import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../helpers/testPrismaClient"
import {
  completedResponse,
  createAiGradingFixture,
  createFakeProvider,
  createTestDependencies,
  PARTIAL_JUDGEMENT,
} from "./helpers/aiGradingFixture"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

let fixture: Awaited<ReturnType<typeof createAiGradingFixture>>
const dataDirectories: string[] = []

beforeEach(async () => {
  await cleanupTestDatabase()
  fixture = await createAiGradingFixture(testPrisma, { studentCount: 1 })
  dataDirectories.push(fixture.dataDirectory)
})

afterAll(async () => {
  dataDirectories.forEach((dataDirectory) =>
    fs.rmSync(dataDirectory, { recursive: true, force: true })
  )
  await disconnectTestPrisma()
  await testPrisma.$disconnect()
})

/** 単色の画像（色で見分ける） */
const solidImage = (
  width: number,
  height: number,
  color: { r: number; g: number; b: number },
  format: "png" | "jpeg" | "webp" = "png"
) =>
  sharp({ create: { width, height, channels: 3, background: color } })
    .toFormat(format)
    .toBuffer()

const importImage = async (imageBytes: Buffer) =>
  (
    await importAiQuestionImage(
      { cropRegionId: fixture.cropRegion.id, imageBytes },
      fixture.dataDirectory
    )
  ).imagePath

const examId = () => fixture.exam.exam.id

describe("問題の画像の取り込み", () => {
  it("試験フォルダの ai-question-images に乱数の名前で保存し、data からの相対パスを返す", async () => {
    const pngBytes = await solidImage(30, 20, { r: 255, g: 0, b: 0 })
    const imagePath = await importImage(pngBytes)

    expect(imagePath).toMatch(
      new RegExp(`^exams/${examId()}/ai-question-images/[0-9a-f-]{36}\\.png$`)
    )
    const saved = fs.readFileSync(path.join(fixture.dataDirectory, imagePath))
    expect(saved.equals(pngBytes)).toBe(true)
  })

  it("JPEG はそのまま、WebP は PNG にして保存する", async () => {
    const jpegPath = await importImage(
      await solidImage(30, 20, { r: 0, g: 255, b: 0 }, "jpeg")
    )
    expect(jpegPath.endsWith(".jpg")).toBe(true)

    const webpPath = await importImage(
      await solidImage(30, 20, { r: 0, g: 0, b: 255 }, "webp")
    )
    expect(webpPath.endsWith(".png")).toBe(true)
    const metadata = await sharp(
      path.join(fixture.dataDirectory, webpPath)
    ).metadata()
    expect(metadata).toMatchObject({ format: "png", width: 30, height: 20 })
  })

  it("画像でないもの・空のものは受け付けない", async () => {
    await expect(
      importImage(Buffer.from("%PDF-1.7 これは画像ではない"))
    ).rejects.toThrow("画像として読めませんでした")
    await expect(importImage(Buffer.alloc(0))).rejects.toThrow("画像が空です")
  })
})

describe("問題の画像の行", () => {
  it("プロンプトを作るときに、渡した順のまま画像の行を作る", async () => {
    const firstPath = await importImage(
      await solidImage(10, 10, { r: 255, g: 0, b: 0 })
    )
    const secondPath = await importImage(
      await solidImage(10, 10, { r: 0, g: 255, b: 0 })
    )
    const prompt = await createAiPrompt(
      {
        cropRegionId: fixture.cropRegion.id,
        questionImagePaths: [secondPath, firstPath],
      },
      fixture.exam.user.id
    )

    expect(
      prompt.questionImages.map((questionImage) => [
        questionImage.imagePath,
        questionImage.sortOrder,
      ])
    ).toEqual([
      [secondPath, 0],
      [firstPath, 1],
    ])
    // 旧列は書かない
    expect(prompt.questionImagePath).toBeNull()
  })

  it("取り込み先の外を指すパスは受け付けない", async () => {
    for (const outsidePath of [
      `exams/${examId()}/master-answers/page.png`,
      `exams/${examId()}/ai-question-images/../../other/x.png`,
      `exams/other-exam/ai-question-images/x.png`,
    ]) {
      await expect(
        createAiPrompt(
          {
            cropRegionId: fixture.cropRegion.id,
            questionImagePaths: [outsidePath],
          },
          fixture.exam.user.id
        )
      ).rejects.toThrow("この試験で取り込んでいない画像があります")
    }
  })

  it("直した版は、元の版の画像を並べ替え・外し・足して引き継げる（元の版の行は変わらない）", async () => {
    const [firstPath, secondPath, thirdPath] = await Promise.all(
      [0, 1, 2].map(async (shade) =>
        importImage(await solidImage(10, 10, { r: shade, g: 0, b: 0 }))
      )
    )
    // 取り込み先の外にある旧来の画像も、元の版に付いていれば引き継げる
    const legacyPath = `exams/${examId()}/legacy-question.png`
    const basePrompt = await createAiPrompt(
      {
        cropRegionId: fixture.cropRegion.id,
        questionImagePaths: [firstPath, secondPath],
      },
      fixture.exam.user.id
    )
    await testPrisma.aiPromptQuestionImage.create({
      data: { promptId: basePrompt.id, imagePath: legacyPath, sortOrder: 2 },
    })

    const revisedPrompt = await createAiPrompt(
      {
        cropRegionId: fixture.cropRegion.id,
        parentPromptId: basePrompt.id,
        questionImagePaths: [legacyPath, secondPath, thirdPath],
      },
      fixture.exam.user.id
    )

    expect(
      revisedPrompt.questionImages.map(
        (questionImage) => questionImage.imagePath
      )
    ).toEqual([legacyPath, secondPath, thirdPath])
    const reloadedBase = await getAiPrompt(basePrompt.id)
    expect(
      reloadedBase?.questionImages.map(
        (questionImage) => questionImage.imagePath
      )
    ).toEqual([firstPath, secondPath, legacyPath])
  })

  it("項目の一覧が変わって作り直す版にも、画像の行を並び順のまま作る", async () => {
    const [firstPath, secondPath] = await Promise.all(
      [0, 1].map(async (shade) =>
        importImage(await solidImage(10, 10, { r: 0, g: shade, b: 0 }))
      )
    )
    const prompt = await createAiPrompt(
      {
        cropRegionId: fixture.cropRegion.id,
        questionImagePaths: [firstPath, secondPath],
      },
      fixture.exam.user.id
    )
    const recreated = await ensurePromptRendersRubricItems(
      prompt,
      "## ルーブリック項目\n- 変わった一覧",
      fixture.exam.user.id
    )

    expect(recreated.id).not.toBe(prompt.id)
    expect(recreated.parentPromptId).toBe(prompt.id)
    expect(
      recreated.questionImages.map((questionImage) => [
        questionImage.imagePath,
        questionImage.sortOrder,
      ])
    ).toEqual([
      [firstPath, 0],
      [secondPath, 1],
    ])
    expect(
      new Set(
        [...prompt.questionImages, ...recreated.questionImages].map(
          (questionImage) => questionImage.id
        )
      ).size
    ).toBe(4)
  })

  it("プロンプトの行が消えると画像の行も消える", async () => {
    const imagePath = await importImage(
      await solidImage(10, 10, { r: 1, g: 2, b: 3 })
    )
    const prompt = await createAiPrompt(
      { cropRegionId: fixture.cropRegion.id, questionImagePaths: [imagePath] },
      fixture.exam.user.id
    )
    await testPrisma.aiPrompt.delete({ where: { id: prompt.id } })
    expect(
      await testPrisma.aiPromptQuestionImage.count({
        where: { promptId: prompt.id },
      })
    ).toBe(0)
  })
})

describe("問題の画像の送信", () => {
  it("1段目の固定部に並び順で全部入り、見積もりの材料にも並び順で出る", async () => {
    const wideBytes = await solidImage(40, 10, { r: 255, g: 0, b: 0 })
    const tallBytes = await solidImage(10, 40, { r: 0, g: 0, b: 255 }, "jpeg")
    const widePath = await importImage(wideBytes)
    const tallPath = await importImage(tallBytes)
    const prompt = await createAiPrompt(
      {
        cropRegionId: fixture.cropRegion.id,
        questionText: "図を見て答えよ。",
        sendModelAnswerImage: false,
        questionImagePaths: [tallPath, widePath],
      },
      fixture.exam.user.id
    )

    const sizes = await measureRunImageSizes(
      {
        promptId: prompt.id,
        examStudentIds: [fixture.exam.examStudents[0].id],
        imageScale: 1,
      },
      (relativePath) => path.join(fixture.dataDirectory, relativePath)
    )
    expect(sizes.questionImages).toEqual([
      { width: 10, height: 40 },
      { width: 40, height: 10 },
    ])
    expect(sizes.modelAnswerImage).toBeNull()

    const { provider, gradeRequests } = createFakeProvider({
      respond: async () => completedResponse(PARTIAL_JUDGEMENT),
    })
    const runner = createGradingJobRunner(
      createTestDependencies(provider, fixture.dataDirectory)
    )
    const { finished } = await runner.startGradingRun(
      {
        purpose: "grade",
        promptId: prompt.id,
        examStudentIds: [fixture.exam.examStudents[0].id],
        provider: "anthropic",
        model: "claude-test",
        effort: "medium",
        mode: "realtime",
        imageScale: 1,
      },
      fixture.exam.user.id
    )
    await finished

    expect(gradeRequests).toHaveLength(1)
    const fixedImages = gradeRequests[0].fixedParts.flatMap((part) =>
      part.kind === "image" ? [part] : []
    )
    expect(fixedImages).toEqual([
      {
        kind: "image",
        mediaType: "image/jpeg",
        base64Data: tallBytes.toString("base64"),
      },
      {
        kind: "image",
        mediaType: "image/png",
        base64Data: wideBytes.toString("base64"),
      },
    ])
    // 答案の画像は可変部にだけある
    expect(
      gradeRequests[0].variableParts.filter((part) => part.kind === "image")
    ).toHaveLength(1)
  })
})
