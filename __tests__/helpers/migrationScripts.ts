/**
 * migration のフォルダ（`<dir>/<名前>/migration.sql`）を、アプリが当てる形
 * （`MigrationScript` の一覧）にして読む。
 *
 * アプリは実行中にフォルダを読まず、束ねた一覧（`bundledMigrations.ts`）から当てる。
 * テストが合成した migration のフォルダを当てるときと、束ねた一覧がフォルダと一致して
 * いるかを確かめるときに使う。
 */
import * as fs from "fs"
import * as path from "path"

import type { MigrationScript } from "../../electron-src/lib/prisma/schema/migrationApplier"

/** アプリの `prisma/migrations` */
export const APP_MIGRATIONS_DIRECTORY = path.resolve(
  __dirname,
  "../../prisma/migrations"
)

/** `migration.sql` を持つフォルダだけを、名前の昇順に読む */
export const readMigrationScripts = (
  migrationsDirectory: string
): MigrationScript[] =>
  fs
    .readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) =>
      fs.existsSync(path.join(migrationsDirectory, name, "migration.sql"))
    )
    .sort()
    .map((name) => ({
      name,
      sql: fs.readFileSync(
        path.join(migrationsDirectory, name, "migration.sql"),
        "utf-8"
      ),
    }))
