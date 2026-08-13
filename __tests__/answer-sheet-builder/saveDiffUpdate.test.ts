/**
 * 解答用紙の保存が「消えたものだけを消す」ことの検証（issue #1126 §3）
 *
 * 以前は保存のたびに全消しして作り直していたため、
 * - 作成日時が保存のたびに「今」へ戻る（§3）
 * - 担当（userId）も保存のたびに書き換わる
 * - 1回の保存で全行の削除と挿入が同期の変更履歴へ流れ、相手の端末で全行が
 *   更新し直される
 * が起きていた。
 *
 * なお #1126 §1 が言う「相手の端末から解答用紙が消えたまま復活しない」は、
 * sqlite-nas-sync の2端末ハーネスで実測したところ**再現しない**。
 * 詳細は docs/ipc-and-data-fetching-plan.md 段階8。
 *
 * ここでは「残るものは id ごと残り、消えたものだけ消える」ことと、
 * 担当者でなければ保存できないことを固定する。
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

import {
  getAsbDefinition,
  saveAsbDefinition,
  transferAsbDefinitionOwner,
} from "../../electron-src/lib/prisma/asbDefinition"
import { setAsbDefinitionTags } from "../../electron-src/lib/prisma/asbDefinitionTag"
import { createDefaultDefinition } from "../../src/components/answer-sheet-builder/constants"
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
})

afterAll(async () => {
  await disconnectTestPrisma()
})

describe("解答用紙の保存", () => {
  it("2回目の保存で作成日時と担当が変わらない", async () => {
    const definition = createDefaultDefinition()
    await saveAsbDefinition(definition, ownerId)
    const first = await prisma.asbDefinition.findUniqueOrThrow({
      where: { id: definition.id },
    })

    await saveAsbDefinition({ ...definition, name: "名前を変えた" }, ownerId)
    const second = await prisma.asbDefinition.findUniqueOrThrow({
      where: { id: definition.id },
    })

    expect(second.createdAt.toISOString()).toBe(first.createdAt.toISOString())
    expect(second.userId).toBe(ownerId)
    expect(second.name).toBe("名前を変えた")
  })

  it("残る設問は id ごと残り、消した設問だけが消える", async () => {
    const definition = createDefaultDefinition()
    const majorQuestion = definition.majorQuestions[0]
    const keptSubQuestion = majorQuestion.subQuestions[0]
    const removedSubQuestion = {
      ...keptSubQuestion,
      id: crypto.randomUUID(),
      label: "消す小問",
      textElements: [],
      imageElements: [],
      branchQuestions: [],
    }
    await saveAsbDefinition(
      {
        ...definition,
        majorQuestions: [
          {
            ...majorQuestion,
            subQuestions: [keptSubQuestion, removedSubQuestion],
          },
        ],
      },
      ownerId
    )

    const before = await prisma.asbSubQuestion.findMany({
      where: { majorQuestion: { definitionId: definition.id } },
      orderBy: { order: "asc" },
    })
    expect(before.map((row) => row.id)).toEqual([
      keptSubQuestion.id,
      removedSubQuestion.id,
    ])

    // 2つ目を消して保存し直す
    await saveAsbDefinition(
      {
        ...definition,
        majorQuestions: [{ ...majorQuestion, subQuestions: [keptSubQuestion] }],
      },
      ownerId
    )

    const after = await prisma.asbSubQuestion.findMany({
      where: { majorQuestion: { definitionId: definition.id } },
    })
    expect(after.map((row) => row.id)).toEqual([keptSubQuestion.id])
    // 残った行は作り直されていない（id だけでなく作成日時も同じ）
    const keptBefore = before.find((row) => row.id === keptSubQuestion.id)!
    expect(after[0].createdAt.toISOString()).toBe(
      keptBefore.createdAt.toISOString()
    )
  })

  it("触っていない大問は書き換えない（更新日時が動かない）", async () => {
    // 全行を書き直すと、触っていない行まで updatedAt が「今」になる。同期は行ごとの
    // LWW なので、2端末が別々の大問を編集しただけで後から保存した側の木が丸ごと勝つ
    const definition = createDefaultDefinition()
    const firstMajorQuestion = definition.majorQuestions[0]
    const secondMajorQuestion = {
      ...firstMajorQuestion,
      id: crypto.randomUUID(),
      label: "第2問",
      subQuestions: firstMajorQuestion.subQuestions.map((subQuestion) => ({
        ...subQuestion,
        id: crypto.randomUUID(),
        textElements: [],
        imageElements: [],
        branchQuestions: [],
      })),
    }
    const twoMajorQuestions = {
      ...definition,
      majorQuestions: [firstMajorQuestion, secondMajorQuestion],
    }
    await saveAsbDefinition(twoMajorQuestions, ownerId)

    const before = await prisma.asbMajorQuestion.findMany({
      where: { definitionId: definition.id },
    })
    const untouchedBefore = before.find(
      (row) => row.id === secondMajorQuestion.id
    )!

    // 第1問のラベルだけを変えて保存し直す
    await saveAsbDefinition(
      {
        ...twoMajorQuestions,
        majorQuestions: [
          { ...firstMajorQuestion, label: "書き換えた第1問" },
          secondMajorQuestion,
        ],
      },
      ownerId
    )

    const after = await prisma.asbMajorQuestion.findMany({
      where: { definitionId: definition.id },
    })
    const touchedAfter = after.find((row) => row.id === firstMajorQuestion.id)!
    const untouchedAfter = after.find(
      (row) => row.id === secondMajorQuestion.id
    )!

    expect(touchedAfter.label).toBe("書き換えた第1問")
    // 触っていない大問は書き込みが起きていない
    expect(untouchedAfter.updatedAt.toISOString()).toBe(
      untouchedBefore.updatedAt.toISOString()
    )
  })

  it("何も変えずに保存し直しても、解答用紙の更新日時が動かない", async () => {
    const definition = createDefaultDefinition()
    await saveAsbDefinition(definition, ownerId)
    const first = await prisma.asbDefinition.findUniqueOrThrow({
      where: { id: definition.id },
    })

    await saveAsbDefinition(definition, ownerId)
    const second = await prisma.asbDefinition.findUniqueOrThrow({
      where: { id: definition.id },
    })

    expect(second.updatedAt.toISOString()).toBe(first.updatedAt.toISOString())
  })

  it("タグの設定は、外れたものだけ消して付いたものだけ作る", async () => {
    const definition = createDefaultDefinition()
    await saveAsbDefinition(definition, ownerId)
    const keptTag = await prisma.tag.create({
      data: { name: `残る ${Date.now()}` },
    })
    const removedTag = await prisma.tag.create({
      data: { name: `外す ${Date.now()}` },
    })

    await setAsbDefinitionTags(definition.id, [keptTag.id, removedTag.id])
    const before = await prisma.asbDefinitionTag.findMany({
      where: { asbDefinitionId: definition.id },
    })
    const keptBefore = before.find((link) => link.tagId === keptTag.id)!

    await setAsbDefinitionTags(definition.id, [keptTag.id])

    const after = await prisma.asbDefinitionTag.findMany({
      where: { asbDefinitionId: definition.id },
    })
    expect(after.map((link) => link.tagId)).toEqual([keptTag.id])
    // 残ったタグの紐付けは作り直されていない
    expect(after[0].id).toBe(keptBefore.id)
  })

  it("担当者でなければ保存できない", async () => {
    const definition = createDefaultDefinition()
    await saveAsbDefinition(definition, ownerId)

    await expect(
      saveAsbDefinition({ ...definition, name: "横取り" }, otherUserId)
    ).rejects.toThrow(/担当ではない/)

    const row = await prisma.asbDefinition.findUniqueOrThrow({
      where: { id: definition.id },
    })
    expect(row.name).toBe(definition.name)
  })

  it("担当を渡せるのは今の担当者だけで、渡した後は相手が保存できる", async () => {
    const definition = createDefaultDefinition()
    await saveAsbDefinition(definition, ownerId)

    await expect(
      transferAsbDefinitionOwner(definition.id, otherUserId, otherUserId)
    ).rejects.toThrow(/今の担当者だけ/)

    await transferAsbDefinitionOwner(definition.id, ownerId, otherUserId)
    await saveAsbDefinition({ ...definition, name: "受け取った" }, otherUserId)

    const loaded = await getAsbDefinition(definition.id)
    expect(loaded?.name).toBe("受け取った")
    await expect(
      saveAsbDefinition({ ...definition, name: "戻す" }, ownerId)
    ).rejects.toThrow(/担当ではない/)
  })
})
