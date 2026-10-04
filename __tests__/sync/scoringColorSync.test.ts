/**
 * 採点状態の表示色を2端末で同期したときの検査（本物の sqlite-nas-sync × 本物の schema.prisma）
 *
 * 確かめたいのは**書き込みの粒度**で、ここが粗いと同期は黙って片方の変更を捨てる。
 * `UserScoringStatusColor` は以前から同期対象だが、**プリセットを当てる操作が全状態の
 * 色行を書き直していた**。1回の操作で7行の `updatedAt` が進むので、行ごとの勝ち負けが
 * **組ごとの勝ち負けに退化する** — 端末Bが個別に直した色は、端末Aがあとでプリセットを
 * 当てた瞬間に消えた。
 *
 * 直したあとの持ち方は「土台のプリセット1つ（`UserPreference` の1行）＋個別の上書き
 * （状態ごとに1行）」。プリセットは色を1行も書かないので、他端末の個別の色と重ならない。
 *
 * **書き込みは本物の関数（`electron-src/lib/prisma/userScoringStatusColor.ts`）を通す。**
 * 粒度が検査対象なので、テストが生SQLで書いてしまうと何も確かめられない。アプリの
 * singleton Prisma クライアントは Electron の置き場に繋がるため、モジュールごと
 * 差し替えて「いま見ている端末のDB」へ向ける。
 */
import type { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import type { SyncInstance } from "sqlite-nas-sync"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createPrismaClientForPath } from "../helpers/testPrismaClient"
import {
  blockingWarnings,
  createClientDatabase,
  createSyncInstance,
  isoMinutesAgo,
  TWO_CLIENT_SETUP_TIMEOUT_MS,
  withDatabase,
} from "./twoClientHarness"

/** いま書き込み先になっている端末の Prisma クライアント */
let activeClient: PrismaClient | null = null

vi.mock("../../electron-src/lib/prisma/client", () => {
  const forwardToActiveClient = new Proxy(
    {},
    {
      get: (_target, property) => {
        if (activeClient === null) {
          throw new Error("書き込み先の端末が選ばれていない")
        }
        const member = Reflect.get(activeClient, property)
        return typeof member === "function" ? member.bind(activeClient) : member
      },
    }
  )
  return {
    default: forwardToActiveClient,
    getPrismaClient: () => forwardToActiveClient,
  }
})

// モックが効いた状態で読み込む（本物の singleton は Electron の置き場に繋がる）
const {
  applyUserScoringColorPreset,
  listUserScoringStatusColors,
  setUserScoringStatusColor,
} = await import("../../electron-src/lib/prisma/userScoringStatusColor")

/**
 * 試験ごとに作り直す置き場（NAS と2端末の DB）。
 *
 * **名前を固定しない。** `os.tmpdir()` は利用者ごとに1つで、別の作業ツリーや並行して
 * 走る別の vitest とも同じ場所を指す。固定名だと相手の `beforeEach` が DB と NAS を
 * 消して作り直し、`no such table: _sns_tick`・`disk I/O error`・`database disk image
 * is malformed` で落ちる。試験ごとに分けるのは、時間切れで打ち切られた前の試験の
 * 下ごしらえ（裏で走り続ける）に次の試験の置き場を触らせないためでもある。
 */
let testRoot: string
let nasDir: string
let dbA: string
let dbB: string

/** 両端末で同じ値でなければ相手がスキーマ不一致でスキップされる */
const SCHEMA_VERSION = "scoring-color-sync-test"

const USER_ID = "scoring-color-sync"

let syncA: SyncInstance
let syncB: SyncInstance
let prismaA: PrismaClient
let prismaB: PrismaClient

/** 1巡回す。同期を止める警告・行が表から外れた警告が出ていないことを毎回見る */
const syncRound = async (label: string, instance: SyncInstance) => {
  const result = await instance.syncNow()
  expect(blockingWarnings(result.warnings), label).toEqual([])
  return result
}

/** その端末のDBへ、その端末として書く */
const onClient = async <T>(
  client: PrismaClient,
  write: () => Promise<T>
): Promise<T> => {
  activeClient = client
  try {
    return await write()
  } finally {
    activeClient = null
  }
}

const insertUser = (dbPath: string, updatedAt: string): void => {
  withDatabase(dbPath, (db) =>
    db
      .prepare(
        `INSERT INTO "User" (id, username, name, role, "createdAt", "updatedAt")
         VALUES (?, ?, ?, 'teacher', ?, ?)`
      )
      .run(USER_ID, "teacher-shared", "採点者", updatedAt, updatedAt)
  )
}

/** その端末が持っている個別の上書き（状態 → 背景色） */
const overridesOf = async (
  client: PrismaClient
): Promise<Record<string, string>> => {
  const rows = await onClient(client, () =>
    listUserScoringStatusColors(USER_ID)
  )
  return Object.fromEntries(
    rows.map((row) => [row.status, row.backgroundColor])
  )
}

/** その端末が土台にしているプリセット（保存の形は JSON でくるんだ id） */
const presetIdOf = (dbPath: string): string | null =>
  withDatabase(dbPath, (db) => {
    const row = db
      .prepare<[string], { value: string }>(
        `SELECT value FROM "UserPreference"
          WHERE "userId" = ? AND key = 'scoringColorPresetId'`
      )
      .get(USER_ID)
    return row ? (JSON.parse(row.value) as string) : null
  })

const colorOf = (backgroundColor: string) => ({
  backgroundColor,
  textColor: "#000000",
  iconColor: "#000000",
})

const roundTrip = async () => {
  await syncRound("A 送出", syncA)
  await syncRound("B 取り込みと送出", syncB)
  await syncRound("A 取り込み", syncA)
  await syncRound("B 取り込み", syncB)
}

beforeEach(async () => {
  testRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "score-at-once-scoring-color-sync-")
  )
  nasDir = path.join(testRoot, "nas")
  dbA = path.join(testRoot, "client-a", "database.db")
  dbB = path.join(testRoot, "client-b", "database.db")
  fs.mkdirSync(nasDir, { recursive: true })
  createClientDatabase(dbA)
  createClientDatabase(dbB)
  prismaA = createPrismaClientForPath(dbA)
  prismaB = createPrismaClientForPath(dbB)
  syncA = createSyncInstance(dbA, "client-a", nasDir, SCHEMA_VERSION)
  syncB = createSyncInstance(dbB, "client-b", nasDir, SCHEMA_VERSION)

  // 設定の親になる利用者を先に行き渡らせる（外部キーの相手が無いと検査にならない）
  insertUser(dbA, isoMinutesAgo(120))
  await syncRound("A 利用者の送出", syncA)
  await syncRound("B 利用者の取り込み", syncB)
}, TWO_CLIENT_SETUP_TIMEOUT_MS)

afterEach(async () => {
  syncA.stop()
  syncB.stop()
  activeClient = null
  await prismaA.$disconnect()
  await prismaB.$disconnect()
  fs.rmSync(testRoot, { recursive: true, force: true })
})

describe("採点状態の表示色の同期", () => {
  it("2台が別々の状態色を直しても、両方の変更が残る", async () => {
    await onClient(prismaA, () =>
      setUserScoringStatusColor(USER_ID, "correct", colorOf("#AA0000"))
    )
    await onClient(prismaB, () =>
      setUserScoringStatusColor(USER_ID, "incorrect", colorOf("#00BB00"))
    )

    await roundTrip()

    for (const [label, client] of [
      ["端末A", prismaA],
      ["端末B", prismaB],
    ] as const) {
      expect(await overridesOf(client), label).toEqual({
        correct: "#AA0000",
        incorrect: "#00BB00",
      })
    }
  })

  it("一方がプリセットを当てても、他端末の個別の色は残る", async () => {
    // 端末B が1色だけ直す
    await onClient(prismaB, () =>
      setUserScoringStatusColor(USER_ID, "incorrect", colorOf("#00BB00"))
    )
    // 端末A があとでプリセットを当てる（＝版は A のほうが新しい）
    await onClient(prismaA, () => applyUserScoringColorPreset(USER_ID, "vivid"))

    await roundTrip()

    // **プリセットは土台なので、色の行を1本も書かない。** 全状態の色を書いていた頃は、
    // あとに保存した端末A の組が丸ごと勝ち、B が直した誤答の色は消えていた
    for (const [label, client] of [
      ["端末A", prismaA],
      ["端末B", prismaB],
    ] as const) {
      expect(await overridesOf(client), label).toEqual({
        incorrect: "#00BB00",
      })
    }
    for (const [label, dbPath] of [
      ["端末A", dbA],
      ["端末B", dbB],
    ] as const) {
      expect(presetIdOf(dbPath), label).toBe("vivid")
    }
  })

  it("2台が別々のプリセットを選んだときは、あとの版が両方へ残る", async () => {
    await onClient(prismaA, () => applyUserScoringColorPreset(USER_ID, "vivid"))
    await onClient(prismaB, () => applyUserScoringColorPreset(USER_ID, "soft"))

    await roundTrip()

    // 土台は1行なので、組ごとの勝ち負けではなくその1行の勝ち負けで決まる
    for (const [label, dbPath] of [
      ["端末A", dbA],
      ["端末B", dbB],
    ] as const) {
      expect(presetIdOf(dbPath), label).toBe("soft")
    }
  })

  it("自分の端末の個別の上書きは、プリセットを当て直すと捨てられる", async () => {
    await onClient(prismaA, () =>
      setUserScoringStatusColor(USER_ID, "correct", colorOf("#AA0000"))
    )
    await roundTrip()
    expect(await overridesOf(prismaB)).toEqual({ correct: "#AA0000" })

    // 行き渡ったあとで A がまとまりを選び直す（＝捨てる対象を手元に持っている）
    await onClient(prismaA, () => applyUserScoringColorPreset(USER_ID, "soft"))
    await roundTrip()

    for (const [label, client] of [
      ["端末A", prismaA],
      ["端末B", prismaB],
    ] as const) {
      expect(await overridesOf(client), label).toEqual({})
    }
  })
})
