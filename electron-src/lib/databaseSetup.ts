import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

import {
  createSharedPrismaClient,
  getDatabasePath,
} from "./prisma/databaseInitializer"

/**
 * データベースセットアップユーティリティ
 */
export class DatabaseSetup {
  private prisma: PrismaClient
  private dbPath: string

  constructor() {
    // パッケージ化環境対応のPrismaクライアントを使用
    this.prisma = createSharedPrismaClient()
    this.dbPath = getDatabasePath()
  }

  /**
   * データベースファイルが存在するかチェック
   */
  isDatabaseExists(): boolean {
    const absolutePath = path.resolve(this.dbPath)
    try {
      return fs.existsSync(absolutePath)
    } catch (error) {
      console.error(`❌ Error checking database existence:`, error)
      return false
    }
  }

  /**
   * データベースが空かどうかチェック
   */
  async isDatabaseEmpty(): Promise<boolean> {
    try {
      const userCount = await this.prisma.user.count()
      const classCount = await this.prisma.class.count()
      return userCount === 0 && classCount === 0
    } catch (error) {
      console.error("❌ Database content check failed:", error)
      return true // エラーの場合は空とみなす
    }
  }

  /**
   * データベースディレクトリを作成
   */
  ensureDatabaseDirectory(): void {
    const dbDir = path.dirname(path.resolve(this.dbPath))
    try {
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true, mode: 0o755 })
      }
    } catch (error) {
      console.error(`❌ Failed to create database directory: ${dbDir}`, error)
      throw new Error(
        `Database directory creation failed: ${error instanceof Error ? error.message : error}`
      )
    }
  }

  /**
   * シードデータを実行
   */
  async runSeed(): Promise<void> {
    try {
      // デフォルトユーザーの作成
      await this.prisma.user.upsert({
        where: { username: "admin" },
        update: {},
        create: {
          username: "admin",
          name: "管理者",
          role: "admin",
          passcodeType: "none",
        },
      })

      // サンプル学級の作成
      const sampleClass = await this.prisma.class.upsert({
        where: { name: "サンプル学級" },
        update: {},
        create: {
          name: "サンプル学級",
          classCode: "SAMPLE01",
          grade: 1,
          description: "システム動作確認用のサンプル学級です",
          isVisible: true,
        },
      })

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
        const student = await this.prisma.student.upsert({
          where: { studentNumber: studentData.studentNumber },
          update: {},
          create: studentData,
        })

        // 学級への所属を作成（既存チェック後に作成）
        const existingMembership =
          await this.prisma.studentClassMembership.findFirst({
            where: {
              studentId: student.id,
              classId: sampleClass.id,
              endDate: null, // 現在有効な所属のみ
            },
          })

        if (!existingMembership) {
          await this.prisma.studentClassMembership.create({
            data: {
              studentId: student.id,
              classId: sampleClass.id,
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
   * データベースの初期セットアップを実行
   */
  async setupIfNeeded(): Promise<boolean> {
    try {
      const dbExists = this.isDatabaseExists()
      let setupPerformed = false

      if (!dbExists) {
        // データベースディレクトリを確保
        this.ensureDatabaseDirectory()

        // databaseInitializerを使用してスキーマを作成
        const { initializeDatabase } =
          await import("./prisma/databaseInitializer")
        const wasCreated = await initializeDatabase()

        if (wasCreated) {
          // 新しく作成されたDBにシードデータを投入
          await this.runSeed()
          setupPerformed = true
        }
      } else {
        // 既存DBにスキーママイグレーションを適用
        const { migrateExistingDatabase } =
          await import("./prisma/schema/migrationRunner")
        await migrateExistingDatabase()

        const isEmpty = await this.isDatabaseEmpty()
        if (isEmpty) {
          await this.runSeed()
          setupPerformed = true
        }
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
