/**
 * CropRegionOmrConfig CRUD 統合テスト
 *
 * 本番の `upsertOmrConfig` / `deleteOmrConfig` / `getOmrConfigsByExamId`
 * （`electron-src/lib/prisma/cropRegionOmrConfig.ts`）をテスト用 DB へ向けて通し、
 * 作成・更新・削除・取得の正確性を検証する。
 *
 * かつてはここに upsert の写しを置いて写しを検査していたが、写しには
 * しきい値とバブル位置の列が無く、本番の書き込みを壊しても緑のままだった。
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"

vi.mock("../../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import {
  deleteOmrConfig,
  getOmrConfigsByExamId,
  upsertOmrConfig,
} from "../../../electron-src/lib/prisma/cropRegionOmrConfig"
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

  // 取得順を確かめるため、作成順と orderIndex の順を逆にする
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
})

afterEach(async () => {
  await prisma.cropRegionOmrChoiceOption.deleteMany()
  await prisma.cropRegionOmrConfig.deleteMany()
})

afterAll(async () => {
  await cleanupTestDatabase()
  await disconnectTestPrisma()
})

/** ○×の2択（○が正解）の選択肢 */
const MARU_BATSU = [
  { choiceIndex: 0, label: "○", isCorrect: true },
  { choiceIndex: 1, label: "×", isCorrect: false },
]

describe("upsertOmrConfig", () => {
  it("choice タイプを、しきい値とバブル位置ごと新規作成する", async () => {
    const config = await upsertOmrConfig({
      cropRegionId: cropRegionId1,
      type: "choice",
      numChoices: 4,
      choiceLayout: "horizontal",
      colorThreshold: 140,
      areaThreshold: 0.35,
      choiceOptions: ["ア", "イ", "ウ", "エ"].map((label, choiceIndex) => ({
        choiceIndex,
        label,
        isCorrect: choiceIndex === 0,
        // 既定の "ellipse" と区別できる値にする（書き損じても既定値で通らないように）
        shape: "rectangle",
        normalizedCx: [0.2, 0.4, 0.6, 0.8][choiceIndex],
        normalizedCy: 0.5,
        normalizedWidth: 0.05,
        normalizedHeight: 0.08,
      })),
    })

    expect(config.cropRegionId).toBe(cropRegionId1)
    expect(config.type).toBe("choice")
    expect(config.numChoices).toBe(4)
    expect(config.choiceLayout).toBe("horizontal")
    expect(config.colorThreshold).toBe(140)
    expect(config.areaThreshold).toBe(0.35)
    expect(config.choiceOptions.map((option) => option.label)).toEqual([
      "ア",
      "イ",
      "ウ",
      "エ",
    ])
    expect(config.choiceOptions.map((option) => option.isCorrect)).toEqual([
      true,
      false,
      false,
      false,
    ])
    expect(config.choiceOptions[2]).toMatchObject({
      shape: "rectangle",
      normalizedCx: 0.6,
      normalizedCy: 0.5,
      normalizedWidth: 0.05,
      normalizedHeight: 0.08,
    })

    // 返り値だけでなく DB に書かれていること
    const stored = await prisma.cropRegionOmrConfig.findUniqueOrThrow({
      where: { cropRegionId: cropRegionId1 },
      include: { choiceOptions: { orderBy: { choiceIndex: "asc" } } },
    })
    expect(stored.areaThreshold).toBe(0.35)
    expect(stored.choiceOptions[3].normalizedCx).toBe(0.8)
  })

  it("既存の設定を更新すると、同じ行のまま列が書き換わり、選択肢は作り直される", async () => {
    const first = await upsertOmrConfig({
      cropRegionId: cropRegionId1,
      type: "choice",
      numChoices: 3,
      colorThreshold: 128,
      areaThreshold: 0.4,
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
      colorThreshold: null,
      areaThreshold: 0.5,
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
    expect(updated.colorThreshold).toBeNull()
    expect(updated.areaThreshold).toBe(0.5)
    expect(updated.choiceOptions.map((option) => option.isCorrect)).toEqual([
      true,
      true,
      false,
      false,
    ])

    // 古い選択肢が残って重複していない
    const options = await prisma.cropRegionOmrChoiceOption.findMany({
      where: { omrConfigId: first.id },
    })
    expect(options).toHaveLength(4)
  })
})

describe("deleteOmrConfig", () => {
  it("OMR設定を消すと、選択肢もカスケードで消え、別の設問の設定は残る", async () => {
    const deleted = await upsertOmrConfig({
      cropRegionId: cropRegionId1,
      type: "choice",
      numChoices: 2,
      choiceOptions: MARU_BATSU,
    })
    await upsertOmrConfig({
      cropRegionId: cropRegionId2,
      type: "choice",
      numChoices: 2,
      choiceOptions: MARU_BATSU,
    })

    await deleteOmrConfig(cropRegionId1)

    expect(
      await prisma.cropRegionOmrConfig.findUnique({
        where: { cropRegionId: cropRegionId1 },
      })
    ).toBeNull()
    expect(
      await prisma.cropRegionOmrChoiceOption.findMany({
        where: { omrConfigId: deleted.id },
      })
    ).toHaveLength(0)
    expect(
      await prisma.cropRegionOmrConfig.findUnique({
        where: { cropRegionId: cropRegionId2 },
      })
    ).not.toBeNull()
  })
})

describe("getOmrConfigsByExamId", () => {
  it("試験の全OMR設定を、設問の並び順・選択肢付きで返す", async () => {
    // 並び順が作成順に引きずられないよう、後ろの設問から作る
    await upsertOmrConfig({
      cropRegionId: cropRegionId2,
      type: "choice",
      numChoices: 2,
      choiceOptions: MARU_BATSU,
    })
    await upsertOmrConfig({
      cropRegionId: cropRegionId1,
      type: "choice",
      numChoices: 4,
      choiceOptions: [
        { choiceIndex: 3, label: "エ", isCorrect: false },
        { choiceIndex: 0, label: "ア", isCorrect: true },
        { choiceIndex: 2, label: "ウ", isCorrect: false },
        { choiceIndex: 1, label: "イ", isCorrect: false },
      ],
    })

    const configs = await getOmrConfigsByExamId(examId)

    expect(configs.map((config) => config.cropRegionId)).toEqual([
      cropRegionId1,
      cropRegionId2,
    ])
    expect(configs[0].choiceOptions.map((option) => option.label)).toEqual([
      "ア",
      "イ",
      "ウ",
      "エ",
    ])
    expect(configs[1].choiceOptions).toHaveLength(2)
  })

  it("別の試験の設定は返さない", async () => {
    await upsertOmrConfig({
      cropRegionId: cropRegionId1,
      type: "choice",
      numChoices: 2,
      choiceOptions: MARU_BATSU,
    })
    const otherExam = await prisma.exam.create({
      data: { examName: "OMR設定の無い試験" },
    })

    expect(await getOmrConfigsByExamId(otherExam.id)).toEqual([])
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

    const config = await upsertOmrConfig({
      cropRegionId: tempRegion.id,
      type: "choice",
      numChoices: 2,
      choiceOptions: MARU_BATSU,
    })

    await prisma.cropRegion.delete({ where: { id: tempRegion.id } })

    expect(
      await prisma.cropRegionOmrConfig.findUnique({
        where: { cropRegionId: tempRegion.id },
      })
    ).toBeNull()
    expect(
      await prisma.cropRegionOmrChoiceOption.findMany({
        where: { omrConfigId: config.id },
      })
    ).toHaveLength(0)
  })
})
