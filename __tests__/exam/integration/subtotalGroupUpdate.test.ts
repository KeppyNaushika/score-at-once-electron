/**
 * 小計点グループの更新が「差分だけを書く」ことの検証（docs/remaining-work.md 段階23）
 *
 * かつては更新のたびに小計項目を `deleteMany` して配列ごと作り直していたため、
 * **グループ名を1文字直して保存するだけで全ての `Subtotal` の id が振り直され**、
 * カスケードでその子が消えていた —— 04 で設定した設問の割り当て（`CropSubtotal`）と、
 * その小計を参照する成績のデータソース（`GradeDataSource`）である。id が変わるので
 * 割り当て直しても元には戻らず、同期にも毎回 tombstone と新しい id が流れていた。
 *
 * ここでは「残る項目は id ごと残り、外れた項目だけが消える」ことを固定する。
 *
 * **id を見るだけでは関門にならない。** 消して作り直す実装でも、この検査が渡す id を
 * そのまま `create` へ載せてしまえば id は同じに見える。行が作り直されていないことは
 * 作成日時（と、触っていない行の更新日時）で確かめる。
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
  createSubtotalGroup,
  updateSubtotalGroup,
} from "@/electron-src/lib/prisma/subtotalGroup"

import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/** 小計点グループ（項目3つ）を作る */
async function createTestSubtotalGroup() {
  return await createSubtotalGroup({
    name: "国語小計",
    subtotals: [
      { name: "漢字", order: 0 },
      { name: "読解", order: 1 },
      { name: "作文", order: 2 },
    ],
  })
}

/** 設問（採点領域）を1つ作り、その小計への割り当てを付ける */
async function assignCropRegionToSubtotal(subtotalId: string) {
  const exam = await testPrisma.exam.create({
    data: { examName: "テスト試験", referenceDate: new Date("2024-04-10") },
  })
  const examPage = await testPrisma.examPage.create({
    data: { examId: exam.id, pageNumber: 1 },
  })
  const cropRegion = await testPrisma.cropRegion.create({
    data: {
      examPageId: examPage.id,
      label: "大問1",
      type: "question",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      points: 10,
      orderIndex: 0,
    },
  })
  return await testPrisma.cropSubtotal.create({
    data: {
      cropRegionId: cropRegion.id,
      subtotalId,
      assignmentType: "add",
    },
  })
}

/** その小計を参照する成績のデータソースを1つ作る */
async function createGradeDataSourceForSubtotal(subtotalId: string) {
  const grade = await testPrisma.grade.create({ data: { name: "1学期" } })
  const gradeItem = await testPrisma.gradeItem.create({
    data: { gradeId: grade.id, name: "知識・技能", order: 0 },
  })
  return await testPrisma.gradeDataSource.create({
    data: {
      gradeItemId: gradeItem.id,
      type: "subtotal",
      subtotalId,
      name: "国語小計/漢字",
      weight: 1,
      order: 0,
    },
  })
}

describe("小計点グループの更新", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("グループ名を変えても、設問の割り当てが残る", async () => {
    const subtotalGroup = await createTestSubtotalGroup()
    const cropSubtotal = await assignCropRegionToSubtotal(
      subtotalGroup.subtotals[0].id
    )

    await updateSubtotalGroup(subtotalGroup.id, {
      name: "国語小計（改）",
      subtotals: subtotalGroup.subtotals.map((subtotal) => ({
        id: subtotal.id,
        name: subtotal.name,
        order: subtotal.order,
      })),
    })

    const afterCropSubtotal = await testPrisma.cropSubtotal.findUnique({
      where: { id: cropSubtotal.id },
    })
    expect(afterCropSubtotal).not.toBeNull()
    expect(afterCropSubtotal?.subtotalId).toBe(subtotalGroup.subtotals[0].id)

    // 小計項目そのものも作り直されていない
    const afterSubtotals = await testPrisma.subtotal.findMany({
      where: { subtotalGroupId: subtotalGroup.id },
      orderBy: { order: "asc" },
    })
    expect(afterSubtotals.map((subtotal) => subtotal.id)).toEqual(
      subtotalGroup.subtotals.map((subtotal) => subtotal.id)
    )
  })

  it("グループ名を変えても、その小計を参照する成績のデータソースが残る", async () => {
    const subtotalGroup = await createTestSubtotalGroup()
    const gradeDataSource = await createGradeDataSourceForSubtotal(
      subtotalGroup.subtotals[0].id
    )

    await updateSubtotalGroup(subtotalGroup.id, {
      name: "国語小計（改）",
      subtotals: subtotalGroup.subtotals.map((subtotal) => ({
        id: subtotal.id,
        name: subtotal.name,
        order: subtotal.order,
      })),
    })

    const afterGradeDataSource = await testPrisma.gradeDataSource.findUnique({
      where: { id: gradeDataSource.id },
    })
    expect(afterGradeDataSource).not.toBeNull()
    expect(afterGradeDataSource?.subtotalId).toBe(subtotalGroup.subtotals[0].id)
  })

  it("小計項目を1つ消しても、残った項目の id が変わらない", async () => {
    const subtotalGroup = await createTestSubtotalGroup()
    const [kanji, dokkai, sakubun] = subtotalGroup.subtotals

    const updated = await updateSubtotalGroup(subtotalGroup.id, {
      name: subtotalGroup.name,
      subtotals: [
        { id: kanji.id, name: kanji.name, order: 0 },
        { id: sakubun.id, name: sakubun.name, order: 1 },
      ],
    })

    expect(updated.subtotals.map((subtotal) => subtotal.id)).toEqual([
      kanji.id,
      sakubun.id,
    ])
    expect(
      await testPrisma.subtotal.findUnique({ where: { id: dokkai.id } })
    ).toBeNull()
    // 残った項目は作り直されていない（作成日時も動かない）
    const keptKanji = await testPrisma.subtotal.findUniqueOrThrow({
      where: { id: kanji.id },
    })
    expect(keptKanji.createdAt.toISOString()).toBe(
      kanji.createdAt.toISOString()
    )
  })

  it("小計項目を並べ替えても、id が変わらない", async () => {
    const subtotalGroup = await createTestSubtotalGroup()
    const [kanji, dokkai, sakubun] = subtotalGroup.subtotals

    const updated = await updateSubtotalGroup(subtotalGroup.id, {
      name: subtotalGroup.name,
      subtotals: [
        { id: sakubun.id, name: sakubun.name, order: 0 },
        { id: kanji.id, name: kanji.name, order: 1 },
        { id: dokkai.id, name: dokkai.name, order: 2 },
      ],
    })

    expect(updated.subtotals.map((subtotal) => subtotal.id)).toEqual([
      sakubun.id,
      kanji.id,
      dokkai.id,
    ])
    expect(updated.subtotals.map((subtotal) => subtotal.name)).toEqual([
      "作文",
      "漢字",
      "読解",
    ])
    // 並べ替えは order を書き換えるだけで、行そのものは作り直されない
    for (const subtotal of subtotalGroup.subtotals) {
      const afterSubtotal = await testPrisma.subtotal.findUniqueOrThrow({
        where: { id: subtotal.id },
      })
      expect(afterSubtotal.createdAt.toISOString()).toBe(
        subtotal.createdAt.toISOString()
      )
    }
  })

  it("項目を1つ足しても、既にある項目は書き換わらない", async () => {
    const subtotalGroup = await createTestSubtotalGroup()

    const updated = await updateSubtotalGroup(subtotalGroup.id, {
      name: subtotalGroup.name,
      subtotals: [
        ...subtotalGroup.subtotals.map((subtotal) => ({
          id: subtotal.id,
          name: subtotal.name,
          order: subtotal.order,
        })),
        { id: null, name: "書写", order: 3 },
      ],
    })

    expect(updated.subtotals).toHaveLength(4)
    // 既にある3つは id ごと残り、更新日時も動かない
    for (const subtotal of subtotalGroup.subtotals) {
      const afterSubtotal = await testPrisma.subtotal.findUniqueOrThrow({
        where: { id: subtotal.id },
      })
      expect(afterSubtotal.updatedAt.toISOString()).toBe(
        subtotal.updatedAt.toISOString()
      )
    }
    // 足した項目の id は DB が振る（画面が渡した値ではない）
    const addedSubtotal = updated.subtotals[3]
    expect(addedSubtotal.name).toBe("書写")
    expect(addedSubtotal.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })

  it("何も変えずに保存すると、1行も書き換わらない", async () => {
    const subtotalGroup = await createTestSubtotalGroup()

    await updateSubtotalGroup(subtotalGroup.id, {
      name: subtotalGroup.name,
      subtotals: subtotalGroup.subtotals.map((subtotal) => ({
        id: subtotal.id,
        name: subtotal.name,
        order: subtotal.order,
      })),
    })

    const afterGroup = await testPrisma.subtotalGroup.findUniqueOrThrow({
      where: { id: subtotalGroup.id },
    })
    expect(afterGroup.updatedAt.toISOString()).toBe(
      subtotalGroup.updatedAt.toISOString()
    )
    for (const subtotal of subtotalGroup.subtotals) {
      const afterSubtotal = await testPrisma.subtotal.findUniqueOrThrow({
        where: { id: subtotal.id },
      })
      expect(afterSubtotal.updatedAt.toISOString()).toBe(
        subtotal.updatedAt.toISOString()
      )
    }
  })
})
