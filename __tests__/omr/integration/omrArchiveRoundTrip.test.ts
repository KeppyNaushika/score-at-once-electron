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
  const cr1 = await prisma.cropRegion.create({
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
      cropRegionId: cr1.id,
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

  const cr2 = await prisma.cropRegion.create({
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

  // handwritten-digit OMR設定
  await prisma.cropRegionOmrConfig.create({
    data: {
      cropRegionId: cr2.id,
      type: "handwritten-digit",
      numDigits: 3,
      correctAnswer: "256",
    },
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
    const choiceConfig = configs.find((c) => c.type === "choice")
    expect(choiceConfig).toBeDefined()
    expect(choiceConfig!.numChoices).toBe(4)
    expect(choiceConfig!.choiceLayout).toBe("horizontal")
    expect(choiceConfig!.choiceOptions).toHaveLength(4)
    expect(choiceConfig!.choiceOptions[0].label).toBe("ア")
    expect(choiceConfig!.choiceOptions[0].isCorrect).toBe(true)
    expect(choiceConfig!.choiceOptions[3].label).toBe("エ")
    expect(choiceConfig!.choiceOptions[3].isCorrect).toBe(false)

    // orderIndex 1 = handwritten-digit
    const digitConfig = configs.find((c) => c.type === "handwritten-digit")
    expect(digitConfig).toBeDefined()
    expect(digitConfig!.numDigits).toBe(3)
    expect(digitConfig!.correctAnswer).toBe("256")
    expect(digitConfig!.choiceOptions).toHaveLength(0)
  })

  it("アーカイブデータ形式にシリアライズ → DBにリストアできる", async () => {
    // --- Export側: DBからアーカイブ形式に変換 ---
    const configs = await prisma.cropRegionOmrConfig.findMany({
      where: { cropRegion: { examPage: { examId } } },
      include: { choiceOptions: { orderBy: { choiceIndex: "asc" } } },
      orderBy: { cropRegion: { orderIndex: "asc" } },
    })

    const exportedOmrConfigs = configs.map((cfg) => ({
      id: cfg.id,
      cropRegionId: cfg.cropRegionId,
      type: cfg.type,
      numChoices: cfg.numChoices,
      choiceLayout: cfg.choiceLayout,
      numDigits: cfg.numDigits,
      correctAnswer: cfg.correctAnswer,
      colorThreshold: cfg.colorThreshold,
      areaThreshold: cfg.areaThreshold,
      createdAt: cfg.createdAt.toISOString(),
      updatedAt: cfg.updatedAt.toISOString(),
    }))

    const exportedChoiceOptions = configs.flatMap((cfg) =>
      cfg.choiceOptions.map((opt) => ({
        id: opt.id,
        omrConfigId: opt.omrConfigId,
        choiceIndex: opt.choiceIndex,
        label: opt.label,
        isCorrect: opt.isCorrect,
        createdAt: opt.createdAt.toISOString(),
        updatedAt: opt.updatedAt.toISOString(),
      }))
    )

    expect(exportedOmrConfigs).toHaveLength(2)
    expect(exportedChoiceOptions).toHaveLength(4)

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

    for (const origCr of originalCropRegions) {
      const newCr = await prisma.cropRegion.create({
        data: {
          examPageId: newPage.id,
          label: origCr.label,
          type: origCr.type,
          x: origCr.x,
          y: origCr.y,
          width: origCr.width,
          height: origCr.height,
          points: origCr.points,
          orderIndex: origCr.orderIndex,
        },
      })
      cropRegionIdMap.set(origCr.id, newCr.id)
    }

    // OmrConfig を新IDで作成
    for (const cfg of exportedOmrConfigs) {
      const newCropRegionId = cropRegionIdMap.get(cfg.cropRegionId)
      if (!newCropRegionId) continue

      const newCfg = await prisma.cropRegionOmrConfig.create({
        data: {
          cropRegionId: newCropRegionId,
          type: cfg.type,
          numChoices: cfg.numChoices,
          choiceLayout: cfg.choiceLayout,
          numDigits: cfg.numDigits,
          correctAnswer: cfg.correctAnswer,
          colorThreshold: cfg.colorThreshold,
          areaThreshold: cfg.areaThreshold,
        },
      })
      omrConfigIdMap.set(cfg.id, newCfg.id)
    }

    // ChoiceOption を新IDで作成
    for (const opt of exportedChoiceOptions) {
      const newOmrConfigId = omrConfigIdMap.get(opt.omrConfigId)
      if (!newOmrConfigId) continue

      await prisma.cropRegionOmrChoiceOption.create({
        data: {
          omrConfigId: newOmrConfigId,
          choiceIndex: opt.choiceIndex,
          label: opt.label,
          isCorrect: opt.isCorrect,
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

    const importedChoice = importedConfigs.find((c) => c.type === "choice")!
    expect(importedChoice.numChoices).toBe(4)
    expect(importedChoice.choiceLayout).toBe("horizontal")
    expect(importedChoice.choiceOptions).toHaveLength(4)
    expect(importedChoice.choiceOptions[0].label).toBe("ア")
    expect(importedChoice.choiceOptions[0].isCorrect).toBe(true)

    const importedDigit = importedConfigs.find(
      (c) => c.type === "handwritten-digit"
    )!
    expect(importedDigit.numDigits).toBe(3)
    expect(importedDigit.correctAnswer).toBe("256")
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
