/**
 * 小計項目の「採点マークの色」から設問ごとの色を決める（issue #1543）ことの検証
 *
 * 色の決定は renderer（`src/lib/subtotalMarkColor.ts`）が行うが、入力は main が返す試験の
 * 小計点グループ（`getActiveSubtotalGroupsForExam`）そのもの。手で組んだ形では include の
 * 形とずれても気付けないので、DB に行を作って main の関数から取った形で確かめる。
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
  getExamExportSettings,
  setExamSubtotalMarkColorEnabled,
} from "@/electron-src/lib/prisma/examSettings"
import {
  getActiveSubtotalGroupsForExam,
  reorderSubtotalGroups,
} from "@/electron-src/lib/prisma/subtotalGroup"
import {
  buildSubtotalMarkColorByCropRegionId,
  overlaySettingsForCropRegion,
} from "@/lib/subtotalMarkColor"
import { DEFAULT_ANSWER_OVERLAY_SETTINGS } from "@/types/scoringOverlay.types"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

const RED = "#ef4444"
const BLUE = "#2563eb"
const GREEN = "#16a34a"

/** 試験の小計点グループを main から取り、設問ごとの色を決める */
async function markColorsOf(examId: string) {
  return buildSubtotalMarkColorByCropRegionId(
    await getActiveSubtotalGroupsForExam(examId)
  )
}

/** 設問を小計項目に関連付ける */
async function assignQuestion(cropRegionId: string, subtotalId: string) {
  await testPrisma.cropSubtotal.create({
    data: { cropRegionId, subtotalId, assignmentType: "QUESTION_ASSIGNMENT" },
  })
}

/**
 * テスト試験を作る。設問は4つ（問1〜問4）で、小計点グループ1つの「前半」（order 0）と
 * 「後半」（order 1）に交互に関連付いている（問1・問3 → 前半、問2・問4 → 後半）
 */
async function createExamWithSubtotals() {
  const fixture = await createFullTestExam(testPrisma, {})
  const [firstHalf, secondHalf] = fixture.subtotals
  const [question1, question2, question3, question4] = fixture.cropRegions
  return {
    fixture,
    firstHalf,
    secondHalf,
    question1,
    question2,
    question3,
    question4,
  }
}

describe("小計項目の採点マークの色", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("色のある小計項目に関連付けた設問だけに色が付く", async () => {
    const { fixture, firstHalf, question1, question2, question3, question4 } =
      await createExamWithSubtotals()
    await testPrisma.subtotal.update({
      where: { id: firstHalf.id },
      data: { markColor: RED },
    })

    const markColorByCropRegionId = await markColorsOf(fixture.exam.id)

    expect(markColorByCropRegionId.get(question1.id)).toBe(RED)
    expect(markColorByCropRegionId.get(question3.id)).toBe(RED)
    expect(markColorByCropRegionId.has(question2.id)).toBe(false)
    expect(markColorByCropRegionId.has(question4.id)).toBe(false)
  })

  it("同じグループの中では、上にある小計項目の色が勝つ", async () => {
    const { fixture, firstHalf, secondHalf, question2 } =
      await createExamWithSubtotals()
    await testPrisma.subtotal.update({
      where: { id: firstHalf.id },
      data: { markColor: RED },
    })
    await testPrisma.subtotal.update({
      where: { id: secondHalf.id },
      data: { markColor: BLUE },
    })
    // 問2 は後半に加えて前半にも関連付ける
    await assignQuestion(question2.id, firstHalf.id)

    const markColorByCropRegionId = await markColorsOf(fixture.exam.id)

    expect(markColorByCropRegionId.get(question2.id)).toBe(RED)
  })

  it("グループどうしでは、小計点管理で上にあるグループの色が勝つ", async () => {
    const { fixture, firstHalf, question1 } = await createExamWithSubtotals()
    await testPrisma.subtotal.update({
      where: { id: firstHalf.id },
      data: { markColor: RED },
    })
    // 後から作った「観点別」グループの「知識・技能」にも問1を関連付ける
    const viewpointGroup = await testPrisma.subtotalGroup.create({
      data: {
        name: "観点別",
        createdAt: new Date(Date.now() + 60_000),
        subtotals: {
          create: [{ name: "知識・技能", order: 0, markColor: GREEN }],
        },
      },
      include: { subtotals: true },
    })
    await testPrisma.examSubtotalGroup.create({
      data: { examId: fixture.exam.id, subtotalGroupId: viewpointGroup.id },
    })
    await assignQuestion(question1.id, viewpointGroup.subtotals[0].id)

    // 並べ替える前は order がどちらも 0 なので、作った日時の新しい方（観点別）が上
    expect((await markColorsOf(fixture.exam.id)).get(question1.id)).toBe(GREEN)

    // 元のグループを上へ並べ替えると、そちらの色になる
    await reorderSubtotalGroups([fixture.subtotalGroup.id, viewpointGroup.id])
    expect((await markColorsOf(fixture.exam.id)).get(question1.id)).toBe(RED)
  })

  it("色のある小計項目でも、試験で使っていないグループの色は付かない", async () => {
    const { fixture, question1 } = await createExamWithSubtotals()
    const unusedGroup = await testPrisma.subtotalGroup.create({
      data: {
        name: "使っていないグループ",
        subtotals: { create: [{ name: "項目", order: 0, markColor: GREEN }] },
      },
      include: { subtotals: true },
    })
    await assignQuestion(question1.id, unusedGroup.subtotals[0].id)

    expect((await markColorsOf(fixture.exam.id)).has(question1.id)).toBe(false)
  })

  it("試験のスイッチは既定で ON、OFF にすると OFF で読める", async () => {
    const { fixture } = await createExamWithSubtotals()

    const before = await getExamExportSettings(fixture.exam.id)
    expect(before.answerOverlay.subtotalMarkColorEnabled).toBe(true)

    await setExamSubtotalMarkColorEnabled(fixture.exam.id, false)
    const after = await getExamExportSettings(fixture.exam.id)
    expect(after.answerOverlay.subtotalMarkColorEnabled).toBe(false)
  })
})

describe("1設問を描くときの設定", () => {
  const markColorByCropRegionId = new Map([["question-1", BLUE]])

  it("色のある設問は、採点マークと設問の点数だけ色が変わる", () => {
    const settings = overlaySettingsForCropRegion(
      DEFAULT_ANSWER_OVERLAY_SETTINGS,
      markColorByCropRegionId,
      "question-1"
    )

    expect(settings.styles.mark.color).toBe(BLUE)
    expect(settings.styles.partial.color).toBe(BLUE)
    expect(settings.styles.subtotal).toBe(
      DEFAULT_ANSWER_OVERLAY_SETTINGS.styles.subtotal
    )
    expect(settings.styles.total).toBe(
      DEFAULT_ANSWER_OVERLAY_SETTINGS.styles.total
    )
    // 色以外（位置・大きさ・不透明度）は試験の設定のまま
    expect({ ...settings.styles.mark, color: null }).toEqual({
      ...DEFAULT_ANSWER_OVERLAY_SETTINGS.styles.mark,
      color: null,
    })
  })

  it("色の無い設問と、試験のスイッチが OFF のときは試験の設定のまま", () => {
    expect(
      overlaySettingsForCropRegion(
        DEFAULT_ANSWER_OVERLAY_SETTINGS,
        markColorByCropRegionId,
        "question-2"
      )
    ).toBe(DEFAULT_ANSWER_OVERLAY_SETTINGS)

    const switchedOff = {
      ...DEFAULT_ANSWER_OVERLAY_SETTINGS,
      subtotalMarkColorEnabled: false,
    }
    expect(
      overlaySettingsForCropRegion(
        switchedOff,
        markColorByCropRegionId,
        "question-1"
      )
    ).toBe(switchedOff)
  })
})
