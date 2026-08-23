/**
 * 原稿用紙（AsbManuscriptPaper）と文字位置マーカー（AsbCharGuide）の往復テスト
 *
 * 原稿用紙を小問の列からテーブルへ出し、文字位置マーカーの親を原稿用紙へ付け替えた
 * （docs/asb-ipc-split-plan.md §8.5）。保存 → 読込で、値・id・順序が保たれること、
 * **枝問にも原稿用紙が付くこと**、**オフにしても設定とマーカーが消えないこと**を見る。
 *
 * replaceAsbDefinition / getAsbDefinition は ./client シングルトン（アプリ本体のDB）を使うため、
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
import { setAsbManuscriptPaperEnabled } from "../../electron-src/lib/prisma/asbManuscriptPaper"
import { createDefaultDefinition } from "../../src/components/answer-sheet-builder/constants"
import type {
  ManuscriptCharGuide,
  ManuscriptPaper,
} from "../../src/types/answerSheetDefinition.types"
import {
  cleanupTestDatabase,
  createTestUser,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../helpers/testPrismaClient"

/** 既定の原稿用紙（属性ひとそろい。テストは変えたい列だけ上書きする） */
function manuscriptPaper(
  overrides: Partial<ManuscriptPaper> = {}
): ManuscriptPaper {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    columns: 20,
    rows: 10,
    guideFontSize: null,
    guidePosition: null,
    guidePadding: null,
    charGuides: [],
    ...overrides,
  }
}

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
    subQuestion.manuscriptPaper = manuscriptPaper({ charGuides })

    await replaceAsbDefinition(definition, userId)
    const loaded = await getAsbDefinition(definition.id)

    expect(loaded).not.toBeNull()
    const loadedGuides =
      loaded?.majorQuestions[0].subQuestions[0].manuscriptPaper?.charGuides
    expect(loadedGuides).toEqual(charGuides)
  })

  it("charGuides が無い小問は charGuides が空配列になる", async () => {
    const definition = createDefaultDefinition()
    const subQuestion = definition.majorQuestions[0].subQuestions[0]
    subQuestion.manuscriptPaper = manuscriptPaper()

    await replaceAsbDefinition(definition, userId)
    const loaded = await getAsbDefinition(definition.id)

    const loadedPaper =
      loaded?.majorQuestions[0].subQuestions[0].manuscriptPaper
    expect(loadedPaper?.enabled).toBe(true)
    expect(loadedPaper?.charGuides).toEqual([])
  })

  it("枝問にも原稿用紙と文字位置マーカーが付く", async () => {
    // 原稿用紙が小問の列だった頃は、枝問に原稿用紙を置く先が無かった。
    // それどころか原稿用紙の設定欄は「枝問を持たない小問」にしか出ず、
    // 「(1) 記号で答えよ ／ (2) 100字で説明せよ」が作れなかった
    const definition = createDefaultDefinition()
    const subQuestion = definition.majorQuestions[0].subQuestions[0]
    subQuestion.branchQuestions = [
      {
        id: crypto.randomUUID(),
        label: "(1)",
        heightMultiplier: 1,
        points: 2,
        textElements: [],
        imageElements: [],
      },
      {
        id: crypto.randomUUID(),
        label: "(2)",
        heightMultiplier: 1,
        points: 8,
        textElements: [],
        imageElements: [],
        manuscriptPaper: manuscriptPaper({
          columns: 25,
          rows: 4,
          guidePosition: "top-right",
          charGuides: [{ id: crypto.randomUUID(), atChar: 100, label: "100" }],
        }),
      },
    ]

    await replaceAsbDefinition(definition, userId)
    const loaded = await getAsbDefinition(definition.id)

    const loadedBranches =
      loaded?.majorQuestions[0].subQuestions[0].branchQuestions ?? []
    expect(loadedBranches[0].manuscriptPaper).toBeUndefined()
    expect(loadedBranches[1].manuscriptPaper).toMatchObject({
      enabled: true,
      columns: 25,
      rows: 4,
      guidePosition: "top-right",
    })
    expect(
      loadedBranches[1].manuscriptPaper?.charGuides.map(
        (charGuide) => charGuide.atChar
      )
    ).toEqual([100])
  })

  it("enabled を false にしても、設定と文字位置マーカーは消えない", async () => {
    // 原稿用紙は設計中にオン・オフを往復するのが自然な操作で、そのたびに
    // 25×15 とマーカーが消えるのは損失が大きい。「行なし＝一度も使っていない」
    // 「enabled=false＝いまはオフ、設定は保管」と読む
    const definition = createDefaultDefinition()
    const subQuestion = definition.majorQuestions[0].subQuestions[0]
    subQuestion.manuscriptPaper = manuscriptPaper({
      columns: 25,
      rows: 15,
      charGuides: [{ id: crypto.randomUUID(), atChar: 80, label: "80" }],
    })
    await replaceAsbDefinition(definition, userId)

    await setAsbManuscriptPaperEnabled(
      definition.id,
      { subQuestionId: subQuestion.id },
      subQuestion.manuscriptPaper.id,
      false,
      // 行を作るときの既定。ここでは行が既に在るので使われない
      // （使われてしまえば 25×15 が既定へ戻り、この検査が落ちる）
      manuscriptPaper()
    )

    const loaded = await getAsbDefinition(definition.id)
    const loadedPaper =
      loaded?.majorQuestions[0].subQuestions[0].manuscriptPaper
    expect(loadedPaper?.enabled).toBe(false)
    expect(loadedPaper?.columns).toBe(25)
    expect(loadedPaper?.rows).toBe(15)
    expect(
      loadedPaper?.charGuides.map((charGuide) => charGuide.atChar)
    ).toEqual([80])
  })

  it("guidePosition は境界で union へ絞る（null は「未指定」として残す）", async () => {
    // DB は `String?`。**型が union を名乗る以上、境界で実際に絞る**（素の `as` は
    // 名乗るだけで何もしない）。`null` は「未指定＝既定に従う」という別の意味なので潰さない
    const definition = createDefaultDefinition()
    const subQuestion = definition.majorQuestions[0].subQuestions[0]
    subQuestion.manuscriptPaper = manuscriptPaper({ guidePosition: null })
    await replaceAsbDefinition(definition, userId)

    const beforeTampering = await getAsbDefinition(definition.id)
    expect(
      beforeTampering?.majorQuestions[0].subQuestions[0].manuscriptPaper
        ?.guidePosition
    ).toBeNull()

    // 列の値を直に汚す（union の外の文字列は、本来どの流入口からも入らない）
    await getTestPrismaClient().asbManuscriptPaper.updateMany({
      where: { subQuestionId: subQuestion.id },
      data: { guidePosition: "middle-center" },
    })

    const loaded = await getAsbDefinition(definition.id)
    expect(
      loaded?.majorQuestions[0].subQuestions[0].manuscriptPaper?.guidePosition
    ).toBe("bottom-left")
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
    subQuestion.manuscriptPaper = manuscriptPaper({
      id: "dup-mp",
      columns: 25,
      rows: 15,
      charGuides,
    })
    await replaceAsbDefinition(definition, userId)

    const duplicatedId = await answerSheetBuilderHandlers[
      "asb:duplicate-definition"
    ](definition.id, userId)

    const loaded = await getAsbDefinition(duplicatedId)
    const copiedPaper =
      loaded?.majorQuestions[0].subQuestions[0].manuscriptPaper
    // 原稿用紙そのものも別テーブルの行なので id を振り直す
    expect(copiedPaper?.id).not.toBe("dup-mp")
    const copiedGuides = copiedPaper?.charGuides
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
      original?.majorQuestions[0].subQuestions[0].manuscriptPaper?.charGuides.map(
        (charGuide) => charGuide.id
      )
    ).toEqual(["dup-cg-a", "dup-cg-b"])
  })
})
