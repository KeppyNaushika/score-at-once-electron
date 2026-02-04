/**
 * Vitestファイルレベルセットアップ
 *
 * 各テストファイルで読み込まれ、テスト用環境変数を設定する
 */

import * as path from "path"

const TEST_DB_PATH = path.resolve(__dirname, "../data/test-database.db")

// テスト用環境変数を設定
process.env.DATABASE_URL = `file:${TEST_DB_PATH}`
;(process.env as Record<string, string>).NODE_ENV = "test"
