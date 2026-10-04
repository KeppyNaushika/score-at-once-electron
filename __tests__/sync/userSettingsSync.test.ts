/**
 * 利用者ごとの設定を2端末で同期したときの検査（本物の sqlite-nas-sync × 本物の schema.prisma）
 *
 * `UserPreference` / `UserKeyboardShortcut` は長らく同期の除外リストに載っていた。
 * どちらも端末ではなく**利用者に付く**設定なので同期対象へ移したが、移すだけでは足りない。
 * 確かめたいのは**書き込みの粒度**で、ここが粗いと同期は黙って片方の変更を捨てる。
 *
 * ショートカットの保存は、画面が持っている割り当て全部（既定の読み替えを通した
 * 全コマンド）をまとめて upsert していた。1つ直すだけで触っていない行の `updatedAt` も
 * 進むので、**行ごとの勝ち負けが組ごとの勝ち負けに退化する**。端末Aで `scoring.correct`、
 * 端末Bで `tool.text` を直すと、あとに保存した端末が全行の勝者になり、もう片方の変更は
 * 消える。1件ずつ書けば、触っていない行は版が動かないので両方残る。
 *
 * **書き込みは本物の関数（`electron-src/lib/prisma/userSettings.ts`）を通す。** 粒度が
 * 検査対象なので、テストが生SQLで書いてしまうと何も確かめられない。アプリの singleton
 * Prisma クライアントは Electron の置き場に繋がるため、モジュールごと差し替えて
 * 「いま見ている端末のDB」へ向ける。
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

/**
 * いま書き込み先になっている端末の Prisma クライアント。
 *
 * `userSettings.ts` は `./client` の default（singleton）を使う。ここを差し替えて
 * 端末A・端末Bを切り替える。`$transaction` などのメソッドは `this` が要るので束ねて返す。
 */
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
const { setUserKeyboardShortcut, setUserPreference, getUserKeyboardShortcuts } =
  await import("../../electron-src/lib/prisma/userSettings")

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
const SCHEMA_VERSION = "user-settings-sync-test"

const USER_ID = "user-settings-sync"

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

const shortcutsOf = async (client: PrismaClient) =>
  onClient(client, () => getUserKeyboardShortcuts(USER_ID))

const preferenceRows = (
  dbPath: string
): Array<{ key: string; value: string }> =>
  withDatabase(dbPath, (db) =>
    db
      .prepare<[], { key: string; value: string }>(
        `SELECT key, value FROM "UserPreference" ORDER BY key`
      )
      .all()
  )

beforeEach(async () => {
  testRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "score-at-once-user-settings-sync-")
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

describe("ショートカットの同期", () => {
  it("2台が別々の割り当てを直しても、両方の変更が残る", async () => {
    // 端末A は正解のキーを直す
    await onClient(prismaA, () =>
      setUserKeyboardShortcut(USER_ID, "scoring.correct", "Shift+z")
    )
    // 端末B は文字入れのキーを直す（A より後に保存する＝版は新しい）
    await onClient(prismaB, () =>
      setUserKeyboardShortcut(USER_ID, "tool.text", "Shift+t")
    )

    // 互いに1往復させる
    await syncRound("A 送出", syncA)
    await syncRound("B 取り込みと送出", syncB)
    await syncRound("A 取り込み", syncA)
    await syncRound("B 取り込み", syncB)

    // **どちらの変更も生き残る。** まとめて書いていた頃は、あとに保存した端末B の組が
    // 丸ごと勝ち、A が直した `scoring.correct` は既定へ戻っていた
    for (const [label, client] of [
      ["端末A", prismaA],
      ["端末B", prismaB],
    ] as const) {
      const shortcuts = await shortcutsOf(client)
      expect(shortcuts["scoring.correct"], label).toBe("Shift+z")
      expect(shortcuts["tool.text"], label).toBe("Shift+t")
      // 触っていない割り当ては行を持たない（既定のまま）
      expect(Object.keys(shortcuts).sort(), label).toEqual([
        "scoring.correct",
        "tool.text",
      ])
    }
  })

  it("同じ割り当てを2台が直したときは、あとの版が両方へ残る", async () => {
    await onClient(prismaA, () =>
      setUserKeyboardShortcut(USER_ID, "scoring.correct", "Shift+z")
    )
    await syncRound("A 送出", syncA)
    await syncRound("B 取り込み", syncB)

    // B があとから同じ割り当てを直す
    await onClient(prismaB, () =>
      setUserKeyboardShortcut(USER_ID, "scoring.correct", "Shift+x")
    )
    await syncRound("B 送出", syncB)
    await syncRound("A 取り込み", syncA)

    for (const [label, client] of [
      ["端末A", prismaA],
      ["端末B", prismaB],
    ] as const) {
      const shortcuts = await shortcutsOf(client)
      expect(shortcuts["scoring.correct"], label).toBe("Shift+x")
    }
  })
})

describe("利用者ごとの設定の同期", () => {
  it("2台が別々の設定を変えても、両方の変更が残る", async () => {
    await onClient(prismaA, () =>
      setUserPreference(USER_ID, "sidebarBehaviorExams", '"collapse"')
    )
    await onClient(prismaB, () =>
      setUserPreference(USER_ID, "scoringOperationMode", '"mouse"')
    )

    await syncRound("A 送出", syncA)
    await syncRound("B 取り込みと送出", syncB)
    await syncRound("A 取り込み", syncA)
    await syncRound("B 取り込み", syncB)

    for (const [label, dbPath] of [
      ["端末A", dbA],
      ["端末B", dbB],
    ] as const) {
      expect(preferenceRows(dbPath), label).toEqual([
        { key: "scoringOperationMode", value: '"mouse"' },
        { key: "sidebarBehaviorExams", value: '"collapse"' },
      ])
    }
  })
})
