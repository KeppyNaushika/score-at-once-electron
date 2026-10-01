/**
 * 20261002120000_drop_superseded_and_default_keyboard_shortcuts のデータ移行テスト
 *
 * 設定の保存は、かつて画面が持っている割り当て全部をまとめて書いていたので、キーを
 * 1つでも直した利用者の行には既定が焼き込まれている。このマイグレーションは
 * それを1回だけ片付け、`resolveKeyBindings` が読み込みのたびにしていた旧既定の
 * 読み替えを、同じ条件のまま DB の側へ移す。
 *
 * 検証すること:
 * - 旧既定のまま重なっている2つ（Wマーク t と文字ツール、ズームを戻す 0 と部分点の 0）と、
 *   対になるフィルタ（Alt+t）が消える（行が無ければ新しい既定が効く）
 * - 重なっていなければ（相手のキーを利用者が変えていれば）旧既定の値でも残す
 * - 移す先の既定キーを別のコマンドが使っていれば消さない。部分点の入力欄の中だけで
 *   効くコマンド（modal.*）とは同じキーでよいので、相手に数えない
 * - 利用者が自分で変えたフィルタのキーは残す
 * - 既定と同じ値の行はすべて消え、既定と違う値の行は残る
 */
import Database from "better-sqlite3"
import * as fs from "fs"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

type SqliteDatabase = InstanceType<typeof Database>

const MIGRATION_SQL = fs.readFileSync(
  path.resolve(
    __dirname,
    "../../prisma/migrations/20261002120000_drop_superseded_and_default_keyboard_shortcuts/migration.sql"
  ),
  "utf-8"
)

let db: SqliteDatabase

beforeEach(() => {
  db = new Database(":memory:")
  db.exec(`
    CREATE TABLE "UserKeyboardShortcut" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );
    CREATE UNIQUE INDEX "UserKeyboardShortcut_userId_action_key"
      ON "UserKeyboardShortcut"("userId", "action");
  `)
})

afterEach(() => {
  db.close()
})

const insertBindings = (
  userId: string,
  bindings: Record<string, string>
): void => {
  const insert = db.prepare(
    `INSERT INTO "UserKeyboardShortcut" ("id", "userId", "action", "key", "updatedAt")
     VALUES (?, ?, ?, ?, '2026-08-01T00:00:00.000Z')`
  )
  for (const [action, key] of Object.entries(bindings)) {
    insert.run(`${userId}:${action}`, userId, action, key)
  }
}

const bindingsOf = (userId: string): Record<string, string> =>
  Object.fromEntries(
    (
      db
        .prepare(
          `SELECT "action", "key" FROM "UserKeyboardShortcut" WHERE "userId" = ?`
        )
        .all(userId) as { action: string; key: string }[]
    ).map((row) => [row.action, row.key])
  )

describe("20261002120000_drop_superseded_and_default_keyboard_shortcuts", () => {
  it("旧既定のまま重なっている割り当てと対のフィルタ、既定と同じ値の行を消す", () => {
    insertBindings("user-a", {
      "scoring.doubleMark": "t",
      "tool.text": "t",
      "filter.toggleDoubleMark": "Alt+t",
      "navigation.resetZoom": "0",
      "scoring.openPartialWith0": "0",
      "scoring.correct": "e",
      "scoring.incorrect": "i",
    })

    db.exec(MIGRATION_SQL)

    // 残るのは既定と違う値の1行だけ
    expect(bindingsOf("user-a")).toEqual({ "scoring.incorrect": "i" })
  })

  it("相手のキーを利用者が変えていれば、旧既定の値でも残す", () => {
    insertBindings("user-b", {
      "scoring.doubleMark": "t",
      "tool.text": "k",
      "filter.toggleDoubleMark": "Alt+t",
      "navigation.resetZoom": "0",
      "scoring.openPartialWith0": "9",
    })

    db.exec(MIGRATION_SQL)

    expect(bindingsOf("user-b")).toEqual({
      "scoring.doubleMark": "t",
      "tool.text": "k",
      "filter.toggleDoubleMark": "Alt+t",
      "navigation.resetZoom": "0",
      "scoring.openPartialWith0": "9",
    })
  })

  it("相手の行が無ければ相手の既定（t / 0）と比べる", () => {
    insertBindings("user-c", {
      "scoring.doubleMark": "t",
      "navigation.resetZoom": "0",
    })

    db.exec(MIGRATION_SQL)

    expect(bindingsOf("user-c")).toEqual({})
  })

  it("移す先の既定キーを別のコマンドが使っていれば消さない（modal.* は相手に数えない）", () => {
    insertBindings("user-d", {
      "scoring.doubleMark": "t",
      "scoring.noAnswer": "u",
      "navigation.resetZoom": "0",
      "modal.input1": "z",
    })

    db.exec(MIGRATION_SQL)

    expect(bindingsOf("user-d")).toEqual({
      "scoring.doubleMark": "t",
      "scoring.noAnswer": "u",
      "modal.input1": "z",
    })
  })

  it("Wマークだけ移し、利用者が自分で変えたフィルタのキーは残す", () => {
    insertBindings("user-e", {
      "scoring.doubleMark": "t",
      "filter.toggleDoubleMark": "Alt+w",
    })

    db.exec(MIGRATION_SQL)

    expect(bindingsOf("user-e")).toEqual({ "filter.toggleDoubleMark": "Alt+w" })
  })

  it("Wマークが移らないときは、旧既定のままのフィルタも移さない", () => {
    insertBindings("user-f", {
      "scoring.doubleMark": "t",
      "scoring.noAnswer": "u",
      "filter.toggleDoubleMark": "Alt+t",
    })

    db.exec(MIGRATION_SQL)

    expect(bindingsOf("user-f")["filter.toggleDoubleMark"]).toBe("Alt+t")
  })
})
