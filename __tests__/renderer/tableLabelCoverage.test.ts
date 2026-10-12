/**
 * 表の呼び名（src/lib/shared/tableLabels.ts）と schema.prisma の一致（convention-as-code）
 *
 * 呼び名は同期のトースト・同期の警告・監査ログの要約・統合アーカイブの画面が引く。
 * 載っていない表は表名（英語のモデル名）がそのまま利用者の目に出るので、モデルを足して
 * 呼び名を足し忘れたらここで止める。消したモデルの呼び名が残るのも止める。
 */

import * as fs from "fs"
import * as path from "path"
import { describe, expect, it } from "vitest"

import { TABLE_LABELS } from "@/lib/shared/tableLabels"

/** schema.prisma のモデル名 */
function modelNamesFromSchema(): string[] {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "prisma/schema.prisma"),
    "utf8"
  )
  return [...source.matchAll(/^model\s+(\w+)\s*\{/gm)].map(
    (modelMatch) => modelMatch[1]
  )
}

describe("表の呼び名と schema.prisma の一致", () => {
  const modelNames = modelNamesFromSchema()

  it("schema.prisma の全モデルに呼び名がある", () => {
    const missingModels = modelNames.filter(
      (modelName) => !(modelName in TABLE_LABELS)
    )
    expect(missingModels).toEqual([])
  })

  it("schema.prisma に無い表の呼び名が残っていない", () => {
    const modelNameSet = new Set(modelNames)
    const staleTables = Object.keys(TABLE_LABELS).filter(
      (tableName) => !modelNameSet.has(tableName)
    )
    expect(staleTables).toEqual([])
  })

  it("呼び名が空でなく、表名のままでもない", () => {
    const untranslatedTables = Object.entries(TABLE_LABELS)
      .filter(
        ([tableName, label]) => label.trim() === "" || label === tableName
      )
      .map(([tableName]) => tableName)
    expect(untranslatedTables).toEqual([])
  })
})
