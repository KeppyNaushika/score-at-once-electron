/**
 * 統合アーカイブの登録表（archiveTableRegistry.ts）と schema.prisma の一致（convention-as-code）
 *
 * 範囲の規則は、表ごとの役割と外部キーをこの登録表から取る。schema にモデルや `@relation` を
 * 足して登録表に足し忘れると、書き出しが黙ってその表や参照を取りこぼす。ここで止める。
 *
 * 外部キーは DB からではなく schema.prisma から読む。DB の制約は migration の書き方次第で schema と
 * ずれうる（GradeDataSource の courseworkId / courseworkItemId は 20261004130000 で直すまで本番だけ
 * 制約が無かった。ずれの検知は freshInstallChain.test.ts）。
 */

import * as fs from "fs"
import * as path from "path"
import { describe, expect, it } from "vitest"

import {
  ARCHIVE_ROOT_TABLES,
  ARCHIVE_TABLES,
} from "../../../electron-src/lib/export/unified-archive/archiveTableRegistry"

interface SchemaReference {
  column: string
  table: string
  required: boolean
}

/** schema.prisma のモデル名 → 外部キーを持つ側の `@relation`（列・参照先・必須か） */
function referencesFromSchema(): Map<string, SchemaReference[]> {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "prisma/schema.prisma"),
    "utf8"
  )
  const modelPattern = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm
  const referencesByModel = new Map<string, SchemaReference[]>()
  for (const modelMatch of source.matchAll(modelPattern)) {
    const references: SchemaReference[] = []
    for (const line of modelMatch[2].split("\n")) {
      // 例: "  exam  Exam?  @relation(fields: [examId], references: [id], onDelete: SetNull)"
      const relationMatch = line.match(
        /^\s*\w+\s+(\w+)(\??)\s+@relation\(([^)]*)\)/
      )
      if (!relationMatch) continue
      const fieldsMatch = relationMatch[3].match(/fields:\s*\[([^\]]*)\]/)
      if (!fieldsMatch) continue
      references.push({
        column: fieldsMatch[1].trim(),
        table: relationMatch[1],
        required: relationMatch[2] !== "?",
      })
    }
    referencesByModel.set(modelMatch[1], references)
  }
  return referencesByModel
}

const sortReferences = (references: readonly SchemaReference[]) =>
  [...references]
    .map(({ column, table, required }) => ({ column, table, required }))
    .sort((left, right) => left.column.localeCompare(right.column))

describe("統合アーカイブの登録表", () => {
  const schemaReferences = referencesFromSchema()

  it("schema.prisma の全モデルが登録されていて、余分な表も無い", () => {
    expect(Object.keys(ARCHIVE_TABLES).sort()).toEqual(
      [...schemaReferences.keys()].sort()
    )
  })

  it("各表の外部キー（列・参照先・必須か）が schema.prisma と一致する", () => {
    for (const [table, references] of schemaReferences) {
      expect(
        sortReferences(ARCHIVE_TABLES[table]?.references ?? []),
        table
      ).toEqual(sortReferences(references))
    }
  })

  it("親（owner）の列は、その表の外部キーのどれかである", () => {
    for (const [table, spec] of Object.entries(ARCHIVE_TABLES)) {
      const columns = spec.references.map((reference) => reference.column)
      for (const ownerColumn of spec.owner ?? []) {
        expect(columns, `${table}.${ownerColumn}`).toContain(ownerColumn)
      }
    }
  })

  it("owned の表は親を持ち、root と shared は持たない", () => {
    for (const [table, spec] of Object.entries(ARCHIVE_TABLES)) {
      if (spec.role === "owned") {
        expect(spec.owner?.length ?? 0, table).toBeGreaterThan(0)
      }
      if (spec.role === "root" || spec.role === "shared") {
        expect(spec.owner, table).toBeUndefined()
      }
    }
  })

  it("root の表は利用者が選ぶ4種と一致する", () => {
    const roots = Object.entries(ARCHIVE_TABLES)
      .filter(([, spec]) => spec.role === "root")
      .map(([table]) => table)
      .sort()
    expect(roots).toEqual([...ARCHIVE_ROOT_TABLES].sort())
  })

  it("解析が機能していることの保証（GradeDataSource は外部キーを6本持つ）", () => {
    // 解析が壊れて空になると、上の一致検査が空どうしで通ってしまう
    expect(schemaReferences.get("GradeDataSource")?.length).toBe(6)
  })
})
