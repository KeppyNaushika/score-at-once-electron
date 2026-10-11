/**
 * 規約テスト: アプリに束ねた migration（`bundledMigrations.ts`）が `prisma/migrations/` と一致する
 *
 * アプリは実行中にフォルダを読まず、束ねた一覧から当てる。migration を足して
 * `node scripts/bundleMigrations.mjs` を忘れると、新しい migration はどの DB にも当たらない
 * （開発中も配布物も）。ここで止める。
 */
import { describe, expect, it } from "vitest"

import { BUNDLED_MIGRATIONS } from "../../electron-src/lib/prisma/schema/bundledMigrations"
import {
  APP_MIGRATIONS_DIRECTORY,
  readMigrationScripts,
} from "../helpers/migrationScripts"

const REGENERATE = "node scripts/bundleMigrations.mjs を実行して作り直す"

describe("束ねた migration", () => {
  const folderMigrations = readMigrationScripts(APP_MIGRATIONS_DIRECTORY)

  it(`名前と並びがフォルダと同じ（違えば ${REGENERATE}）`, () => {
    expect(BUNDLED_MIGRATIONS.map((migration) => migration.name)).toEqual(
      folderMigrations.map((migration) => migration.name)
    )
  })

  it(`SQL の本文がフォルダと1文字も違わない（違えば ${REGENERATE}）`, () => {
    const bundledSqlByName = new Map(
      BUNDLED_MIGRATIONS.map((migration) => [migration.name, migration.sql])
    )
    for (const { name, sql } of folderMigrations) {
      expect(bundledSqlByName.get(name), name).toBe(sql)
    }
  })
})
