import type { PrismaClient } from "@prisma/client"

import { pruneAuditLogs } from "./prisma/auditQuery"
import {
  createSharedPrismaClient,
  initializeDatabase,
} from "./prisma/databaseInitializer"
import { seedSampleData } from "./prisma/sampleSeed"
import {
  createBackup,
  restoreBackup,
  runBridgeMigration,
} from "./prisma/schema/bridgeMigrations"
import { deployPendingMigrations } from "./prisma/schema/migrationDeployer"
import { assertDatabaseNotNewerThanApp } from "./prisma/schema/migrationGuard"
import { detectSchemaVersion } from "./prisma/schema/versionDetector"
import { getStorageRoots } from "./storageRoots"

/**
 * データベースセットアップユーティリティ
 */
export class DatabaseSetup {
  private prisma: PrismaClient

  constructor() {
    // パッケージ化環境対応のPrismaクライアントを使用
    this.prisma = createSharedPrismaClient()
  }

  /**
   * データベースが空かどうかチェック
   */
  async isDatabaseEmpty(): Promise<boolean> {
    try {
      const userCount = await this.prisma.user.count()
      const classroomCount = await this.prisma.classroom.count()
      return userCount === 0 && classroomCount === 0
    } catch (error) {
      console.error("❌ Database content check failed:", error)
      return true // エラーの場合は空とみなす
    }
  }

  /**
   * 見本のデータ（シード）を入れる。中身は `./prisma/sampleSeed.ts`。
   *
   * **共有モードでは入れない。** 共有モードの DB は共有フォルダの事実から作った
   * 手元の控えで、ここで入れた行は同期で全員へ渡る。空の共有プロファイルの見本は、
   * プロファイルを作るときに1度だけ入れる（`sync/sharedProfileSetup.ts`）。
   */
  async runSeed(): Promise<void> {
    if (getStorageRoots().mode !== "local") return
    await seedSampleData(this.prisma)
  }

  /**
   * 未適用マイグレーションを適用する。
   *
   * deployPendingMigrations は独自の better-sqlite3 接続でDDLを実行するため、
   * 実行前に this.prisma を切断して同一DBファイルへの二重接続を避ける。
   * これにより DDL 実行中のロック競合と、失敗時のバックアップ復元（ファイル上書き）が
   * Windows で this.prisma のファイルロックに阻まれる問題を防ぐ。
   * this.prisma は次回クエリ時に自動再接続される。
   */
  private async runDeployPendingMigrations(): Promise<void> {
    await this.prisma.$disconnect()
    deployPendingMigrations()
  }

  /**
   * データベースの初期セットアップを実行
   */
  async setupIfNeeded(): Promise<boolean> {
    try {
      let setupPerformed = false

      // DBファイルの作成とスキーマ適用（判定はテーブルの有無に基づく）
      const result = initializeDatabase()

      if (result === "created") {
        // --- 新規DB ---
        // ベースラインを挿入（将来のprisma migrate用）
        const { createBaseline } =
          await import("./prisma/schema/baselineMigrations")
        await createBaseline(this.prisma)

        // 初期スキーマ以降の未適用マイグレーションを適用
        await this.runDeployPendingMigrations()

        await this.runSeed()
        setupPerformed = true
      } else {
        // --- 既存DB ---
        await this.migrateExistingDatabase()

        const isEmpty = await this.isDatabaseEmpty()
        if (isEmpty) {
          await this.runSeed()
          setupPerformed = true
        }
      }

      // 監査ログの保持期間プルーニング（ベストエフォート。失敗しても起動を妨げない）
      try {
        await pruneAuditLogs()
      } catch (pruneError) {
        console.error("Audit log pruning skipped:", pruneError)
      }

      return setupPerformed
    } catch (error) {
      console.error("❌ Database setup failed:", error)
      throw error
    } finally {
      await this.prisma.$disconnect()
    }
  }

  /**
   * 既存DBのマイグレーション: バージョン検出 → ブリッジ → ベースライン → 将来マイグレーション適用
   */
  private async migrateExistingDatabase(): Promise<void> {
    const version = await detectSchemaVersion(this.prisma)
    console.info(`Detected schema version: ${version}`)

    if (version === "UNKNOWN") {
      console.warn(
        "Unknown database schema version. Skipping migration to avoid data loss."
      )
      return
    }

    if (version === "MIGRATED") {
      // DBがアプリより新しい場合は書き込み前に起動を中止する
      await assertDatabaseNotNewerThanApp(this.prisma)

      // 既にPrisma管理下 — ベースラインが最新か確認
      const { ensureBaselineUpToDate } =
        await import("./prisma/schema/baselineMigrations")
      await ensureBaselineUpToDate(this.prisma)

      // 将来のマイグレーションのみ適用
      await this.runDeployPendingMigrations()
      return
    }

    // ブリッジマイグレーション実行（S3〜S9）
    const backupPath = createBackup()
    try {
      await runBridgeMigration(this.prisma, version)

      // ベースライン作成
      const { createBaseline } =
        await import("./prisma/schema/baselineMigrations")
      await createBaseline(this.prisma)

      // 将来のマイグレーション適用
      await this.runDeployPendingMigrations()

      console.info(
        `Database migrated from ${version} to current schema with Prisma baseline`
      )
    } catch (error) {
      console.error(`Bridge migration from ${version} failed:`, error)
      if (backupPath) {
        console.info("Restoring database from backup...")
        restoreBackup(backupPath)
      }
      throw error
    }
  }

  /**
   * データベース接続テスト
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.prisma.$connect()
      return true
    } catch (error) {
      console.error("❌ Database connection test failed:", error)
      return false
    } finally {
      await this.prisma.$disconnect()
    }
  }
}
