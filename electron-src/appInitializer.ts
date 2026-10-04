import { app, dialog } from "electron"

import {
  getLocalDataDirectory,
  initializeDataDirectory,
  migrateProjectsToExams,
} from "./lib/dataManager"
import { getPrismaClient } from "./lib/prisma/client"
import {
  checkDatabaseHealth,
  optimizeDatabaseForSharedDrive,
} from "./lib/prisma/databaseHealth"
import { fixStorageRoots } from "./lib/storageRoots"
import { getCurrentClientIdOwner } from "./lib/sync/machineIdentity"
import {
  prepareStorageAtStartup,
  StorageStartupError,
} from "./lib/sync/startupStorage"
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

/**
 * データの根（DB・画像・PCに残すもの）を決めて確定する。**起動で最初に1度だけ。**
 *
 * 起動を続けられないとき（旧版からの引き継ぎに失敗した・利用者が終了を選んだ）は、
 * 理由を見せてから例外を投げる。
 */
async function decideStorageRoots(): Promise<void> {
  try {
    const roots = await prepareStorageAtStartup({
      localDataDirectory: getLocalDataDirectory(),
      // data を差し替えて起動したとき（e2e・撮影）は、userData の旧版の控えはその data の
      // ものではないので見ない
      legacyUserDataDirectory: process.env.SCORE_AT_ONCE_DATA_DIR
        ? null
        : app.getPath("userData"),
      currentOwner: getCurrentClientIdOwner(),
      notify: async (message) => {
        await dialog.showMessageBox({
          type: "info",
          title: "一括採点",
          message,
        })
      },
      confirmLocalFallback: async (message) => {
        const { response } = await dialog.showMessageBox({
          type: "warning",
          title: "共有モードで起動できません",
          message,
          buttons: ["ローカルモードで起動", "終了"],
          defaultId: 0,
          cancelId: 1,
        })
        return response === 0
      },
    })
    fixStorageRoots(roots)
    console.log(
      `Storage roots: mode=${roots.mode} database=${roots.databasePath} files=${roots.sharedFilesDirectory}`
    )
  } catch (error) {
    if (error instanceof StorageStartupError) {
      dialog.showErrorBox("一括採点を起動できません", error.message)
    }
    throw error
  }
}

export async function initializeApp(): Promise<void> {
  try {
    // データの根を決める（DB・画像の置き場はこれより前に参照しない）
    await decideStorageRoots()

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
