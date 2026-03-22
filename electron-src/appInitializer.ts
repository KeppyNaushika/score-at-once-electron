import {
  initializeDataDirectory,
  migrateProjectsToExams,
} from "./lib/dataManager"
import { optimizeDatabaseForSharedDrive } from "./lib/prisma/databaseHealth"

// DB内の imagePath を projects/ → exams/ に一括更新（v0.6.x リネーム対応）
async function migrateImagePathsInDatabase(): Promise<void> {
  try {
    const { getPrismaClient } = await import("./lib/prisma/client")
    const prisma = getPrismaClient()

    const [masterResult, answerResult] = await prisma.$transaction([
      prisma.$executeRawUnsafe(
        `UPDATE "MasterImage" SET "imagePath" = 'exams/' || SUBSTR("imagePath", LENGTH('projects/') + 1) WHERE "imagePath" LIKE 'projects/%'`
      ),
      prisma.$executeRawUnsafe(
        `UPDATE "StudentAnswerImage" SET "imagePath" = 'exams/' || SUBSTR("imagePath", LENGTH('projects/') + 1) WHERE "imagePath" LIKE 'projects/%'`
      ),
    ])

    if (masterResult > 0 || answerResult > 0) {
      console.log(
        `Migrated imagePath in DB: MasterImage=${masterResult}, StudentAnswerImage=${answerResult}`
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
        `Database initialization failed: ${dbError instanceof Error ? dbError.message : dbError}`
      )
    }

    // DB内の imagePath を projects/ → exams/ に更新（v0.6.x リネーム対応）
    await migrateImagePathsInDatabase()

    // 共有ドライブ用の最適化
    await optimizeDatabaseForSharedDrive()

    // データベース接続テスト
    const { checkDatabaseHealth } = await import("./lib/prisma/databaseHealth")
    const isHealthy = await checkDatabaseHealth()

    if (!isHealthy) {
      throw new Error("Database health check failed")
    }

    console.log("Application initialization completed successfully")
  } catch (error) {
    console.error("Failed to initialize application:", error)
    // アプリケーションを終了させるのではなく、エラー状態を明確にする
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Application initialization failed: ${errorMessage}`)
  }
}
