/**
 * Vitestグローバルセットアップ（1回だけ実行）
 *
 * テスト用SQLiteデータベースの作成とマイグレーション
 */

import { execSync } from "child_process"
import * as fs from "fs"
import * as path from "path"

const TEST_DB_PATH = path.resolve(__dirname, "../data/test-database.db")

export async function setup() {
  // テスト用DBが既に存在する場合は削除
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const p = TEST_DB_PATH + suffix
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }

  // テスト用DBのディレクトリを確認
  const dbDir = path.dirname(TEST_DB_PATH)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  // prisma db pushでテスト用DBを作成（スキーマ全体を反映）
  // migrate deployではマイグレーション未作成のテーブルが欠落するため、db pushを使用
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      DATABASE_URL: `file:${TEST_DB_PATH}`,
    },
    stdio: "pipe",
  })
}

export async function teardown() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const p = TEST_DB_PATH + suffix
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p)
      } catch {
        // ignore
      }
    }
  }
}
