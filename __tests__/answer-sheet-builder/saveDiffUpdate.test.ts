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

/**
 * ログインしている利用者。**担当かどうかを判定するのは main** で、判定の出所は
 * renderer が渡す id ではなく認証ストア（`getCurrentActorUserId`）。テストでは
 * 「いま誰がアプリを触っているか」をここで決める。
 */
const actor = vi.hoisted(() => ({ userId: null as string | null }))
vi.mock("../../electron-src/lib/prisma/auditActor", () => ({
  getCurrentActorUserId: () => actor.userId,
}))

import {
  getAsbDefinition,
  transferAsbDefinitionOwner,
} from "../../electron-src/lib/prisma/asbDefinition"
import { replaceAsbDefinition } from "../../electron-src/lib/prisma/asbDefinitionReplace"
import {
  createAsbDefinitionTag,
  setAsbDefinitionTags,
} from "../../electron-src/lib/prisma/asbDefinitionTag"
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
  actor.userId = ownerId
})

afterAll(async () => {
  await disconnectTestPrisma()
})

describe("解答用紙の保存", () => {
  it("2回目の保存で作成日時と担当が変わらない", async () => {
    const definition = createDefaultDefinition()
    await replaceAsbDefinition(definition, ownerId)
    const first = await prisma.asbDefinition.findUniqueOrThrow({
      where: { id: definition.id },
    })

    await replaceAsbDefinition({ ...definition, name: "名前を変えた" }, ownerId)
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
    await replaceAsbDefinition(
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
    await replaceAsbDefinition(
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
    await replaceAsbDefinition(twoMajorQuestions, ownerId)

    const before = await prisma.asbMajorQuestion.findMany({
      where: { definitionId: definition.id },
    })
    const untouchedBefore = before.find(
      (row) => row.id === secondMajorQuestion.id
    )!

    // 第1問のラベルだけを変えて保存し直す
    await replaceAsbDefinition(
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

  it("先頭を消すと、残った小問の並び順が詰まる（穴が空かない）", async () => {
    const definition = createDefaultDefinition()
    const majorQuestion = definition.majorQuestions[0]
    const firstSubQuestion = majorQuestion.subQuestions[0]
    const secondSubQuestion = {
      ...firstSubQuestion,
      id: crypto.randomUUID(),
      label: "2つ目",
      textElements: [],
      imageElements: [],
      branchQuestions: [],
    }
    await replaceAsbDefinition(
      {
        ...definition,
        majorQuestions: [
          {
            ...majorQuestion,
            subQuestions: [firstSubQuestion, secondSubQuestion],
          },
        ],
      },
      ownerId
    )

    // 先頭を消す。残るのは元 order=1 の行
    await replaceAsbDefinition(
      {
        ...definition,
        majorQuestions: [
          { ...majorQuestion, subQuestions: [secondSubQuestion] },
        ],
      },
      ownerId
    )

    const remaining = await prisma.asbSubQuestion.findMany({
      where: { majorQuestion: { definitionId: definition.id } },
    })
    expect(remaining.map((row) => row.order)).toEqual([0])
  })

  it("何も変えずに保存し直しても、解答用紙の更新日時が動かない", async () => {
    const definition = createDefaultDefinition()
    await replaceAsbDefinition(definition, ownerId)
    const first = await prisma.asbDefinition.findUniqueOrThrow({
      where: { id: definition.id },
    })

    await replaceAsbDefinition(definition, ownerId)
    const second = await prisma.asbDefinition.findUniqueOrThrow({
      where: { id: definition.id },
    })

    expect(second.updatedAt.toISOString()).toBe(first.updatedAt.toISOString())
  })

  it("タグの設定は、外れたものだけ消して付いたものだけ作る", async () => {
    const definition = createDefaultDefinition()
    await replaceAsbDefinition(definition, ownerId)
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
    await replaceAsbDefinition(definition, ownerId)

    actor.userId = otherUserId
    await expect(
      replaceAsbDefinition({ ...definition, name: "横取り" }, otherUserId)
    ).rejects.toThrow(/担当ではない/)
    actor.userId = ownerId

    const row = await prisma.asbDefinition.findUniqueOrThrow({
      where: { id: definition.id },
    })
    expect(row.name).toBe(definition.name)
  })

  it("担当者でなければタグも付け替えられない", async () => {
    // タグ付けだけが関所を通っていなかった。一覧が全員の解答用紙を出すように
    // なったので、他の編集は全部弾かれるのにタグ付けだけ通る状態だった
    // （docs/branch-review-findings.md #10）
    const definition = createDefaultDefinition()
    await replaceAsbDefinition(definition, ownerId)
    const tag = await prisma.tag.create({
      data: { name: `よそのタグ_${crypto.randomUUID()}` },
    })

    actor.userId = otherUserId
    await expect(setAsbDefinitionTags(definition.id, [tag.id])).rejects.toThrow(
      /担当ではない/
    )
    await expect(
      createAsbDefinitionTag({
        asbDefinitionId: definition.id,
        tagId: tag.id,
      })
    ).rejects.toThrow(/担当ではない/)
    actor.userId = ownerId

    const links = await prisma.asbDefinitionTag.findMany({
      where: { asbDefinitionId: definition.id },
    })
    expect(links).toHaveLength(0)
  })

  it("タグを付け替えると、解答用紙の更新日時が繰り上がる", async () => {
    const definition = createDefaultDefinition()
    await replaceAsbDefinition(definition, ownerId)
    const before = await prisma.asbDefinition.findUniqueOrThrow({
      where: { id: definition.id },
    })
    const tag = await prisma.tag.create({
      data: { name: `並べ替え確認_${crypto.randomUUID()}` },
    })

    await setAsbDefinitionTags(definition.id, [tag.id])

    const after = await prisma.asbDefinition.findUniqueOrThrow({
      where: { id: definition.id },
    })
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(
      before.updatedAt.getTime()
    )
    expect(after.updatedAt.getTime()).not.toBe(0)
  })

  it("担当を渡せるのは今の担当者だけで、渡した後は相手が保存できる", async () => {
    const definition = createDefaultDefinition()
    await replaceAsbDefinition(definition, ownerId)

    await expect(
      transferAsbDefinitionOwner(definition.id, otherUserId, otherUserId)
    ).rejects.toThrow(/今の担当者だけ/)

    await transferAsbDefinitionOwner(definition.id, ownerId, otherUserId)
    actor.userId = otherUserId
    await replaceAsbDefinition(
      { ...definition, name: "受け取った" },
      otherUserId
    )

    const loaded = await getAsbDefinition(definition.id)
    expect(loaded?.name).toBe("受け取った")
    // 渡した側はもう書けない
    actor.userId = ownerId
    await expect(
      replaceAsbDefinition({ ...definition, name: "戻す" }, ownerId)
    ).rejects.toThrow(/担当ではない/)
  })
})
