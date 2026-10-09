/**
 * 重なった助言の決まりと、項目の助言から作る朱書きの main 側（docs/vlm-grading-design.md §4-7・§5-2）。
 *
 * - 決まりの保存は、同じ項目の集合の決まりがあれば書き換え、同期で重なったものは1つにまとめる
 * - 決まりの中身（項目の数・扱い・一文・採る項目）は検証し、外れたものは書かない
 * - 項目を消すと、その項目を含む決まりも消える（残りの項目が2つ以上でも）
 * - 朱書きの差分の書き込みは、印（isRubricAdvice）の付いた朱書きにしか触らない
 * - 材料は、適用か助言の朱書きのある全採点者の採点行を、助言の朱書きだけ同梱して返す
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
  deleteRubricAdviceCombination,
  getRubricAdviceSource,
  listRubricAdviceCombinations,
  saveRubricAdviceCombination,
  syncRubricAdviceAnnotations,
} from "@/electron-src/lib/prisma/rubricAdvice"
import { setRubricApplications } from "@/electron-src/lib/prisma/rubricApplication"
import {
  createRubricItem,
  deleteRubricItem,
} from "@/electron-src/lib/prisma/rubricItem"
import { newDrawingAnnotation } from "@/types/drawingAnnotation.types"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

let fixture: Awaited<ReturnType<typeof createFullTestExam>>

beforeEach(async () => {
  await cleanupTestDatabase()
  fixture = await createFullTestExam(testPrisma, {
    pageCount: 1,
    cropRegionsPerPage: 1,
    studentCount: 2,
    includeScores: false,
  })
})

afterAll(async () => {
  await disconnectTestPrisma()
  await testPrisma.$disconnect()
})

const cropRegionId = () => fixture.cropRegions[0].id
const ownerId = () => fixture.user.id
const examStudentId = (index: number) => fixture.examStudents[index].id

const createAdviceItem = (label: string, adviceText: string, sortOrder = 0) =>
  createRubricItem(
    {
      cropRegionId: cropRegionId(),
      label,
      adviceText,
      sortOrder,
      effectKind: "adjust",
      pointDelta: -1,
      setStatus: null,
      setScore: null,
    },
    ownerId()
  )

/** 3つの項目（すべて助言あり） */
async function createThreeItems() {
  const unit = await createAdviceItem("単位が無い", "単位を書こう", 0)
  const sign = await createAdviceItem("符号の誤り", "移項の符号を見直そう", 1)
  const process = await createAdviceItem("途中式が無い", "途中式を書こう", 2)
  return { unit, sign, process }
}

const saveAll = (rubricItemIds: string[]) =>
  saveRubricAdviceCombination(
    {
      cropRegionId: cropRegionId(),
      rubricItemIds,
      mode: "all",
      mergedText: "",
      primaryRubricItemId: null,
    },
    ownerId()
  )

describe("重なった助言の決まり", () => {
  it("作って、同じ項目の集合なら（並びが違っても）書き換える", async () => {
    const { unit, sign } = await createThreeItems()
    const created = await saveAll([unit.id, sign.id])
    expect(created.mode).toBe("all")
    expect(created.items.map((item) => item.rubricItemId).sort()).toEqual(
      [unit.id, sign.id].sort()
    )

    const updated = await saveRubricAdviceCombination(
      {
        cropRegionId: cropRegionId(),
        rubricItemIds: [sign.id, unit.id],
        mode: "merged",
        mergedText: " 符号と単位を見直そう ",
        primaryRubricItemId: unit.id,
      },
      ownerId()
    )
    expect(updated.id).toBe(created.id)
    expect(updated).toMatchObject({
      mode: "merged",
      mergedText: "符号と単位を見直そう",
      // merged のときは採る項目を持たない
      primaryRubricItemId: null,
    })
    expect(await listRubricAdviceCombinations(cropRegionId())).toHaveLength(1)

    const auditLogs = await testPrisma.auditLog.findMany({
      where: { action: "exam.rubric_advice.save" },
    })
    expect(auditLogs).toHaveLength(2)
  })

  it("同期で同じ集合の決まりが2つできていたら、保存のときに1つへまとめる", async () => {
    const { unit, sign } = await createThreeItems()
    // 別の端末で作られた、同じ集合の決まり（id だけが違う）
    for (const mode of ["all", "none"]) {
      await testPrisma.rubricAdviceCombination.create({
        data: {
          cropRegionId: cropRegionId(),
          mode,
          items: {
            create: [{ rubricItemId: unit.id }, { rubricItemId: sign.id }],
          },
        },
      })
    }
    await saveRubricAdviceCombination(
      {
        cropRegionId: cropRegionId(),
        rubricItemIds: [unit.id, sign.id],
        mode: "single",
        mergedText: "",
        primaryRubricItemId: sign.id,
      },
      ownerId()
    )
    const combinations = await listRubricAdviceCombinations(cropRegionId())
    expect(combinations).toHaveLength(1)
    expect(combinations[0]).toMatchObject({
      mode: "single",
      primaryRubricItemId: sign.id,
    })
  })

  it("中身の外れた決まりは書かない", async () => {
    const { unit, sign, process } = await createThreeItems()
    const save = (
      overrides: Partial<Parameters<typeof saveRubricAdviceCombination>[0]>
    ) =>
      saveRubricAdviceCombination(
        {
          cropRegionId: cropRegionId(),
          rubricItemIds: [unit.id, sign.id],
          mode: "all",
          mergedText: "",
          primaryRubricItemId: null,
          ...overrides,
        },
        ownerId()
      )
    await expect(save({ rubricItemIds: [unit.id, unit.id] })).rejects.toThrow(
      "2つ以上"
    )
    await expect(save({ mode: "scale" })).rejects.toThrow("使えません")
    await expect(save({ mode: "merged", mergedText: "  " })).rejects.toThrow(
      "空です"
    )
    await expect(
      save({ mode: "single", primaryRubricItemId: process.id })
    ).rejects.toThrow("組み合わせの中にありません")
    await expect(
      save({ rubricItemIds: [unit.id, crypto.randomUUID()] })
    ).rejects.toThrow("この設問のものではありません")
    expect(await listRubricAdviceCombinations(cropRegionId())).toHaveLength(0)
  })

  it("決まりを消すと未決定に戻る", async () => {
    const { unit, sign } = await createThreeItems()
    const created = await saveAll([unit.id, sign.id])
    await deleteRubricAdviceCombination(created.id, ownerId())
    expect(await listRubricAdviceCombinations(cropRegionId())).toHaveLength(0)
    expect(
      await testPrisma.auditLog.count({
        where: { action: "exam.rubric_advice.delete" },
      })
    ).toBe(1)
  })

  it("項目を消すと、その項目を含む決まりは（残りが2つ以上でも）消え、含まない決まりは残る", async () => {
    const { unit, sign, process } = await createThreeItems()
    await saveAll([unit.id, sign.id, process.id])
    const kept = await saveAll([unit.id, sign.id])
    await saveAll([sign.id, process.id])

    await deleteRubricItem(process.id, ownerId())

    const combinations = await listRubricAdviceCombinations(cropRegionId())
    expect(combinations.map((combination) => combination.id)).toEqual([kept.id])
    expect(
      await testPrisma.rubricAdviceCombinationItem.count({
        where: { rubricItemId: process.id },
      })
    ).toBe(0)
  })
})

describe("助言の朱書き", () => {
  /** 自分の採点行に項目を当て、その行を返す */
  async function applyItem(rubricItemId: string, studentIndex = 0) {
    const [row] = await setRubricApplications(
      {
        cropRegionId: cropRegionId(),
        rubricItemId,
        examStudentIds: [examStudentId(studentIndex)],
        applied: true,
      },
      ownerId()
    )
    return row
  }

  const handWrittenAnnotation = (questionScoreId: string) =>
    testPrisma.drawingAnnotation.create({
      data: {
        ...newDrawingAnnotation({
          type: "text",
          x: 0.2,
          y: 0.2,
          text: "手で書いた注釈",
        }),
        questionScoreId,
      },
    })

  it("材料は、適用か助言の朱書きのある採点行を、助言の朱書きだけ同梱して返す", async () => {
    const { unit } = await createThreeItems()
    const row = await applyItem(unit.id)
    await handWrittenAnnotation(row.id)
    await syncRubricAdviceAnnotations(
      {
        cropRegionId: cropRegionId(),
        creates: [
          {
            questionScoreId: row.id,
            annotation: newDrawingAnnotation({
              type: "text",
              x: 0.3,
              y: 0.3,
              text: "単位を書こう",
            }),
          },
        ],
        updates: [],
        deletes: [],
      },
      ownerId()
    )

    const source = await getRubricAdviceSource(cropRegionId())
    expect(source?.rubricItems.map((rubricItem) => rubricItem.id)).toContain(
      unit.id
    )
    // Decimal は数で返る
    expect(typeof source?.rubricItems[0].pointDelta).toBe("number")
    expect(source?.questionScores).toHaveLength(1)
    expect(source?.questionScores[0].rubricApplications).toHaveLength(1)
    expect(
      source?.questionScores[0].drawingAnnotations.map(
        (drawingAnnotation) => drawingAnnotation.text
      )
    ).toEqual(["単位を書こう"])
  })

  it("作るときは印を立て、もう助言の朱書きがある行には重ねて作らない", async () => {
    const { unit } = await createThreeItems()
    const row = await applyItem(unit.id)
    const create = () =>
      syncRubricAdviceAnnotations(
        {
          cropRegionId: cropRegionId(),
          creates: [
            {
              questionScoreId: row.id,
              // 印を立て忘れた行が来ても、印を立てて作る
              annotation: newDrawingAnnotation({
                type: "text",
                x: 0.3,
                y: 0.3,
                text: "単位を書こう",
                fontSize: 4.5,
              }),
            },
          ],
          updates: [],
          deletes: [],
        },
        ownerId()
      )
    expect(await create()).toEqual({
      createdCount: 1,
      updatedCount: 0,
      deletedCount: 0,
    })
    expect((await create()).createdCount).toBe(0)

    const annotations = await testPrisma.drawingAnnotation.findMany({
      where: { questionScoreId: row.id },
    })
    expect(annotations).toHaveLength(1)
    expect(annotations[0]).toMatchObject({
      isRubricAdvice: true,
      text: "単位を書こう",
      fontSize: 4.5,
    })
    expect(
      await testPrisma.auditLog.count({
        where: { action: "exam.rubric_advice.sync" },
      })
    ).toBe(1)
  })

  it("書き換え・消しは印の付いた朱書きだけ。手で書いた注釈の id が来ても触らない", async () => {
    const { unit } = await createThreeItems()
    const row = await applyItem(unit.id)
    const handWritten = await handWrittenAnnotation(row.id)
    const advice = await testPrisma.drawingAnnotation.create({
      data: {
        ...newDrawingAnnotation({
          type: "text",
          x: 0.4,
          y: 0.25,
          text: "単位を書こう",
          isRubricAdvice: true,
        }),
        questionScoreId: row.id,
      },
    })

    const updated = await syncRubricAdviceAnnotations(
      {
        cropRegionId: cropRegionId(),
        creates: [],
        updates: [
          { drawingAnnotationId: advice.id, text: "単位を\n忘れずに" },
          { drawingAnnotationId: handWritten.id, text: "書き換えてはいけない" },
        ],
        deletes: [handWritten.id],
      },
      ownerId()
    )
    expect(updated).toEqual({
      createdCount: 0,
      updatedCount: 1,
      deletedCount: 0,
    })
    expect(
      await testPrisma.drawingAnnotation.findUniqueOrThrow({
        where: { id: advice.id },
      })
    ).toMatchObject({ text: "単位を\n忘れずに", x: 0.4, y: 0.25 })
    expect(
      await testPrisma.drawingAnnotation.findUniqueOrThrow({
        where: { id: handWritten.id },
      })
    ).toMatchObject({ text: "手で書いた注釈", isRubricAdvice: false })

    const deleted = await syncRubricAdviceAnnotations(
      {
        cropRegionId: cropRegionId(),
        creates: [],
        updates: [],
        deletes: [advice.id, handWritten.id],
      },
      ownerId()
    )
    expect(deleted.deletedCount).toBe(1)
    expect(
      (
        await testPrisma.drawingAnnotation.findMany({
          where: { questionScoreId: row.id },
        })
      ).map((drawingAnnotation) => drawingAnnotation.id)
    ).toEqual([handWritten.id])
  })

  it("書くものが無ければ監査ログを残さない", async () => {
    await syncRubricAdviceAnnotations(
      { cropRegionId: cropRegionId(), creates: [], updates: [], deletes: [] },
      ownerId()
    )
    expect(
      await testPrisma.auditLog.count({
        where: { action: "exam.rubric_advice.sync" },
      })
    ).toBe(0)
  })
})
