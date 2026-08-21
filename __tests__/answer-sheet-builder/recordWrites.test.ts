/**
 * 1レコードずつの書き込み（実体 × 操作）の検証。
 *
 * 解答用紙の編集は「木をまるごと保存する」から「触ったレコードを1本書く」へ割った。
 * ここで固定するのは、割ったことで守られるはずの性質:
 *
 * - **触っていない行を書かない**（同期は行ごとの LWW なので、書けば相手の編集を倒す）
 * - **並びに穴が空かない**（消したら詰める。位置を決めるのは main）
 * - **子を書いたら解答用紙の更新日時は進む**（一覧の並べ替えと期間の絞り込みが狂う）
 * - **担当でなければ書けない**（判定の出所は認証ストア。renderer が渡す id ではない）
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("electron", () => ({
  app: {
    getVersion: () => "test",
    getAppPath: () => process.cwd(),
  },
}))

vi.mock("../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

vi.mock("../../electron-src/lib/dataManager", () => ({
  getDataDirectory: () => "/tmp/test-data",
}))

/** ログインしている利用者（担当かどうかの判定は main がこれで行う） */
const actor = vi.hoisted(() => ({ userId: null as string | null }))
vi.mock("../../electron-src/lib/prisma/auditActor", () => ({
  getCurrentActorUserId: () => actor.userId,
}))

import { replaceAsbDefinition } from "../../electron-src/lib/prisma/asbDefinitionReplace"
import {
  createAsbMajorQuestion,
  deleteAsbMajorQuestion,
  reorderAsbMajorQuestions,
  updateAsbMajorQuestion,
} from "../../electron-src/lib/prisma/asbMajorQuestion"
import { upsertAsbManuscriptPaper } from "../../electron-src/lib/prisma/asbManuscriptPaper"
import {
  createAsbSubQuestion,
  updateAsbSubQuestion,
} from "../../electron-src/lib/prisma/asbSubQuestion"
import {
  createDefaultDefinition,
  createDefaultMajorQuestion,
  createDefaultSubQuestion,
} from "../../src/components/answer-sheet-builder/constants"
import type { AnswerSheetDefinition } from "../../src/types/answerSheetDefinition.types"
import {
  cleanupTestDatabase,
  createTestUser,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../helpers/testPrismaClient"

const prisma = getTestPrismaClient()

let ownerId: string
let otherUserId: string

beforeAll(async () => {
  await cleanupTestDatabase()
  ownerId = (await createTestUser()).id
  otherUserId = (await createTestUser({ username: "other" })).id
  actor.userId = ownerId
})

afterAll(async () => {
  await disconnectTestPrisma()
})

/** 大問3つ（それぞれ小問1つ）の解答用紙を DB に置く */
async function givenThreeMajorQuestions(): Promise<AnswerSheetDefinition> {
  const base = createDefaultDefinition()
  const definition: AnswerSheetDefinition = {
    ...base,
    majorQuestions: [
      createDefaultMajorQuestion("1"),
      createDefaultMajorQuestion("2"),
      createDefaultMajorQuestion("3"),
    ],
  }
  await replaceAsbDefinition(definition, ownerId)
  return definition
}

async function majorQuestionRows(definitionId: string) {
  return prisma.asbMajorQuestion.findMany({
    where: { definitionId },
    orderBy: { order: "asc" },
  })
}

describe("実体ごとの書き込み", () => {
  it("足した大問は末尾に付く（位置を決めるのは main）", async () => {
    const definition = await givenThreeMajorQuestions()
    const added = createDefaultMajorQuestion("4")

    await createAsbMajorQuestion(definition.id, added)

    const rows = await majorQuestionRows(definition.id)
    expect(rows.map((row) => row.label)).toEqual(["1", "2", "3", "4"])
    expect(rows.map((row) => row.order)).toEqual([0, 1, 2, 3])
    // 連れてきた小問も同じ書き込みで入る（小問の無い大問を残さない）
    const subQuestions = await prisma.asbSubQuestion.findMany({
      where: { majorQuestionId: added.id },
    })
    expect(subQuestions).toHaveLength(1)
  })

  it("属性の更新は対象行だけを書く", async () => {
    const definition = await givenThreeMajorQuestions()
    const before = await majorQuestionRows(definition.id)

    await updateAsbMajorQuestion(definition.id, before[1].id, {
      label: "第2問",
    })

    const after = await majorQuestionRows(definition.id)
    expect(after[1].label).toBe("第2問")
    // 触っていない行は書き込みが起きていない
    expect(after[0].updatedAt.toISOString()).toBe(
      before[0].updatedAt.toISOString()
    )
    expect(after[2].updatedAt.toISOString()).toBe(
      before[2].updatedAt.toISOString()
    )
  })

  it("同じ値で更新しても書かない", async () => {
    const definition = await givenThreeMajorQuestions()
    const before = await majorQuestionRows(definition.id)

    await updateAsbMajorQuestion(definition.id, before[0].id, {
      label: before[0].label,
    })

    const after = await majorQuestionRows(definition.id)
    expect(after[0].updatedAt.toISOString()).toBe(
      before[0].updatedAt.toISOString()
    )
  })

  it("消すと、残りの並びが詰まる（穴が空かない）", async () => {
    const definition = await givenThreeMajorQuestions()
    const before = await majorQuestionRows(definition.id)

    await deleteAsbMajorQuestion(definition.id, before[0].id)

    const after = await majorQuestionRows(definition.id)
    expect(after.map((row) => row.label)).toEqual(["2", "3"])
    expect(after.map((row) => row.order)).toEqual([0, 1])
  })

  it("並べ替えは渡した id の並びのとおりで、動かない行は書かない", async () => {
    const definition = await givenThreeMajorQuestions()
    const before = await majorQuestionRows(definition.id)

    // 先頭2つを入れ替える。3つ目は位置が変わらない
    await reorderAsbMajorQuestions(definition.id, [
      before[1].id,
      before[0].id,
      before[2].id,
    ])

    const after = await majorQuestionRows(definition.id)
    expect(after.map((row) => row.label)).toEqual(["2", "1", "3"])
    const untouched = after.find((row) => row.id === before[2].id)!
    expect(untouched.updatedAt.toISOString()).toBe(
      before[2].updatedAt.toISOString()
    )
  })

  it("子を書くと、解答用紙そのものの更新日時が進む", async () => {
    // 一覧の更新日時・並べ替え・期間の絞り込みは解答用紙の行を見る。子だけが
    // 変わったときに進まないと、古い時刻で答え続ける
    const definition = await givenThreeMajorQuestions()
    const before = await prisma.asbDefinition.findUniqueOrThrow({
      where: { id: definition.id },
    })
    const rows = await majorQuestionRows(definition.id)

    await updateAsbMajorQuestion(definition.id, rows[0].id, { label: "書いた" })

    const after = await prisma.asbDefinition.findUniqueOrThrow({
      where: { id: definition.id },
    })
    expect(after.updatedAt.getTime()).toBeGreaterThan(
      before.updatedAt.getTime()
    )
  })

  it("小問は指した大問の末尾に付く", async () => {
    const definition = await givenThreeMajorQuestions()
    const majorQuestion = definition.majorQuestions[1]

    await createAsbSubQuestion(
      definition.id,
      majorQuestion.id,
      createDefaultSubQuestion("②")
    )

    const rows = await prisma.asbSubQuestion.findMany({
      where: { majorQuestionId: majorQuestion.id },
      orderBy: { order: "asc" },
    })
    expect(rows.map((row) => row.order)).toEqual([0, 1])
    expect(rows[1].label).toBe("②")
  })

  it("担当でなければ書けない（判定は認証ストアの利用者）", async () => {
    const definition = await givenThreeMajorQuestions()
    const rows = await majorQuestionRows(definition.id)

    actor.userId = otherUserId
    await expect(
      updateAsbMajorQuestion(definition.id, rows[0].id, { label: "横取り" })
    ).rejects.toThrow(/担当ではない/)
    actor.userId = ownerId

    const after = await majorQuestionRows(definition.id)
    expect(after[0].label).toBe(rows[0].label)
  })

  it("原稿用紙の設定を書いても、文字位置マーカーは消えない", async () => {
    // 文字位置マーカーは原稿用紙の子で、別チャンネル。原稿用紙の属性を書く経路が
    // そこへ触れると、マス数を変えるたびに目印が消える
    const definition = await givenThreeMajorQuestions()
    const subQuestion = definition.majorQuestions[0].subQuestions[0]
    const manuscriptPaperId = crypto.randomUUID()
    await prisma.asbManuscriptPaper.create({
      data: {
        id: manuscriptPaperId,
        subQuestionId: subQuestion.id,
        enabled: true,
        columns: 20,
        rows: 10,
      },
    })
    await prisma.asbCharGuide.create({
      data: {
        id: "guide-keep",
        manuscriptPaperId,
        order: 0,
        atChar: 80,
        label: "80",
      },
    })

    await upsertAsbManuscriptPaper(
      definition.id,
      { subQuestionId: subQuestion.id },
      manuscriptPaperId,
      {
        enabled: true,
        columns: 25,
        rows: 10,
        guideFontSize: null,
        guidePosition: null,
        guidePadding: null,
      }
    )

    const charGuides = await prisma.asbCharGuide.findMany({
      where: { manuscriptPaperId },
    })
    expect(charGuides.map((charGuide) => charGuide.id)).toEqual(["guide-keep"])
    const row = await prisma.asbManuscriptPaper.findUniqueOrThrow({
      where: { id: manuscriptPaperId },
    })
    expect(row.columns).toBe(25)
  })

  it("小問のラベルだけを書いても、原稿用紙の行は動かない", async () => {
    // #1 の DB 側。小問の属性を書く経路が原稿用紙の列を持っていた頃は、
    // ラベルを1文字打つだけで 25×15 が 20×10 の既定へ戻った
    const definition = await givenThreeMajorQuestions()
    const subQuestion = definition.majorQuestions[0].subQuestions[0]
    const manuscriptPaperId = crypto.randomUUID()
    await prisma.asbManuscriptPaper.create({
      data: {
        id: manuscriptPaperId,
        subQuestionId: subQuestion.id,
        enabled: true,
        columns: 25,
        rows: 15,
      },
    })

    await updateAsbSubQuestion(definition.id, subQuestion.id, {
      label: "打ち替えた",
      points: subQuestion.points,
      heightMultiplier: subQuestion.heightMultiplier,
    })

    const row = await prisma.asbManuscriptPaper.findUniqueOrThrow({
      where: { id: manuscriptPaperId },
    })
    expect(row.enabled).toBe(true)
    expect(row.columns).toBe(25)
    expect(row.rows).toBe(15)
  })

  it("原稿用紙を書いても、同じセルに2つ目の行を作らない", async () => {
    // 鍵は `@unique`（＝親の id）。画面が持っている id が古くても、セルに1行という
    // 不変式は main が守る
    const definition = await givenThreeMajorQuestions()
    const subQuestion = definition.majorQuestions[1].subQuestions[0]
    const attributes = {
      enabled: true,
      columns: 20,
      rows: 10,
      guideFontSize: null,
      guidePosition: null,
      guidePadding: null,
    }
    const firstId = crypto.randomUUID()
    await upsertAsbManuscriptPaper(
      definition.id,
      { subQuestionId: subQuestion.id },
      firstId,
      attributes
    )
    await upsertAsbManuscriptPaper(
      definition.id,
      { subQuestionId: subQuestion.id },
      crypto.randomUUID(),
      { ...attributes, columns: 30 }
    )

    const rows = await prisma.asbManuscriptPaper.findMany({
      where: { subQuestionId: subQuestion.id },
    })
    expect(rows.map((row) => row.id)).toEqual([firstId])
    expect(rows[0].columns).toBe(30)
  })
})
