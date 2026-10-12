#!/usr/bin/env node
/**
 * `prisma/migrations/<名前>/migration.sql` を読み、アプリのコードに束ねる一覧
 * （`electron-src/lib/prisma/schema/bundledMigrations.ts`）を書き出す。
 *
 * アプリは実行中に migration のフォルダを読まず、この一覧から当てる
 * （web 版にはフォルダを読む手段が無く、デスクトップ版も同じ部品を使うため）。
 * migration を足したら必ず実行する。忘れると規約テスト `bundledMigrations` が落ちる。
 *
 * あわせて `prisma/schema.prisma` から、表ごとの列の型の一覧
 * （`electron-src/lib/import/unified-archive/archiveColumnTypes.ts`）も書き出す。統合アーカイブ（.sao）を
 * 開くとき、取り込む行の値がこの型に合うかを確かめる（`archiveColumnTypeGuards.ts`）。スキーマを
 * 変えたら migration と一緒に作り直すので、同じスクリプトで書く。忘れると規約テスト
 * `unifiedArchiveColumnTypes` が落ちる。
 *
 *   node scripts/bundleMigrations.mjs
 */
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as url from "node:url"
import * as prettier from "prettier"

const projectRoot = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  ".."
)
const migrationsDirectory = path.join(projectRoot, "prisma/migrations")
const outputPath = path.join(
  projectRoot,
  "electron-src/lib/prisma/schema/bundledMigrations.ts"
)

const entries = await fs.readdir(migrationsDirectory, { withFileTypes: true })
const migrationNames = entries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

const migrations = await Promise.all(
  migrationNames.map(async (name) => ({
    name,
    sql: await fs.readFile(
      path.join(migrationsDirectory, name, "migration.sql"),
      "utf-8"
    ),
  }))
)

const source = `/**
 * アプリに束ねたマイグレーションの一覧（名前の昇順）。
 *
 * **自動生成。手で書き換えない。** \`prisma/migrations/\` から \`node scripts/bundleMigrations.mjs\`
 * で作る。フォルダと一致していることは規約テスト \`bundledMigrations\` が縛る。
 */

import type { MigrationScript } from "./migrationApplier"

export const BUNDLED_MIGRATIONS: readonly MigrationScript[] = [
${migrations
  .map(
    ({ name, sql }) =>
      `  { name: ${JSON.stringify(name)}, sql: ${JSON.stringify(sql)} },`
  )
  .join("\n")}
]
`

const writeFormatted = async (filePath, fileSource) => {
  const prettierConfig = await prettier.resolveConfig(filePath)
  await fs.writeFile(
    filePath,
    await prettier.format(fileSource, { ...prettierConfig, filepath: filePath })
  )
}

await writeFormatted(outputPath, source)
console.log(
  `${path.relative(projectRoot, outputPath)}: ${migrations.length} migrations`
)

// ── 列の型の一覧 ─────────────────────────────────────────

const schemaPath = path.join(projectRoot, "prisma/schema.prisma")
const columnTypesPath = path.join(
  projectRoot,
  "electron-src/lib/import/unified-archive/archiveColumnTypes.ts"
)

/** Prisma のスカラー型（SQLite で使えるもの） */
const SCALAR_TYPES = new Set([
  "String",
  "Int",
  "BigInt",
  "Float",
  "Decimal",
  "Boolean",
  "DateTime",
  "Json",
  "Bytes",
])

const schemaSource = await fs.readFile(schemaPath, "utf-8")
const modelPattern = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm
const modelBlocks = [...schemaSource.matchAll(modelPattern)].map(
  (modelMatch) => ({ model: modelMatch[1], body: modelMatch[2] })
)
const modelNames = new Set(modelBlocks.map((modelBlock) => modelBlock.model))
if (/^enum\s/m.test(schemaSource)) {
  // enum は値の集合まで縛る必要がある。足すときに、ここと検査の側を作る
  throw new Error(
    "schema.prisma の enum には、列の型の一覧がまだ対応していない"
  )
}

const columnTypesByModel = modelBlocks.map(({ model, body }) => {
  if (/^\s*@@map\b/m.test(body)) {
    throw new Error(`${model}: @@map には、列の型の一覧がまだ対応していない`)
  }
  const columns = []
  for (const line of body.split("\n")) {
    // 例: "  imagePath  String?  @default(...)"（`///` の注釈と `@@` の行は当たらない）
    const fieldMatch = line.match(/^\s*(\w+)\s+(\w+)(\[\]|\?)?(?=\s|$)/)
    if (!fieldMatch) continue
    const [, column, fieldType, modifier] = fieldMatch
    if (modelNames.has(fieldType)) continue
    if (!SCALAR_TYPES.has(fieldType)) {
      throw new Error(`${model}.${column}: 知らない型 ${fieldType}`)
    }
    if (modifier === "[]") {
      throw new Error(`${model}.${column}: スカラーの配列は SQLite に無い`)
    }
    if (/@map\(/.test(line)) {
      throw new Error(
        `${model}.${column}: @map には、列の型の一覧がまだ対応していない`
      )
    }
    columns.push({
      column,
      type: modifier === "?" ? `${fieldType}?` : fieldType,
    })
  }
  return { model, columns }
})

const columnTypesSource = `/**
 * 表ごとの列の型（Prisma のスカラー型。末尾の \`?\` は NULL を許す）。
 *
 * **自動生成。手で書き換えない。** \`prisma/schema.prisma\` から \`node scripts/bundleMigrations.mjs\`
 * で作る。スキーマと一致していることは規約テスト \`unifiedArchiveColumnTypes\` が縛る。
 * 統合アーカイブ（.sao）を開くとき、行の値がこの型に合うかを確かめる（\`archiveColumnTypeGuards.ts\`）。
 */

/** Prisma のスカラー型 */
export type ArchiveScalarType =
${[...SCALAR_TYPES].map((scalarType) => `  | ${JSON.stringify(scalarType)}`).join("\n")}

/** 列の型。末尾の "?" は NULL を許す */
export type ArchiveColumnType = ArchiveScalarType | \`\${ArchiveScalarType}?\`

export const ARCHIVE_COLUMN_TYPES: Readonly<
  Record<string, Readonly<Record<string, ArchiveColumnType>>>
> = {
${columnTypesByModel
  .map(
    ({ model, columns }) =>
      `  ${model}: {\n${columns
        .map(({ column, type }) => `    ${column}: ${JSON.stringify(type)},`)
        .join("\n")}\n  },`
  )
  .join("\n")}
}
`

await writeFormatted(columnTypesPath, columnTypesSource)
console.log(
  `${path.relative(projectRoot, columnTypesPath)}: ${columnTypesByModel.length} tables`
)
