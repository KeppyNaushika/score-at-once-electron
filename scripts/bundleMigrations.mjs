#!/usr/bin/env node
/**
 * `prisma/migrations/<名前>/migration.sql` を読み、アプリのコードに束ねる一覧
 * （`electron-src/lib/prisma/schema/bundledMigrations.ts`）を書き出す。
 *
 * アプリは実行中に migration のフォルダを読まず、この一覧から当てる
 * （web 版にはフォルダを読む手段が無く、デスクトップ版も同じ部品を使うため）。
 * migration を足したら必ず実行する。忘れると規約テスト `bundledMigrations` が落ちる。
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

const prettierConfig = await prettier.resolveConfig(outputPath)
await fs.writeFile(
  outputPath,
  await prettier.format(source, { ...prettierConfig, filepath: outputPath })
)
console.log(
  `${path.relative(projectRoot, outputPath)}: ${migrations.length} migrations`
)
