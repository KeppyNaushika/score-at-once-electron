import { PrismaClient } from "@prisma/client"
import * as fs from "fs/promises"
import * as path from "path"
import { getDataDirectory } from "../dataManager"

// データベースファイルのパス
export const getDatabasePath = (): string => {
  return path.join(getDataDirectory(), "database.db")
}

// 共有ドライブ用のPrismaクライアントを作成
export const createSharedPrismaClient = (): PrismaClient => {
  const databasePath = getDatabasePath()
  // パッケージ化されたアプリでは絶対パスを使用
  const absolutePath = path.resolve(databasePath)

  // Windowsパスの正規化（バックスラッシュをスラッシュに）
  const normalizedPath = absolutePath.replace(/\\/g, "/")
  const databaseUrl = `file:${normalizedPath}`

  // 環境変数を動的にオーバーライド
  process.env.DATABASE_URL = databaseUrl

  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    // パッケージ化されたアプリでの設定を強化
    log: ["error", "warn", "info"],
    errorFormat: "pretty",
  })
}

// データベースの初期化（初回起動時）
export const initializeDatabase = async (): Promise<boolean> => {
  try {
    // データベースファイルの存在確認
    const dbExists = await checkDatabaseExists()

    if (!dbExists) {
      // データディレクトリが存在することを確認
      const dataDir = getDataDirectory()
      await fs.mkdir(dataDir, { recursive: true, mode: 0o755 })

      // 空のデータベースファイルを作成
      const dbPath = getDatabasePath()
      await fs.writeFile(dbPath, "", { mode: 0o644 })

      // ファイルが実際に作成されたか確認
      try {
        await fs.stat(dbPath)
      } catch (error) {
        console.error("Failed to verify database file creation:", error)
        throw new Error(`Database file creation verification failed: ${error}`)
      }

      // Prismaクライアントでデータベースを初期化
      const prisma = createSharedPrismaClient()

      try {
        // Prisma接続にタイムアウトを設定（プラットフォーム対応改善）
        let connectionSuccessful = false
        const maxRetries = 3
        let attempt = 0

        while (attempt < maxRetries && !connectionSuccessful) {
          attempt++

          try {
            const connectPromise = prisma.$connect()
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(
                () =>
                  reject(
                    new Error(
                      `Database connection timeout after 20 seconds (attempt ${attempt})`
                    )
                  ),
                20000 // タイムアウトを20秒に延長
              )
            })

            await Promise.race([connectPromise, timeoutPromise])
            connectionSuccessful = true
            break
          } catch (connectError) {
            if (attempt < maxRetries) {
              const waitTime = attempt * 2000 // 2秒、4秒と段階的に延長
              await new Promise((resolve) => setTimeout(resolve, waitTime))
            } else {
              // 最後の試行失敗時
              console.error("All connection attempts failed:", connectError)
              throw new Error(
                `Database connection failed after ${maxRetries} attempts: ${connectError instanceof Error ? connectError.message : connectError}`
              )
            }
          }
        }

        // 直接SQLを実行してスキーマを作成
        if (!connectionSuccessful) {
          throw new Error("Failed to establish database connection")
        }

        // 現在のPrismaスキーマに完全準拠したマイグレーションSQL（最新マイグレーションに基づく）
        const migrationSQL = `
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passcode" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'teacher',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "passcodeType" TEXT DEFAULT 'none'
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "classCode" TEXT,
    "grade" INTEGER,
    "description" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentNumber" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastNameKana" TEXT NOT NULL,
    "firstNameKana" TEXT NOT NULL,
    "enrollmentYear" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StudentClassMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "attendanceNumber" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentClassMembership_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentClassMembership_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examName" TEXT NOT NULL,
    "examDate" DATETIME,
    "subject" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProjectStudent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PARTICIPATING',
    "customOrder" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectStudent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectPage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "MasterImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectPageId" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MasterImage_projectPageId_fkey" FOREIGN KEY ("projectPageId") REFERENCES "ProjectPage" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "StudentAnswerImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectPageId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentAnswerImage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "StudentAnswerImage_projectPageId_fkey" FOREIGN KEY ("projectPageId") REFERENCES "ProjectPage" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "CropRegion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectPageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "width" REAL NOT NULL,
    "height" REAL NOT NULL,
    "points" INTEGER,
    "orderIndex" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CropRegion_projectPageId_fkey" FOREIGN KEY ("projectPageId") REFERENCES "ProjectPage" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "SubtotalGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Subtotal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "subtotalGroupId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subtotal_subtotalGroupId_fkey" FOREIGN KEY ("subtotalGroupId") REFERENCES "SubtotalGroup" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "CropSubtotal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "subtotalId" TEXT NOT NULL,
    "assignmentType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CropSubtotal_subtotalId_fkey" FOREIGN KEY ("subtotalId") REFERENCES "Subtotal" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "CropSubtotal_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "UserProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'GRADER',
    "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "UserProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "UserProject_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "ProjectSubtotalGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "subtotalGroupId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectSubtotalGroup_subtotalGroupId_fkey" FOREIGN KEY ("subtotalGroupId") REFERENCES "SubtotalGroup" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "ProjectSubtotalGroup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "QuestionScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "partialScore" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'unscored',
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "QuestionScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "QuestionScore_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "DrawingAnnotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionScoreId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#ef4444',
    "strokeWidth" INTEGER NOT NULL DEFAULT 3,
    "width" REAL NOT NULL DEFAULT 0.0,
    "height" REAL NOT NULL DEFAULT 0.0,
    "endX" REAL NOT NULL DEFAULT 0.0,
    "endY" REAL NOT NULL DEFAULT 0.0,
    "lineStyle" TEXT NOT NULL DEFAULT 'solid',
    "text" TEXT NOT NULL DEFAULT '',
    "fontSize" INTEGER NOT NULL DEFAULT 16,
    "textBoxWidth" REAL NOT NULL DEFAULT 0.0,
    "textBoxHeight" REAL NOT NULL DEFAULT 0.0,
    "horizontalAlign" TEXT NOT NULL DEFAULT 'left',
    "verticalAlign" TEXT NOT NULL DEFAULT 'top',
    "anchorDirection" TEXT NOT NULL DEFAULT 'top-left',
    "displayX" REAL NOT NULL DEFAULT 0.0,
    "displayY" REAL NOT NULL DEFAULT 0.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "DrawingAnnotation_questionScoreId_fkey" FOREIGN KEY ("questionScoreId") REFERENCES "QuestionScore" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DrawingAnnotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectClass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "administered" BOOLEAN NOT NULL DEFAULT false,
    "statistics" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectClass_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SubjectSubtotalGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT NOT NULL,
    "subtotalGroupId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubjectSubtotalGroup_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubjectSubtotalGroup_subtotalGroupId_fkey" FOREIGN KEY ("subtotalGroupId") REFERENCES "SubtotalGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserKeyboardShortcut" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserKeyboardShortcut_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserScoringPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "showStudentNames" BOOLEAN NOT NULL DEFAULT true,
    "autoScroll" BOOLEAN NOT NULL DEFAULT true,
    "itemsPerLine" INTEGER NOT NULL DEFAULT 5,
    "layoutDirection" TEXT NOT NULL DEFAULT 'right-down',
    "expandMargin" INTEGER NOT NULL DEFAULT 0,
    "selectionBorderColor" TEXT,
    "scoringStatusColors" TEXT,
    "scoringColorPresetId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserScoringPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectMarkingFormat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "markType" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "fontSize" INTEGER,
    "strokeWidth" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectMarkingFormat_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectExportSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "settingsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectExportSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CropRegionMarkingOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "markType" TEXT NOT NULL,
    "symbol" TEXT,
    "color" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CropRegionMarkingOverride_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
        `

        // 現在のスキーマに完全準拠したインデックス作成SQL（最新マイグレーションに基づく）
        const indexSQL = `
-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "classes_name_key" ON "classes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentNumber_key" ON "Student"("studentNumber");

-- CreateIndex
CREATE INDEX "StudentClassMembership_studentId_idx" ON "StudentClassMembership"("studentId");

-- CreateIndex
CREATE INDEX "StudentClassMembership_classId_idx" ON "StudentClassMembership"("classId");

-- CreateIndex
CREATE INDEX "StudentClassMembership_classId_attendanceNumber_idx" ON "StudentClassMembership"("classId", "attendanceNumber");

-- CreateIndex
CREATE INDEX "StudentClassMembership_startDate_endDate_idx" ON "StudentClassMembership"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "ProjectStudent_projectId_idx" ON "ProjectStudent"("projectId");

-- CreateIndex
CREATE INDEX "ProjectStudent_studentId_idx" ON "ProjectStudent"("studentId");

-- CreateIndex
CREATE INDEX "ProjectStudent_projectId_customOrder_idx" ON "ProjectStudent"("projectId", "customOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStudent_projectId_studentId_key" ON "ProjectStudent"("projectId", "studentId");

-- CreateIndex
CREATE INDEX "Subtotal_subtotalGroupId_idx" ON "Subtotal"("subtotalGroupId");

-- CreateIndex
CREATE INDEX "Subtotal_subtotalGroupId_order_idx" ON "Subtotal"("subtotalGroupId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Subtotal_subtotalGroupId_name_key" ON "Subtotal"("subtotalGroupId", "name");

-- CreateIndex
CREATE INDEX "DrawingAnnotation_questionScoreId_idx" ON "DrawingAnnotation"("questionScoreId");

-- CreateIndex
CREATE INDEX "DrawingAnnotation_type_idx" ON "DrawingAnnotation"("type");

-- CreateIndex
CREATE INDEX "DrawingAnnotation_createdAt_idx" ON "DrawingAnnotation"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserProject_userId_projectId_key" ON "UserProject"("userId", "projectId");

-- CreateIndex
CREATE INDEX "UserProject_projectId_idx" ON "UserProject"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectClass_projectId_classId_key" ON "ProjectClass"("projectId", "classId");

-- CreateIndex
CREATE INDEX "ProjectClass_projectId_idx" ON "ProjectClass"("projectId");

-- CreateIndex
CREATE INDEX "ProjectClass_classId_idx" ON "ProjectClass"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_name_key" ON "Subject"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectSubtotalGroup_subjectId_subtotalGroupId_key" ON "SubjectSubtotalGroup"("subjectId", "subtotalGroupId");

-- CreateIndex
CREATE INDEX "SubjectSubtotalGroup_subjectId_idx" ON "SubjectSubtotalGroup"("subjectId");

-- CreateIndex
CREATE INDEX "SubjectSubtotalGroup_subtotalGroupId_idx" ON "SubjectSubtotalGroup"("subtotalGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "UserKeyboardShortcut_userId_action_key" ON "UserKeyboardShortcut"("userId", "action");

-- CreateIndex
CREATE INDEX "UserKeyboardShortcut_userId_idx" ON "UserKeyboardShortcut"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserScoringPreference_userId_key" ON "UserScoringPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMarkingFormat_projectId_markType_key" ON "ProjectMarkingFormat"("projectId", "markType");

-- CreateIndex
CREATE INDEX "ProjectMarkingFormat_projectId_idx" ON "ProjectMarkingFormat"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectExportSettings_projectId_key" ON "ProjectExportSettings"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CropRegionMarkingOverride_cropRegionId_markType_key" ON "CropRegionMarkingOverride"("cropRegionId", "markType");

-- CreateIndex
CREATE INDEX "CropRegionMarkingOverride_cropRegionId_idx" ON "CropRegionMarkingOverride"("cropRegionId");

-- CreateIndex (MasterImage/StudentAnswerImage)
CREATE INDEX "StudentAnswerImage_projectPageId_idx" ON "StudentAnswerImage"("projectPageId");

-- CreateIndex
CREATE INDEX "StudentAnswerImage_studentId_idx" ON "StudentAnswerImage"("studentId");
        `

        // SQLを複数のステートメントに分割して実行
        const allSQL = migrationSQL + indexSQL
        const statements = allSQL.split(";").filter((stmt) => stmt.trim())

        for (const statement of statements) {
          if (statement.trim()) {
            await prisma.$executeRawUnsafe(statement.trim())
          }
        }

        return true
      } catch (error) {
        console.error("Failed to initialize database schema:", error)

        // データベースファイルを削除して再試行
        try {
          await fs.unlink(dbPath)
        } catch (unlinkError) {
          console.error(
            "Failed to remove corrupted database file:",
            unlinkError
          )
        }

        throw error
      } finally {
        await prisma.$disconnect()
      }
    } else {
      return false
    }
  } catch (error) {
    console.error("Database initialization failed:", error)
    throw error
  }
}

// データベースファイルの存在確認
export const checkDatabaseExists = async (): Promise<boolean> => {
  const databasePath = getDatabasePath()

  try {
    await fs.access(databasePath)
    return true
  } catch {
    return false
  }
}

// データベースの健全性チェック
export const checkDatabaseHealth = async (): Promise<boolean> => {
  const prisma = createSharedPrismaClient()

  try {
    // 簡単なクエリで接続確認
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error("Database health check failed:", error)
    return false
  } finally {
    await prisma.$disconnect()
  }
}

// 共有ドライブ用のSQLite最適化設定
export const optimizeDatabaseForSharedDrive = async (): Promise<void> => {
  const prisma = createSharedPrismaClient()

  try {
    // WALモードを有効にして同時読み取りを改善
    await prisma.$queryRaw`PRAGMA journal_mode = WAL`

    // 読み取り専用トランザクションのタイムアウトを短縮
    await prisma.$queryRaw`PRAGMA busy_timeout = 30000`

    // 同期モードを調整（共有ドライブでのパフォーマンス向上）
    await prisma.$queryRaw`PRAGMA synchronous = NORMAL`

    // キャッシュサイズを増加
    await prisma.$queryRaw`PRAGMA cache_size = -64000`
  } catch (error) {
    console.error("Failed to optimize database:", error)
  } finally {
    await prisma.$disconnect()
  }
}
