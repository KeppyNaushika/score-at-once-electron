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
  // better-sqlite3 を素のNode（テスト実行ランタイム）のABIに合わせる。
  // npm run dev 後は Electron向けにビルドされているため、ここで Node向けに戻す。
  // 必要なときだけリビルドする冪等スクリプト。
  execSync("node scripts/ensure-sqlite-abi.js node", {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
  })

  // テスト用DBが既に存在する場合は削除
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const dbFilePath = TEST_DB_PATH + suffix
    if (fs.existsSync(dbFilePath)) fs.unlinkSync(dbFilePath)
  }

  // テスト用DBのディレクトリを確認
  const dbDir = path.dirname(TEST_DB_PATH)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  // prisma db pushでテスト用DBを作成（スキーマ全体を反映）
  // migrate deployではマイグレーション未作成のテーブルが欠落するため、db pushを使用
  // Prisma 7では DATABASE_URL 環境変数が自動参照されないため --url で明示
  execSync(`npx prisma db push --url=file:${TEST_DB_PATH} --accept-data-loss`, {
    cwd: path.resolve(__dirname, ".."),
    stdio: "pipe",
  })
}

export async function teardown() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const dbFilePath = TEST_DB_PATH + suffix
    if (fs.existsSync(dbFilePath)) {
      try {
        fs.unlinkSync(dbFilePath)
      } catch {
        // ignore
      }
    }
  }
}
