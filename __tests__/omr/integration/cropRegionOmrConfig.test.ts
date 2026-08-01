/**
 * CropRegionOmrConfig CRUD 統合テスト
 *
 * テスト用SQLite DBに対して直接 Prisma 操作を行い、
 * CropRegionOmrConfig / CropRegionOmrChoiceOption の
 * 作成・更新・削除・取得の正確性を検証する。
 *
 * electron-src/lib/prisma/client.ts は Electron依存のため、
 * テスト用PrismaClientを直接使用する。
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import {
  cleanupTestDatabase,
  createTestUser,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"

const prisma = getTestPrismaClient()

let examId: string
let examPageId: string
let cropRegionId1: string
let cropRegionId2: string

beforeAll(async () => {
  await cleanupTestDatabase()

  const user = await createTestUser()

  const exam = await prisma.exam.create({
    data: { examName: "OMR Config テスト試験" },
  })
  examId = exam.id

  await prisma.userExam.create({
    data: { userId: user.id, examId: exam.id, role: "OWNER" },
  })

  const page = await prisma.examPage.create({
    data: { examId: exam.id, pageNumber: 1, imagePath: "" },
  })
  examPageId = page.id

  const cropRegion1 = await prisma.cropRegion.create({
    data: {
      examPageId: page.id,
      label: "問1",
      type: "QUESTION_ANSWER",
      x: 0.1,
      y: 0.1,
      width: 0.3,
      height: 0.05,
      points: 5,
      orderIndex: 0,
    },
  })
  cropRegionId1 = cropRegion1.id

  const cropRegion2 = await prisma.cropRegion.create({
    data: {
      examPageId: page.id,
      label: "問2",
      type: "QUESTION_ANSWER",
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.05,
      points: 10,
      orderIndex: 1,
    },
  })
  cropRegionId2 = cropRegion2.id
})

afterEach(async () => {
  await prisma.cropRegionOmrChoiceOption.deleteMany()
  await prisma.cropRegionOmrConfig.deleteMany()
})

afterAll(async () => {
  await cleanupTestDatabase()
  await disconnectTestPrisma()
})

// ヘルパー: upsertをPrisma直接操作で実装
async function upsertOmrConfig(data: {
  cropRegionId: string
  type: string
  numChoices?: number | null
  choiceLayout?: string | null
  choiceOptions?: Array<{
    choiceIndex: number
    label: string
    isCorrect: boolean
  }>
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.cropRegionOmrConfig.findUnique({
      where: { cropRegionId: data.cropRegionId },
    })

    let configId: string

    if (existing) {
      await tx.cropRegionOmrConfig.update({
        where: { id: existing.id },
        data: {
          type: data.type,
          numChoices: data.numChoices ?? null,
          choiceLayout: data.choiceLayout ?? null,
        },
      })
      await tx.cropRegionOmrChoiceOption.deleteMany({
        where: { omrConfigId: existing.id },
      })
      configId = existing.id
    } else {
      const config = await tx.cropRegionOmrConfig.create({
        data: {
          cropRegionId: data.cropRegionId,
          type: data.type,
          numChoices: data.numChoices ?? null,
          choiceLayout: data.choiceLayout ?? null,
        },
      })
      configId = config.id
    }

    if (data.choiceOptions?.length) {
      await tx.cropRegionOmrChoiceOption.createMany({
        data: data.choiceOptions.map((choiceOption) => ({
          omrConfigId: configId,
          choiceIndex: choiceOption.choiceIndex,
          label: choiceOption.label,
          isCorrect: choiceOption.isCorrect,
        })),
      })
    }

    return tx.cropRegionOmrConfig.findUniqueOrThrow({
      where: { id: configId },
      include: { choiceOptions: { orderBy: { choiceIndex: "asc" } } },
    })
  })
}

describe("CropRegionOmrConfig upsert", () => {
  it("choice タイプの新規作成", async () => {
    const config = await upsertOmrConfig({
      cropRegionId: cropRegionId1,
      type: "choice",
      numChoices: 4,
      choiceLayout: "horizontal",
      choiceOptions: [
        { choiceIndex: 0, label: "ア", isCorrect: true },
        { choiceIndex: 1, label: "イ", isCorrect: false },
        { choiceIndex: 2, label: "ウ", isCorrect: false },
        { choiceIndex: 3, label: "エ", isCorrect: false },
      ],
    })

    expect(config.id).toBeDefined()
    expect(config.cropRegionId).toBe(cropRegionId1)
    expect(config.type).toBe("choice")
    expect(config.numChoices).toBe(4)
    expect(config.choiceLayout).toBe("horizontal")
    expect(config.choiceOptions).toHaveLength(4)
    expect(config.choiceOptions[0].label).toBe("ア")
    expect(config.choiceOptions[0].isCorrect).toBe(true)
    expect(config.choiceOptions[1].isCorrect).toBe(false)
  })

  it("既存のchoice設定を更新（choiceOptionsが再作成される）", async () => {
    const first = await upsertOmrConfig({
      cropRegionId: cropRegionId1,
      type: "choice",
      numChoices: 3,
      choiceOptions: [
        { choiceIndex: 0, label: "A", isCorrect: false },
        { choiceIndex: 1, label: "B", isCorrect: true },
        { choiceIndex: 2, label: "C", isCorrect: false },
      ],
    })

    const updated = await upsertOmrConfig({
      cropRegionId: cropRegionId1,
      type: "choice",
      numChoices: 4,
      choiceLayout: "vertical",
      choiceOptions: [
        { choiceIndex: 0, label: "A", isCorrect: true },
        { choiceIndex: 1, label: "B", isCorrect: true },
        { choiceIndex: 2, label: "C", isCorrect: false },
        { choiceIndex: 3, label: "D", isCorrect: false },
      ],
    })

    expect(updated.id).toBe(first.id)
    expect(updated.numChoices).toBe(4)
    expect(updated.choiceLayout).toBe("vertical")
    expect(updated.choiceOptions).toHaveLength(4)
    expect(updated.choiceOptions[0].isCorrect).toBe(true)
    expect(updated.choiceOptions[1].isCorrect).toBe(true)
  })
})

describe("CropRegionOmrConfig 削除", () => {
  it("OMR設定を削除するとchoiceOptionsもカスケード削除される", async () => {
    const config = await upsertOmrConfig({
      cropRegionId: cropRegionId1,
      type: "choice",
      numChoices: 2,
      choiceOptions: [
        { choiceIndex: 0, label: "○", isCorrect: true },
        { choiceIndex: 1, label: "×", isCorrect: false },
      ],
    })

    await prisma.cropRegionOmrConfig.deleteMany({
      where: { cropRegionId: cropRegionId1 },
    })

    const deleted = await prisma.cropRegionOmrConfig.findUnique({
      where: { cropRegionId: cropRegionId1 },
    })
    expect(deleted).toBeNull()

    const orphanOptions = await prisma.cropRegionOmrChoiceOption.findMany({
      where: { omrConfigId: config.id },
    })
    expect(orphanOptions).toHaveLength(0)
  })
})

describe("試験IDによる取得", () => {
  it("examIdで全OMR設定をchoiceOptions付きで取得", async () => {
    await upsertOmrConfig({
      cropRegionId: cropRegionId1,
      type: "choice",
      numChoices: 4,
      choiceOptions: [
        { choiceIndex: 0, label: "ア", isCorrect: true },
        { choiceIndex: 1, label: "イ", isCorrect: false },
        { choiceIndex: 2, label: "ウ", isCorrect: false },
        { choiceIndex: 3, label: "エ", isCorrect: false },
      ],
    })
    await upsertOmrConfig({
      cropRegionId: cropRegionId2,
      type: "choice",
      numChoices: 2,
      choiceOptions: [
        { choiceIndex: 0, label: "○", isCorrect: true },
        { choiceIndex: 1, label: "×", isCorrect: false },
      ],
    })

    const configs = await prisma.cropRegionOmrConfig.findMany({
      where: { cropRegion: { examPage: { examId } } },
      include: { choiceOptions: { orderBy: { choiceIndex: "asc" } } },
      orderBy: { cropRegion: { orderIndex: "asc" } },
    })

    expect(configs).toHaveLength(2)
    expect(configs[0].choiceOptions).toHaveLength(4)
    expect(configs[1].choiceOptions).toHaveLength(2)
  })

  it("OMR設定がない試験IDでは空配列", async () => {
    const configs = await prisma.cropRegionOmrConfig.findMany({
      where: { cropRegion: { examPage: { examId: "non-existent" } } },
    })
    expect(configs).toHaveLength(0)
  })
})

describe("CropRegion削除時のカスケード", () => {
  it("CropRegionを削除するとOMR設定もカスケード削除される", async () => {
    const tempRegion = await prisma.cropRegion.create({
      data: {
        examPageId: examPageId,
        label: "一時領域",
        type: "QUESTION_ANSWER",
        x: 0.5,
        y: 0.5,
        width: 0.1,
        height: 0.05,
        points: 3,
        orderIndex: 99,
      },
    })

    await upsertOmrConfig({
      cropRegionId: tempRegion.id,
      type: "choice",
      numChoices: 2,
      choiceOptions: [
        { choiceIndex: 0, label: "○", isCorrect: true },
        { choiceIndex: 1, label: "×", isCorrect: false },
      ],
    })

    await prisma.cropRegion.delete({ where: { id: tempRegion.id } })

    const config = await prisma.cropRegionOmrConfig.findUnique({
      where: { cropRegionId: tempRegion.id },
    })
    expect(config).toBeNull()
  })
})
