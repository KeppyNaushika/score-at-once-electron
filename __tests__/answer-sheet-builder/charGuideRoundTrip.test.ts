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

import * as fs from "fs"
import * as os from "os"
import * as path from "path"
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

/**
 * 画像の置き場所。複製は実ファイルをコピーするので、使い捨ての場所を1つ用意して
 * そこへ寄せる（並行して走る他の検査と踏み合わないよう、テストごとに固有の名前）。
 */
const testDataDir = path.join(
  os.tmpdir(),
  `asb-charguide-${process.pid}-${Date.now()}`
)
vi.mock("../../electron-src/lib/dataManager", () => ({
  getDataDirectory: () => testDataDir,
  getAsbImagesDirectory: (definitionId: string) =>
    path.join(testDataDir, "asb-images", definitionId),
}))

/** ログインしている利用者（担当かどうかの判定は main がこれで行う） */
const actor = vi.hoisted(() => ({ userId: null as string | null }))
vi.mock("../../electron-src/lib/prisma/auditActor", () => ({
  getCurrentActorUserId: () => actor.userId,
}))

import { answerSheetBuilderHandlers } from "../../electron-src/ipc-handlers/answerSheetBuilderHandlers"
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
  fs.rmSync(testDataDir, { recursive: true, force: true })
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

describe("解答用紙の複製", () => {
  it("文字位置マーカーの id を振り直す（元の id を引き継がない）", async () => {
    // 振り直さないと、元の AsbCharGuide.id のまま作成しようとして主キーが衝突し、
    // **マーカーを置いた解答用紙が一切複製できない**。しかも画像ディレクトリの
    // 作成とコピーはトランザクションの前に走るので、巻き戻っても孤児が残る
    // （docs/branch-review-findings.md #8）。OMR は同じ問題を既に直してある。
    const definition = createDefaultDefinition()
    const subQuestion = definition.majorQuestions[0].subQuestions[0]
    const charGuides: ManuscriptCharGuide[] = [
      { id: "dup-cg-a", atChar: 10, label: "10" },
      { id: "dup-cg-b", atChar: 20, label: "20", boundary: "dashed" },
    ]
    subQuestion.manuscriptPaper = {
      enabled: true,
      columns: 25,
      rows: 15,
      charGuides,
    }
    await replaceAsbDefinition(definition, userId)

    const duplicatedId = await answerSheetBuilderHandlers[
      "asb:duplicate-definition"
    ](definition.id, userId)

    const loaded = await getAsbDefinition(duplicatedId)
    const copiedGuides =
      loaded?.majorQuestions[0].subQuestions[0].manuscriptPaper?.charGuides
    expect(copiedGuides).toHaveLength(2)

    // 中身は同じで、id だけが別
    expect(copiedGuides?.map((charGuide) => charGuide.atChar)).toEqual([10, 20])
    expect(copiedGuides?.map((charGuide) => charGuide.label)).toEqual([
      "10",
      "20",
    ])
    const copiedIds = copiedGuides?.map((charGuide) => charGuide.id) ?? []
    expect(copiedIds).not.toContain("dup-cg-a")
    expect(copiedIds).not.toContain("dup-cg-b")

    // 元の解答用紙のマーカーは無傷
    const original = await getAsbDefinition(definition.id)
    expect(
      original?.majorQuestions[0].subQuestions[0].manuscriptPaper?.charGuides?.map(
        (charGuide) => charGuide.id
      )
    ).toEqual(["dup-cg-a", "dup-cg-b"])
  })
})
