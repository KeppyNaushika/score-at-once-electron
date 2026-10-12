/**
 * 統合アーカイブの列の型の一覧（archiveColumnTypes.ts）と schema.prisma の一致（convention-as-code）と、
 * 型ごとの値の守り（archiveColumnTypeGuards.ts）
 *
 * 一覧は `node scripts/bundleMigrations.mjs` が schema.prisma から作る。スキーマに列を足して
 * 作り直し忘れると、足した列の値を確かめずに取り込む。ここで止める。一覧の作り方（スクリプト）
 * とは別に、ここで schema.prisma を読み直して比べる。
 */

import Database from "better-sqlite3"
import * as fs from "fs"
import * as path from "path"
import { afterAll, describe, expect, it } from "vitest"

import { ARCHIVE_TABLES } from "../../../electron-src/lib/export/unified-archive/archiveTableRegistry"
import { columnTypeMismatchSql } from "../../../electron-src/lib/import/unified-archive/archiveColumnTypeGuards"
import {
  ARCHIVE_COLUMN_TYPES,
  type ArchiveColumnType,
} from "../../../electron-src/lib/import/unified-archive/archiveColumnTypes"

const REGENERATE = "node scripts/bundleMigrations.mjs を実行して作り直す"

/** schema.prisma のモデル名 → スカラーの列名 → 型（NULL を許すなら末尾に "?"） */
function scalarColumnsFromSchema(): Record<string, Record<string, string>> {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "prisma/schema.prisma"),
    "utf8"
  )
  const modelPattern = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm
  const modelMatches = [...source.matchAll(modelPattern)]
  const modelNames = new Set(modelMatches.map((modelMatch) => modelMatch[1]))
  return Object.fromEntries(
    modelMatches.map((modelMatch) => {
      const columns: Record<string, string> = {}
      for (const line of modelMatch[2].split("\n")) {
        // 例: "  partialScore  Decimal?"（関連の列と、モデルの配列の列は除く）
        const fieldMatch = line.match(/^\s*(\w+)\s+(\w+)(\?|\[\])?(?:\s|$)/)
        if (!fieldMatch || modelNames.has(fieldMatch[2])) continue
        columns[fieldMatch[1]] = `${fieldMatch[2]}${fieldMatch[3] ?? ""}`
      }
      return [modelMatch[1], columns]
    })
  )
}

describe("統合アーカイブの列の型の一覧", () => {
  it(`schema.prisma の全モデルの全スカラー列と、型・NULL を許すかが一致する（違えば ${REGENERATE}）`, () => {
    expect(ARCHIVE_COLUMN_TYPES).toEqual(scalarColumnsFromSchema())
  })

  it("表は登録表（archiveTableRegistry.ts）と同じ", () => {
    expect(Object.keys(ARCHIVE_COLUMN_TYPES).sort()).toEqual(
      Object.keys(ARCHIVE_TABLES).sort()
    )
  })

  it("解析が機能していることの保証", () => {
    // 解析が壊れて空になると、上の一致検査が空どうしで通ってしまう
    expect(ARCHIVE_COLUMN_TYPES.QuestionScore?.partialScore).toBe("Decimal?")
    expect(ARCHIVE_COLUMN_TYPES.Exam?.markerCorrectionEnabled).toBe("Boolean")
    expect(ARCHIVE_COLUMN_TYPES.Exam?.createdAt).toBe("DateTime")
  })
})

describe("列の型ごとの値の守り", () => {
  // 型の宣言の無い列は、入れた値の形をそのまま持つ（アーカイブの DB は外から来るので、
  // 宣言された型による変換に頼れない）
  const db = new Database(":memory:")
  afterAll(() => db.close())

  const isMismatch = (columnType: ArchiveColumnType, valueSql: string) => {
    const row = db
      .prepare<[], { mismatch: number }>(
        `SELECT ${columnTypeMismatchSql("value", columnType)} AS mismatch
         FROM (SELECT ${valueSql} AS "value")`
      )
      .get()
    return row?.mismatch === 1
  }

  it.each<[ArchiveColumnType, string]>([
    ["String", "'名前'"],
    ["String", "''"],
    ["String?", "NULL"],
    ["Int", "3"],
    ["Int?", "NULL"],
    ["Float", "1.5"],
    ["Float", "2"],
    ["Decimal", "0.25"],
    ["Decimal", "10"],
    ["Decimal?", "NULL"],
    ["Boolean", "0"],
    ["Boolean", "1"],
    ["DateTime", "'2026-10-04T00:00:00.000Z'"],
    ["DateTime", "'2026-10-04T00:00:00.000+00:00'"],
    ["DateTime", "'2026-10-04 00:00:00'"],
    ["DateTime", "1759536000000"],
    ["DateTime?", "NULL"],
    ["Json", "'{}'"],
    ["Bytes", "X'00'"],
  ])("%s に %s は通す", (columnType, valueSql) => {
    expect(isMismatch(columnType, valueSql)).toBe(false)
  })

  it.each<[ArchiveColumnType, string]>([
    ["String", "NULL"],
    ["String", "1"],
    ["String", "X'41'"],
    ["Int", "'1'"],
    ["Int", "1.5"],
    ["Int", "NULL"],
    ["Float", "'1.5'"],
    ["Float", "9e999"],
    ["Decimal", "'abc'"],
    ["Decimal", "-9e999"],
    ["Boolean", "2"],
    ["Boolean", "'true'"],
    ["Boolean", "0.5"],
    ["DateTime", "'yesterday'"],
    ["DateTime", "1.5"],
    ["DateTime", "X'00'"],
    ["Json", "1"],
    ["Bytes", "'00'"],
  ])("%s に %s は断る", (columnType, valueSql) => {
    expect(isMismatch(columnType, valueSql)).toBe(true)
  })
})
