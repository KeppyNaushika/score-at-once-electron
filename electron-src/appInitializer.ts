import {
  initializeDataDirectory,
  migrateProjectsToExams,
} from "./lib/dataManager"
import { getPrismaClient } from "./lib/prisma/client"
import {
  checkDatabaseHealth,
  optimizeDatabaseForSharedDrive,
} from "./lib/prisma/databaseHealth"
import { initializeSync } from "./lib/sync/syncService"

// DB内の imagePath を projects/ → exams/ に一括更新（v0.6.x リネーム対応）
async function migrateImagePathsInDatabase(): Promise<void> {
  try {
    const prisma = getPrismaClient()

    // 模範解答画像は ExamPage が持つ（旧 MasterImage テーブルは畳んで廃止済み）。
    // この関数はマイグレーション適用後に走るので、旧テーブルを引いてはいけない
    const [masterResult, answerResult] = await prisma.$transaction([
      prisma.$executeRawUnsafe(
        `UPDATE "ExamPage" SET "imagePath" = 'exams/' || SUBSTR("imagePath", LENGTH('projects/') + 1) WHERE "imagePath" LIKE 'projects/%'`
      ),
      prisma.$executeRawUnsafe(
        `UPDATE "StudentAnswerImage" SET "imagePath" = 'exams/' || SUBSTR("imagePath", LENGTH('projects/') + 1) WHERE "imagePath" LIKE 'projects/%'`
      ),
    ])

    if (masterResult > 0 || answerResult > 0) {
      console.log(
        `Migrated imagePath in DB: ExamPage=${masterResult}, StudentAnswerImage=${answerResult}`
      )
    }
  } catch (error) {
    console.error("Failed to migrate imagePath in database:", error)
  }
}

export async function initializeApp(): Promise<void> {
  try {
    // データディレクトリの初期化
    await initializeDataDirectory()

    // data/projects/ → data/exams/ マイグレーション（v0.6.x リネーム対応）
    const migrated = await migrateProjectsToExams()
    if (migrated) {
      console.log("Migrated data/projects/ → data/exams/")
    }

    // データベースの初期化とセットアップ
    try {
      const { DatabaseSetup } = await import("./lib/databaseSetup")
      const dbSetup = new DatabaseSetup()

      const wasSetupRequired = await dbSetup.setupIfNeeded()

      if (wasSetupRequired) {
        console.log("Database initialized and seeded successfully")
      } else {
        console.log("Database already exists and is ready")
      }
    } catch (dbError) {
      console.error("Database setup failed:", dbError)
      throw new Error(
        `Database initialization failed: ${dbError instanceof Error ? dbError.message : dbError}`,
        { cause: dbError }
      )
    }

    // DB内の imagePath を projects/ → exams/ に更新（v0.6.x リネーム対応）
    await migrateImagePathsInDatabase()

    // 共有ドライブ用の最適化
    await optimizeDatabaseForSharedDrive()

    // データベース接続テスト
    const isHealthy = await checkDatabaseHealth()

    if (!isHealthy) {
      throw new Error("Database health check failed")
    }

    // NAS同期の初期化（DBが準備完了してから）
    try {
      await initializeSync()
    } catch (syncError) {
      // sync初期化失敗はアプリ起動を妨げない
      console.warn("Sync initialization failed (non-critical):", syncError)
    }

    console.log("Application initialization completed successfully")
  } catch (error) {
    console.error("Failed to initialize application:", error)
    // アプリケーションを終了させるのではなく、エラー状態を明確にする
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Application initialization failed: ${errorMessage}`, {
      cause: error,
    })
  }
}
