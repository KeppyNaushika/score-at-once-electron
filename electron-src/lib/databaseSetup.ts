import type { PrismaClient } from "@prisma/client"

import { pruneAuditLogs } from "./prisma/auditQuery"
import {
  createSharedPrismaClient,
  initializeDatabase,
} from "./prisma/databaseInitializer"
import {
  createBackup,
  restoreBackup,
  runBridgeMigration,
} from "./prisma/schema/bridgeMigrations"
import { deployPendingMigrations } from "./prisma/schema/migrationDeployer"
import { assertDatabaseNotNewerThanApp } from "./prisma/schema/migrationGuard"
import { detectSchemaVersion } from "./prisma/schema/versionDetector"

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
   * シードデータを実行
   *
   * username / 学級名 / 学籍番号は unique ではないので upsert の鍵に取れない
   * （20260822140000_drop_human_name_uniques）。ここが問うているのは
   * 「同じ名前の行が既に在るか」という有無だけなので、findFirst で見て無ければ作る。
   * 旧 upsert も update は `{}`（在れば何もしない）だったので振る舞いは変わらず、
   * 2度走っても増えない。
   */
  async runSeed(): Promise<void> {
    try {
      // デフォルトユーザーの作成
      const existingAdmin = await this.prisma.user.findFirst({
        where: { username: "admin" },
      })
      if (!existingAdmin) {
        await this.prisma.user.create({
          data: {
            username: "admin",
            name: "管理者",
            role: "admin",
            passcodeType: "none",
          },
        })
      }

      // サンプル学級の作成
      const sampleClassroom =
        (await this.prisma.classroom.findFirst({
          where: { name: "サンプル学級" },
        })) ??
        (await this.prisma.classroom.create({
          data: {
            name: "サンプル学級",
            classroomCode: "SAMPLE01",
            grade: 1,
            description: "システム動作確認用のサンプル学級です",
            isVisible: true,
          },
        }))

      // サンプル生徒の作成
      const sampleStudents = [
        {
          studentNumber: "STU001",
          lastName: "山田",
          firstName: "太郎",
          lastNameKana: "ヤマダ",
          firstNameKana: "タロウ",
          enrollmentYear: new Date().getFullYear(),
        },
        {
          studentNumber: "STU002",
          lastName: "佐藤",
          firstName: "花子",
          lastNameKana: "サトウ",
          firstNameKana: "ハナコ",
          enrollmentYear: new Date().getFullYear(),
        },
        {
          studentNumber: "STU003",
          lastName: "田中",
          firstName: "次郎",
          lastNameKana: "タナカ",
          firstNameKana: "ジロウ",
          enrollmentYear: new Date().getFullYear(),
        },
      ]

      for (const [index, studentData] of sampleStudents.entries()) {
        const student =
          (await this.prisma.student.findFirst({
            where: { studentNumber: studentData.studentNumber },
          })) ?? (await this.prisma.student.create({ data: studentData }))

        // 学級への所属を作成（既存チェック後に作成）
        const existingMembership =
          await this.prisma.studentClassroomMembership.findFirst({
            where: {
              studentId: student.id,
              classroomId: sampleClassroom.id,
              endDate: null, // 現在有効な所属のみ
            },
          })

        if (!existingMembership) {
          await this.prisma.studentClassroomMembership.create({
            data: {
              studentId: student.id,
              classroomId: sampleClassroom.id,
              attendanceNumber: index + 1,
              startDate: new Date(),
            },
          })
        }
      }

      // サンプル小計グループの作成
      let mathSubtotalGroup = await this.prisma.subtotalGroup.findFirst({
        where: { name: "数学小計グループ" },
      })

      if (!mathSubtotalGroup) {
        mathSubtotalGroup = await this.prisma.subtotalGroup.create({
          data: {
            name: "数学小計グループ",
          },
        })
      }

      // サンプル小計項目の作成
      const mathSubtotals = [
        { name: "計算問題", order: 1 },
        { name: "文章題", order: 2 },
        { name: "図形問題", order: 3 },
      ]

      for (const subtotalData of mathSubtotals) {
        // 既存チェック後に作成（新しいスキーマではユニーク制約名が変更）
        const existingSubtotal = await this.prisma.subtotal.findFirst({
          where: {
            subtotalGroupId: mathSubtotalGroup.id,
            name: subtotalData.name,
          },
        })

        if (!existingSubtotal) {
          await this.prisma.subtotal.create({
            data: {
              ...subtotalData,
              subtotalGroupId: mathSubtotalGroup.id,
            },
          })
        }
      }
    } catch (error) {
      console.error("❌ Error during seed:", error)
      throw error
    }
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
