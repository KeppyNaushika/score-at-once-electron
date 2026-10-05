/**
 * 解答用紙作成の1件ずつの編集（`asbEditHandlers.ts` の口）の操作履歴の検査。
 *
 * - 編集は `answer_sheet.update` として、解答用紙を作業領域（scopeId / scopeLabel）にして残る
 * - 打鍵・ドラッグで続けて書くので、同じ解答用紙・同じ操作者の編集は1行へまとまる
 * - 何も変わらなかった書き込みは残らない
 * - 全面置き換え（undo / redo）の更新も、1件ずつの編集と同じ行へまとまる
 *
 * 担当の判定は操作者（認証ストア）で行うので、操作者を担当者にしてから書く。
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

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
  getSharedFilesDirectory: () => "/tmp/test-data",
}))

/** ログインしている利用者（担当の判定と操作履歴の操作者に使われる） */
const actor = vi.hoisted(() => ({ userId: null as string | null }))
vi.mock("../../electron-src/lib/prisma/auditActor", () => ({
  getCurrentActorUserId: () => actor.userId,
}))

import { parseAuditMetadata } from "@/app/(app)/audit-logs/auditLogRow"

import { updateAsbDefinition } from "../../electron-src/lib/prisma/asbDefinition"
import { replaceAsbDefinition } from "../../electron-src/lib/prisma/asbDefinitionReplace"
import {
  createAsbHeaderField,
  deleteAsbHeaderField,
  updateAsbHeaderField,
} from "../../electron-src/lib/prisma/asbHeaderField"
import {
  reorderAsbMajorQuestions,
  updateAsbMajorQuestion,
} from "../../electron-src/lib/prisma/asbMajorQuestion"
import {
  createDefaultDefinition,
  createDefaultHeaderField,
  createDefaultMajorQuestion,
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

beforeAll(async () => {
  await cleanupTestDatabase()
  ownerId = (await createTestUser()).id
  actor.userId = ownerId
})

beforeEach(async () => {
  await prisma.auditLog.deleteMany()
})

afterAll(async () => {
  await cleanupTestDatabase()
  await disconnectTestPrisma()
})

/** 大問2つの解答用紙を DB に置き、作成の記録は消しておく（編集の記録だけを見るため） */
async function givenDefinition(): Promise<AnswerSheetDefinition> {
  const definition: AnswerSheetDefinition = {
    ...createDefaultDefinition(),
    name: "数学 期末 解答用紙",
    majorQuestions: [
      createDefaultMajorQuestion("1"),
      createDefaultMajorQuestion("2"),
    ],
  }
  await replaceAsbDefinition(definition, ownerId)
  await prisma.auditLog.deleteMany()
  return definition
}

const editLogs = () =>
  prisma.auditLog.findMany({ where: { action: "answer_sheet.update" } })

describe("解答用紙作成の1件ずつの編集", () => {
  it("大問の更新は解答用紙を作業領域にして answer_sheet.update で残る", async () => {
    const definition = await givenDefinition()
    const [firstMajorQuestion] = definition.majorQuestions

    await updateAsbMajorQuestion(definition.id, firstMajorQuestion.id, {
      label: "第1問",
    })

    const logs = await editLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      category: "answer_sheet",
      userId: ownerId,
      entityType: "AsbDefinition",
      entityId: definition.id,
      scopeId: definition.id,
      scopeLabel: "数学 期末 解答用紙",
      summary: "解答用紙「数学 期末 解答用紙」を編集しました",
    })
  })

  it("続けた編集（ヘッダー項目の作成・更新・削除、大問の並べ替え）は1行へまとまる", async () => {
    const definition = await givenDefinition()
    const headerField = createDefaultHeaderField({ label: "氏名" })
    const [firstMajorQuestion, secondMajorQuestion] = definition.majorQuestions

    await createAsbHeaderField(definition.id, headerField)
    await updateAsbHeaderField(definition.id, headerField.id, {
      ...headerField,
      widthMm: 50,
    })
    await deleteAsbHeaderField(definition.id, headerField.id)
    await reorderAsbMajorQuestions(definition.id, [
      secondMajorQuestion.id,
      firstMajorQuestion.id,
    ])

    const logs = await editLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].coalesceKey).toBe(`answer_sheet.edit:${definition.id}`)
    expect(parseAuditMetadata(logs[0].metadata).occurrences).toBe(4)
  })

  it("解答用紙ごとに別の行になる", async () => {
    const firstDefinition = await givenDefinition()
    const secondDefinition = await givenDefinition()

    await updateAsbMajorQuestion(
      firstDefinition.id,
      firstDefinition.majorQuestions[0].id,
      { label: "A" }
    )
    await updateAsbMajorQuestion(
      secondDefinition.id,
      secondDefinition.majorQuestions[0].id,
      { label: "B" }
    )

    const logs = await editLogs()
    expect(logs.map((log) => log.scopeId).sort()).toEqual(
      [firstDefinition.id, secondDefinition.id].sort()
    )
  })

  it("何も変わらなかった書き込みは残らない", async () => {
    const definition = await givenDefinition()
    const [firstMajorQuestion] = definition.majorQuestions

    await updateAsbMajorQuestion(definition.id, firstMajorQuestion.id, {
      label: firstMajorQuestion.label,
    })
    await reorderAsbMajorQuestions(
      definition.id,
      definition.majorQuestions.map((majorQuestion) => majorQuestion.id)
    )

    expect(await editLogs()).toHaveLength(0)
  })

  it("名前を変えた編集は新しい名前を作業領域のラベルにする", async () => {
    const definition = await givenDefinition()

    await updateAsbDefinition(definition.id, {
      name: "数学 期末 解答用紙（改）",
      description: definition.description,
      referenceDate: definition.referenceDate,
      settings: definition.settings,
    })

    const logs = await editLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].scopeLabel).toBe("数学 期末 解答用紙（改）")
  })

  it("全面置き換えの更新（undo / redo）も1件ずつの編集と同じ行へまとまる", async () => {
    const definition = await givenDefinition()
    const [firstMajorQuestion] = definition.majorQuestions

    await updateAsbMajorQuestion(definition.id, firstMajorQuestion.id, {
      label: "第1問",
    })
    // undo: 編集前の姿で置き換える
    await replaceAsbDefinition(definition, ownerId)

    const logs = await editLogs()
    expect(logs).toHaveLength(1)
    expect(parseAuditMetadata(logs[0].metadata).occurrences).toBe(2)
  })
})
