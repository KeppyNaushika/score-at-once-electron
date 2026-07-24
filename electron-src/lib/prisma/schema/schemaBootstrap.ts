/**
 * 初期スキーマのブートストラップ
 *
 * SQLiteファイルを開き、テーブルが1つも無い「空のDB」にだけ初期スキーマを適用する。
 * 既に何らかのテーブルを持つDB（新規init直後・マイグレーション済み・レガシー等）は
 * すべて "existing" として扱い、バージョン検出やブリッジ移行は呼び出し側の
 * migrateExistingDatabase に委ねる。
 *
 * 設計上の約束:
 * - 判定はファイルの有無ではなく「テーブルの有無」で行う（存在確認と作成の競合を作らない）
 * - スキーマ適用はトランザクションで囲む（中断してもテーブルを半端に残さない）
 * - 既にテーブルを持つDBには一切書き込まない（データ破壊・スキーマ上書きをしない）
 */

import Database from "better-sqlite3"
import * as fs from "fs"
import * as path from "path"

import { countUserTables, type SqliteDatabase } from "../sqliteSchemaUtils"
import { INDEX_SQL, MIGRATION_SQL } from "./migrationSql"

/** ブートストラップの結果。created=初期スキーマを適用した、existing=既存DBだった */
export type SchemaBootstrapResult = "created" | "existing"

/** 初期スキーマをトランザクション内で適用する */
const applySchema = (db: SqliteDatabase): void => {
  db.transaction(() => {
    db.exec(MIGRATION_SQL)
    db.exec(INDEX_SQL)
  })()
}

/**
 * 指定パスのSQLiteに、必要なら初期スキーマを適用する。
 *
 * - テーブルが1つも無い「真に新規」のDB（ファイル無し／0バイト）に初期スキーマを適用し "created" を返す
 * - 既にテーブルを持つDBは一切変更せず "existing" を返す（移行判断は呼び出し側に委ねる）
 * - 既にヘッダを持つ非空ファイルなのにテーブルが0の場合は、-wal desync 等でデータを
 *   失った既存DBの可能性があるため**再初期化しない**（"existing" を返す）。ここで init を
 *   適用・seed すると喪失を隠蔽してしまうため、上位でエラーとして顕在化させる。
 */
export const bootstrapSchema = (dbPath: string): SchemaBootstrapResult => {
  const absolutePath = path.resolve(dbPath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true, mode: 0o755 })

  // 開く前に「既にデータを持ちうるファイルか」を判定する。
  // new Database() は 0 バイトのファイルにもヘッダを書くため、判定は必ず open 前に行う。
  const preexistingNonEmpty =
    fs.existsSync(absolutePath) && fs.statSync(absolutePath).size > 0

  // ファイルが存在しない場合はSQLiteが作成する。
  // -wal/-shm が残っていれば、この接続で自動的にリプレイされ既存テーブルが見える。
  const db = new Database(absolutePath)
  // 共有ドライブ（NAS）で他クライアントが一時的にロックしている場合に備える
  db.pragma("busy_timeout = 5000")

  try {
    if (countUserTables(db) > 0) return "existing"

    // テーブルが無い。真に新規（ファイル無し／0バイト）のときだけ init を適用する。
    // 既存の非空ファイルなのにテーブルが無いのは異常（desync 等）なので再初期化しない。
    if (preexistingNonEmpty) {
      console.warn(
        `Database file exists but contains no tables; refusing to reinitialize ` +
          `to avoid masking possible data loss (e.g. lost -wal sidecar): ${absolutePath}`
      )
      return "existing"
    }

    applySchema(db)
    return "created"
  } finally {
    db.close()
  }
}
