/**
 * OMR設定のアーカイブ往復テスト
 *
 * CropRegionOmrConfig / CropRegionOmrChoiceOption が
 * export → import で正しく保持されることを検証する。
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  cleanupTestDatabase,
  createTestUser,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"

const prisma = getTestPrismaClient()

let userId: string
let examId: string
let examPageId: string

beforeAll(async () => {
  await cleanupTestDatabase()

  const user = await createTestUser()
  userId = user.id

  const exam = await prisma.exam.create({
    data: { examName: "OMR往復テスト試験" },
  })
  examId = exam.id

  await prisma.userExam.create({
    data: { userId: user.id, examId: exam.id, role: "OWNER" },
  })

  const page = await prisma.examPage.create({
    data: { examId: exam.id, pageNumber: 1 },
  })
  examPageId = page.id

  // CropRegion x2 + OMR設定
  const cropRegion1 = await prisma.cropRegion.create({
    data: {
      examPageId: page.id,
      label: "設問1",
      type: "QUESTION_ANSWER",
      x: 0.1,
      y: 0.1,
      width: 0.3,
      height: 0.05,
      points: 5,
      orderIndex: 0,
    },
  })

  // choice OMR設定
  const omrConfig1 = await prisma.cropRegionOmrConfig.create({
    data: {
      cropRegionId: cropRegion1.id,
      type: "choice",
      numChoices: 4,
      choiceLayout: "horizontal",
    },
  })
  await prisma.cropRegionOmrChoiceOption.createMany({
    data: [
      {
        omrConfigId: omrConfig1.id,
        choiceIndex: 0,
        label: "ア",
        isCorrect: true,
      },
      {
        omrConfigId: omrConfig1.id,
        choiceIndex: 1,
        label: "イ",
        isCorrect: false,
      },
      {
        omrConfigId: omrConfig1.id,
        choiceIndex: 2,
        label: "ウ",
        isCorrect: false,
      },
      {
        omrConfigId: omrConfig1.id,
        choiceIndex: 3,
        label: "エ",
        isCorrect: false,
      },
    ],
  })

  const cropRegion2 = await prisma.cropRegion.create({
    data: {
      examPageId: page.id,
      label: "設問2",
      type: "QUESTION_ANSWER",
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.05,
      points: 10,
      orderIndex: 1,
    },
  })

  // 2つ目の choice OMR設定（○×）
  const config2 = await prisma.cropRegionOmrConfig.create({
    data: {
      cropRegionId: cropRegion2.id,
      type: "choice",
      numChoices: 2,
      choiceLayout: "horizontal",
    },
  })
  await prisma.cropRegionOmrChoiceOption.createMany({
    data: [
      { omrConfigId: config2.id, choiceIndex: 0, label: "○", isCorrect: true },
      { omrConfigId: config2.id, choiceIndex: 1, label: "×", isCorrect: false },
    ],
  })
})

afterAll(async () => {
  await cleanupTestDatabase()
  await disconnectTestPrisma()
})

describe("OMR設定の読み書き整合性", () => {
  it("全OMR設定をchoiceOptions付きで取得できる", async () => {
    const configs = await prisma.cropRegionOmrConfig.findMany({
      where: { cropRegion: { examPage: { examId } } },
      include: { choiceOptions: { orderBy: { choiceIndex: "asc" } } },
      orderBy: { cropRegion: { orderIndex: "asc" } },
    })

    expect(configs).toHaveLength(2)

    // orderIndex 0 = choice
    const choiceConfig = configs.find((config) => config.type === "choice")
    expect(choiceConfig).toBeDefined()
    expect(choiceConfig!.numChoices).toBe(4)
    expect(choiceConfig!.choiceLayout).toBe("horizontal")
    expect(choiceConfig!.choiceOptions).toHaveLength(4)
    expect(choiceConfig!.choiceOptions[0].label).toBe("ア")
    expect(choiceConfig!.choiceOptions[0].isCorrect).toBe(true)
    expect(choiceConfig!.choiceOptions[3].label).toBe("エ")
    expect(choiceConfig!.choiceOptions[3].isCorrect).toBe(false)

    // orderIndex 1 = 2つ目の choice
    const secondConfig = configs.find(
      (config) => config.cropRegionId !== choiceConfig!.cropRegionId
    )
    expect(secondConfig).toBeDefined()
    expect(secondConfig!.choiceOptions).toHaveLength(2)
    expect(secondConfig!.choiceOptions[0].label).toBe("○")
  })

  it("アーカイブデータ形式にシリアライズ → DBにリストアできる", async () => {
    // --- Export側: DBからアーカイブ形式に変換 ---
    const configs = await prisma.cropRegionOmrConfig.findMany({
      where: { cropRegion: { examPage: { examId } } },
      include: { choiceOptions: { orderBy: { choiceIndex: "asc" } } },
      orderBy: { cropRegion: { orderIndex: "asc" } },
    })

    const exportedOmrConfigs = configs.map((config) => ({
      id: config.id,
      cropRegionId: config.cropRegionId,
      type: config.type,
      numChoices: config.numChoices,
      choiceLayout: config.choiceLayout,
      colorThreshold: config.colorThreshold,
      areaThreshold: config.areaThreshold,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    }))

    const exportedChoiceOptions = configs.flatMap((config) =>
      config.choiceOptions.map((choiceOption) => ({
        id: choiceOption.id,
        omrConfigId: choiceOption.omrConfigId,
        choiceIndex: choiceOption.choiceIndex,
        label: choiceOption.label,
        isCorrect: choiceOption.isCorrect,
        createdAt: choiceOption.createdAt.toISOString(),
        updatedAt: choiceOption.updatedAt.toISOString(),
      }))
    )

    expect(exportedOmrConfigs).toHaveLength(2)
    // 4択 + ○×の2択
    expect(exportedChoiceOptions).toHaveLength(6)

    // --- Import側: 新しい試験としてリストア ---
    const newExam = await prisma.exam.create({
      data: { examName: "インポートされた試験" },
    })
    await prisma.userExam.create({
      data: { userId, examId: newExam.id, role: "OWNER" },
    })
    const newPage = await prisma.examPage.create({
      data: { examId: newExam.id, pageNumber: 1 },
    })

    // CropRegionを新IDで作成（IDマッピングのシミュレーション）
    const cropRegionIdMap = new Map<string, string>()
    const omrConfigIdMap = new Map<string, string>()

    const originalCropRegions = await prisma.cropRegion.findMany({
      where: { examPageId },
      orderBy: { orderIndex: "asc" },
    })

    for (const originalCropRegion of originalCropRegions) {
      const newCropRegion = await prisma.cropRegion.create({
        data: {
          examPageId: newPage.id,
          label: originalCropRegion.label,
          type: originalCropRegion.type,
          x: originalCropRegion.x,
          y: originalCropRegion.y,
          width: originalCropRegion.width,
          height: originalCropRegion.height,
          points: originalCropRegion.points,
          orderIndex: originalCropRegion.orderIndex,
        },
      })
      cropRegionIdMap.set(originalCropRegion.id, newCropRegion.id)
    }

    // OmrConfig を新IDで作成
    for (const config of exportedOmrConfigs) {
      const newCropRegionId = cropRegionIdMap.get(config.cropRegionId)
      if (!newCropRegionId) continue

      const newConfig = await prisma.cropRegionOmrConfig.create({
        data: {
          cropRegionId: newCropRegionId,
          type: config.type,
          numChoices: config.numChoices,
          choiceLayout: config.choiceLayout,
          colorThreshold: config.colorThreshold,
          areaThreshold: config.areaThreshold,
        },
      })
      omrConfigIdMap.set(config.id, newConfig.id)
    }

    // ChoiceOption を新IDで作成
    for (const choiceOption of exportedChoiceOptions) {
      const newOmrConfigId = omrConfigIdMap.get(choiceOption.omrConfigId)
      if (!newOmrConfigId) continue

      await prisma.cropRegionOmrChoiceOption.create({
        data: {
          omrConfigId: newOmrConfigId,
          choiceIndex: choiceOption.choiceIndex,
          label: choiceOption.label,
          isCorrect: choiceOption.isCorrect,
        },
      })
    }

    // --- 検証: インポートされた試験のOMR設定が元と一致 ---
    const importedConfigs = await prisma.cropRegionOmrConfig.findMany({
      where: { cropRegion: { examPage: { examId: newExam.id } } },
      include: { choiceOptions: { orderBy: { choiceIndex: "asc" } } },
      orderBy: { cropRegion: { orderIndex: "asc" } },
    })

    expect(importedConfigs).toHaveLength(2)

    const importedFour = importedConfigs.find(
      (config) => config.numChoices === 4
    )!
    expect(importedFour.choiceLayout).toBe("horizontal")
    expect(importedFour.choiceOptions).toHaveLength(4)
    expect(importedFour.choiceOptions[0].label).toBe("ア")
    expect(importedFour.choiceOptions[0].isCorrect).toBe(true)

    const importedTwo = importedConfigs.find(
      (config) => config.numChoices === 2
    )!
    expect(importedTwo.choiceOptions).toHaveLength(2)
    expect(importedTwo.choiceOptions[0].label).toBe("○")
  })
})

describe("V1.6.0→V1.7.0 トランスフォーマー", () => {
  it("omrConfigs/omrChoiceOptions が未定義のデータに空配列を追加する", async () => {
    const { V1_6_0_to_V1_7_0_Transformer } =
      await import("../../../electron-src/lib/import/transformers/V1_6_0_to_V1_7_0")

    const transformer = new V1_6_0_to_V1_7_0_Transformer()

    // v1.6.0 形式のデータ（omrConfigs/omrChoiceOptions なし）
    const oldData = {
      manifest: { version: "1.6.0", exportedAt: "", appVersion: "" },
      examData: {
        exam: { id: "test", examName: "test", createdAt: "", updatedAt: "" },
        examPages: [],
        cropRegions: [],
        pageImages: [],
        examStudents: [],
        userExams: [],
        examSubtotalGroups: [],
        masterImages: [],
        studentAnswerImages: [],
      },
      studentsData: { students: [] },
      classesData: { classes: [], memberships: [] },
      usersData: { users: [] },
      subtotalsData: {
        subtotalGroups: [],
        subtotals: [],
        cropSubtotals: [],
      },
      scoresData: { questionScores: [], drawingAnnotations: [] },
    }

    const result = transformer.transform(oldData as never)

    expect(result.data.manifest.version).toBe("1.7.0")
    expect(result.data.examData.omrConfigs).toEqual([])
    expect(result.data.examData.omrChoiceOptions).toEqual([])
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})
