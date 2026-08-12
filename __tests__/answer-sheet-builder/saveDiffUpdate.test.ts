/**
 * 解答用紙の保存が「消えたものだけを消す」ことの検証（issue #1126 §1・§3）
 *
 * 以前は保存のたびに全消しして作り直していたため、
 * - 作成日時が保存のたびに「今」へ戻る（§3）
 * - 全行の削除と挿入が同期の変更履歴へ流れ、受け取る側で「同時刻なら削除が勝つ」
 *   判定に当たって相手の端末から解答用紙が消えたまま復活しない（§1）
 * という2つが起きていた。
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
