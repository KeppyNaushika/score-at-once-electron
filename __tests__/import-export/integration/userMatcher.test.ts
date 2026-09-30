/**
 * 採点者の事前照合（preMatchUsers）が、このPCの利用者の passcode を画面へ渡さないこと。
 *
 * 照合結果は IPC で renderer へ渡る（既存の利用者の行を existingData と allExistingUsers に
 * 載せる）。`User.passcode` は bcrypt ハッシュで、画面が使う場面は無い。
 * かつては `prisma.user.findMany()` を omit なしで引き、ハッシュがそのまま渡っていた。
 *
 * `publicUserOmit.test.ts` が見張るのは関連の `user: true` だけで、ここのように
 * User を直接引く経路は捕まえられないので、戻り値そのものを確かめる。
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createArchiveScoresData,
  createArchiveUsersData,
  createExtractedArchiveData,
  generateId,
} from "../../helpers/testDataFactory"
import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"

vi.mock("../../../electron-src/lib/prisma/client", () => {
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import { preMatchUsers } from "../../../electron-src/lib/import/merge/matchers/userMatcher"

const prisma = getTestPrismaClient()

/** 検査で探す目印。本物の bcrypt ハッシュの形でなくてよい */
const PASSCODE_HASH = "$2b$10$test-passcode-hash-must-not-leak"

describe("preMatchUsers", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await disconnectTestPrisma()
  })

  it("このPCの利用者の passcode を戻り値に含めない", async () => {
    // id で当たる人・利用者名で当たる人・照合に関わらず一覧にだけ出る人
    const sameIdUser = await prisma.user.create({
      data: {
        username: "same-id",
        name: "同じ id",
        role: "teacher",
        passcode: PASSCODE_HASH,
        passcodeType: "4digit",
      },
    })
    const sameUsernameUser = await prisma.user.create({
      data: {
        username: "same-username",
        name: "同じ利用者名",
        role: "teacher",
        passcode: PASSCODE_HASH,
        passcodeType: "6digit",
      },
    })
    await prisma.user.create({
      data: {
        username: "bystander",
        name: "関わらない人",
        role: "teacher",
        passcode: PASSCODE_HASH,
        passcodeType: "alphanumeric",
      },
    })

    const archiveGraderByUsernameId = generateId()
    const importData = createExtractedArchiveData({
      usersData: createArchiveUsersData([
        { id: sameIdUser.id, username: "same-id", name: "同じ id" },
        {
          id: archiveGraderByUsernameId,
          username: "same-username",
          name: "同じ利用者名",
        },
      ]),
      scoresData: createArchiveScoresData([
        {
          cropRegionId: generateId(),
          examStudentId: generateId(),
          userId: sameIdUser.id,
        },
        {
          cropRegionId: generateId(),
          examStudentId: generateId(),
          userId: archiveGraderByUsernameId,
        },
      ]),
    })

    const userPreMatch = await preMatchUsers(importData)

    // 照合そのものは従来どおり当たっている（検査が空振りしていないことの確認）
    expect(userPreMatch.byId.map((match) => match.existingId)).toEqual([
      sameIdUser.id,
    ])
    expect(userPreMatch.byName?.map((match) => match.existingId)).toEqual([
      sameUsernameUser.id,
    ])
    expect(userPreMatch.allExistingUsers).toHaveLength(3)

    // 行ごとに鍵が無いこと
    const existingRows = [
      ...userPreMatch.byId.map((match) => match.existingData),
      ...(userPreMatch.byName ?? []).map((match) => match.existingData),
      ...userPreMatch.allExistingUsers,
    ]
    for (const existingRow of existingRows) {
      expect(existingRow).not.toHaveProperty("passcode")
    }
    // 戻り値のどこにもハッシュが出てこないこと（載せる欄が増えても捕まえる）
    expect(JSON.stringify(userPreMatch)).not.toContain(PASSCODE_HASH)
  })

  it("利用者の行はそのまま渡し、表示名は組み立てない", async () => {
    const existingUser = await prisma.user.create({
      data: { username: "yamada", name: "山田", role: "teacher" },
    })

    const archiveGraderId = generateId()
    const importData = createExtractedArchiveData({
      usersData: createArchiveUsersData([
        { id: archiveGraderId, username: "other", name: "別の人" },
      ]),
      scoresData: createArchiveScoresData([
        {
          cropRegionId: generateId(),
          examStudentId: generateId(),
          userId: archiveGraderId,
        },
      ]),
    })

    const userPreMatch = await preMatchUsers(importData)

    expect(userPreMatch.allExistingUsers).toEqual([
      expect.objectContaining({
        id: existingUser.id,
        username: "yamada",
        name: "山田",
      }),
    ])
  })
})
