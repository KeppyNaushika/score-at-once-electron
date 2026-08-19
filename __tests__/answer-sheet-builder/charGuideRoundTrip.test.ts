/**
 * AsbCharGuide 変換レイヤーの往復テスト
 *
 * manuscriptCharGuides（旧: JSON列）を AsbCharGuide テーブルへ分離した（issue #913）ことに伴い、
 * definitionToDb（保存）→ dbToDefinition（読込）で文字位置マーカーが
 * id・順序・boundary・比率つきで正しく往復することを検証する。
 *
 * replaceAsbDefinition / getAsbDefinition は ./client シングルトン（DB）を使うため、
 * archiveRoundTrip と同様に client をテスト用クライアントへモックする。
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

import { getAsbDefinition } from "../../electron-src/lib/prisma/asbDefinition"
import { replaceAsbDefinition } from "../../electron-src/lib/prisma/asbDefinitionReplace"
import { createDefaultDefinition } from "../../src/components/answer-sheet-builder/constants"
import type { ManuscriptCharGuide } from "../../src/types/answerSheetDefinition.types"
import {
  cleanupTestDatabase,
  createTestUser,
  disconnectTestPrisma,
} from "../helpers/testPrismaClient"

let userId: string

beforeAll(async () => {
  await cleanupTestDatabase()
  const user = await createTestUser()
  userId = user.id
  actor.userId = userId
})

afterAll(async () => {
  await disconnectTestPrisma()
})

describe("AsbCharGuide 変換往復", () => {
  it("charGuides が id・順序・boundary・比率つきで往復する", async () => {
    const definition = createDefaultDefinition()
    const subQuestion = definition.majorQuestions[0].subQuestions[0]
    const charGuides: ManuscriptCharGuide[] = [
      {
        id: "cg-a",
        atChar: 10,
        label: "10",
        boundary: "solid",
        boundaryWidth: 0.5,
      },
      {
        id: "cg-b",
        atChar: 20,
        label: "",
        boundary: "dashed",
        boundaryDashRatio: 3,
        boundaryGapRatio: 2,
      },
      // boundary 等が未設定の要素（optional は undefined のまま往復する）
      { id: "cg-c", atChar: 30, label: "30" },
    ]
    subQuestion.manuscriptPaper = {
      enabled: true,
      columns: 20,
      rows: 10,
      charGuides,
    }

    await replaceAsbDefinition(definition, userId)
    const loaded = await getAsbDefinition(definition.id)

    expect(loaded).not.toBeNull()
    const loadedGuides =
      loaded?.majorQuestions[0].subQuestions[0].manuscriptPaper?.charGuides
    expect(loadedGuides).toEqual(charGuides)
  })

  it("charGuides が無い小問は manuscriptPaper.charGuides が undefined になる", async () => {
    const definition = createDefaultDefinition()
    const subQuestion = definition.majorQuestions[0].subQuestions[0]
    subQuestion.manuscriptPaper = { enabled: true, columns: 20, rows: 10 }

    await replaceAsbDefinition(definition, userId)
    const loaded = await getAsbDefinition(definition.id)

    const manuscriptPaper =
      loaded?.majorQuestions[0].subQuestions[0].manuscriptPaper
    expect(manuscriptPaper?.enabled).toBe(true)
    expect(manuscriptPaper?.charGuides).toBeUndefined()
  })
})
