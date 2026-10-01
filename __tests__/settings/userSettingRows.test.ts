/**
 * 利用者の設定のうち、**組が繰り返すもの**を行で持つことの検証。
 *
 * 1キーの JSON に畳んでいた頃は、続けて2つ変えると先の1つが消えた（塊で読み書きする
 * ので、取り直しが着地する前に古い写しへ2度目を重ねて書く）。ここで固定するのは
 * 「1回の書き込みが触るのは1行だけ」で、それが消えない理由そのものである。
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

import {
  listUserClickScoringActions,
  setUserClickScoringAction,
} from "../../electron-src/lib/prisma/userClickScoringAction"
import {
  applyUserScoringColorPreset,
  listUserScoringStatusColors,
  setUserScoringStatusColor,
} from "../../electron-src/lib/prisma/userScoringStatusColor"
import {
  listUserSidePanelSections,
  setUserSidePanelSection,
} from "../../electron-src/lib/prisma/userSidePanelSection"
import {
  presetBaseColors,
  toScoringStatusColors,
} from "../../src/lib/scoringStatusColors"
import { toClickScoringConfig } from "../../src/types/clickScoring.types"
import {
  cleanupTestDatabase,
  createTestUser,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../helpers/testPrismaClient"

const prisma = getTestPrismaClient()

let userId: string

beforeAll(async () => {
  await cleanupTestDatabase()
  userId = (await createTestUser()).id
})

afterAll(async () => {
  await disconnectTestPrisma()
})

describe("採点状態ごとの色", () => {
  it("続けて2色変えても、両方とも残る", async () => {
    await setUserScoringStatusColor(userId, "correct", {
      backgroundColor: "#111111",
      textColor: "#222222",
      iconColor: "#333333",
    })
    await setUserScoringStatusColor(userId, "partial", {
      backgroundColor: "#444444",
      textColor: "#555555",
      iconColor: "#666666",
    })

    const colors = toScoringStatusColors(
      await listUserScoringStatusColors(userId)
    )
    expect(colors.correct.bg).toBe("#111111")
    expect(colors.partial.bg).toBe("#444444")
  })

  it("1色変えても、他の状態の行は書かない", async () => {
    await setUserScoringStatusColor(userId, "correct", {
      backgroundColor: "#AAAAAA",
      textColor: "#BBBBBB",
      iconColor: "#CCCCCC",
    })
    await setUserScoringStatusColor(userId, "incorrect", {
      backgroundColor: "#DDDDDD",
      textColor: "#EEEEEE",
      iconColor: "#FFFFFF",
    })
    const before = await listUserScoringStatusColors(userId)
    const untouchedBefore = before.find((row) => row.status === "incorrect")!

    await setUserScoringStatusColor(userId, "correct", {
      backgroundColor: "#000000",
      textColor: "#BBBBBB",
      iconColor: "#CCCCCC",
    })

    const after = await listUserScoringStatusColors(userId)
    const untouchedAfter = after.find((row) => row.status === "incorrect")!
    expect(untouchedAfter.updatedAt.toISOString()).toBe(
      untouchedBefore.updatedAt.toISOString()
    )
  })

  it("プリセットを当てると、土台のidだけが残り、個別の上書きは消える", async () => {
    await setUserScoringStatusColor(userId, "pending", {
      backgroundColor: "#123456",
      textColor: "#234567",
      iconColor: "#345678",
    })

    await applyUserScoringColorPreset(userId, "soft")

    // 色の行は1本も残らない（色の中身は画面側がプリセットの id から引く）
    expect(await listUserScoringStatusColors(userId)).toEqual([])
    const presetId = await prisma.userPreference.findUnique({
      where: { userId_key: { userId, key: "scoringColorPresetId" } },
    })
    expect(presetId?.value).toBe(JSON.stringify("soft"))
  })

  it("色を1つ変えても、土台のプリセットは外れない", async () => {
    await applyUserScoringColorPreset(userId, "soft")

    await setUserScoringStatusColor(userId, "pending", {
      backgroundColor: "#999999",
      textColor: "#234567",
      iconColor: "#345678",
    })

    // 土台が外れると、触っていない状態の色まで既定へ戻ってしまう
    const presetId = await prisma.userPreference.findUnique({
      where: { userId_key: { userId, key: "scoringColorPresetId" } },
    })
    expect(presetId?.value).toBe(JSON.stringify("soft"))

    // 土台の色に、触った状態だけが重なる
    const colors = toScoringStatusColors(
      await listUserScoringStatusColors(userId),
      "soft"
    )
    expect(colors.pending.bg).toBe("#999999")
    expect(colors.correct).toEqual(presetBaseColors("soft").correct)
  })
})

describe("クリック回数ごとの動作", () => {
  it("続けて2つ変えても、両方とも残る", async () => {
    await setUserClickScoringAction(userId, 2, "correct")
    await setUserClickScoringAction(userId, 3, "pending")

    const config = toClickScoringConfig(
      await listUserClickScoringActions(userId)
    )
    expect(config[2]).toBe("correct")
    expect(config[3]).toBe("pending")
    // 触っていない回数は既定のまま
    expect(config[4]).toBe("individual")
  })
})

describe("側面パネルの節", () => {
  it("続けて2つ畳んでも、両方とも畳まれたまま", async () => {
    await setUserSidePanelSection(userId, "progress", true)
    await setUserSidePanelSection(userId, "tools", true)

    const collapsed = await listUserSidePanelSections(userId)
    expect(
      collapsed
        .filter((row) => row.collapsed)
        .map((row) => row.sectionId)
        .sort()
    ).toEqual(["progress", "tools"])
  })

  it("開き直した節は、行として残る（作り直さない）", async () => {
    await setUserSidePanelSection(userId, "navigation", true)
    const before = await prisma.userSidePanelSection.findUniqueOrThrow({
      where: { userId_sectionId: { userId, sectionId: "navigation" } },
    })

    await setUserSidePanelSection(userId, "navigation", false)

    const after = await prisma.userSidePanelSection.findUniqueOrThrow({
      where: { userId_sectionId: { userId, sectionId: "navigation" } },
    })
    expect(after.id).toBe(before.id)
    expect(after.collapsed).toBe(false)
  })
})
