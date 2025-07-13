import { PrismaClient } from "@prisma/client"
import * as path from "path"
import * as fs from "fs/promises"
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
  const databaseUrl = `file:${absolutePath.replace(/\\/g, '/')}`

  console.log(`Creating Prisma client with database URL: ${databaseUrl}`)
  console.log(`Resolved database path: ${absolutePath}`)
  
  // 環境変数を動的にオーバーライド
  process.env.DATABASE_URL = databaseUrl
  
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    // パッケージ化されたアプリでの設定
    log: ['error', 'warn'],
  })
}

// データベースの初期化（初回起動時）
export const initializeDatabase = async (): Promise<boolean> => {

  try {
    // データベースファイルの存在確認
    const dbExists = await checkDatabaseExists()

    if (!dbExists) {
      console.log("Database does not exist, creating new database...")
      
      // データディレクトリが存在することを確認
      const dataDir = getDataDirectory()
      console.log(`Creating data directory: ${dataDir}`)
      await fs.mkdir(dataDir, { recursive: true, mode: 0o755 })

      // 空のデータベースファイルを作成
      const dbPath = getDatabasePath()
      console.log(`Creating database file: ${dbPath}`)
      await fs.writeFile(dbPath, '', { mode: 0o644 })
      
      // ファイルが実際に作成されたか確認
      try {
        const stats = await fs.stat(dbPath)
        console.log(`Database file created successfully, size: ${stats.size} bytes`)
      } catch (error) {
        console.error(`Failed to verify database file creation:`, error)
        throw new Error(`Database file creation verification failed: ${error}`)
      }

      // Prismaクライアントでデータベースを初期化
      const prisma = createSharedPrismaClient()

      try {
        // データベーススキーマの直接作成
        console.log("Initializing database schema...")
        
        // Prismaクライアントを使用してスキーマを直接作成
        console.log("Connecting to database...")
        
        // Prisma接続にタイムアウトを設定（Windows対応）
        console.log("Attempting database connection with timeout...")
        let connectionSuccessful = false
        
        try {
          const connectPromise = prisma.$connect()
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Database connection timeout after 15 seconds")), 15000)
          })
          
          await Promise.race([connectPromise, timeoutPromise])
          connectionSuccessful = true
          console.log("Database connection successful")
        } catch (connectError) {
          console.error("Database connection failed:", connectError)
          
          // Windowsでの接続失敗時は別の方法を試行
          if (process.platform === "win32") {
            console.log("Attempting Windows-specific connection method...")
            try {
              // 短時間待機後に再試行
              await new Promise(resolve => setTimeout(resolve, 2000))
              await prisma.$connect()
              connectionSuccessful = true
              console.log("Windows-specific connection successful")
            } catch (winError) {
              console.error("Windows-specific connection also failed:", winError)
              throw winError
            }
          } else {
            throw connectError
          }
        }
        
        // 直接SQLを実行してスキーマを作成
        if (!connectionSuccessful) {
          throw new Error("Failed to establish database connection")
        }
        
        console.log("Running direct SQL migration...")
        
        // マイグレーションSQLを直接実行
        const migrationSQL = `
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'teacher',
    "passcode" TEXT,
    "passcodeType" TEXT DEFAULT 'none',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
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
    "studentId" TEXT NOT NULL,
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
CREATE TABLE "MasterImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MasterImage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examName" TEXT NOT NULL,
    "examDate" DATETIME,
    "subject" TEXT,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
CREATE TABLE "GradingAssignment" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("projectId", "userId"),
    CONSTRAINT "GradingAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradingAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LayoutRegion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "masterImageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "width" REAL NOT NULL,
    "height" REAL NOT NULL,
    "points" INTEGER,
    "orderIndex" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LayoutRegion_masterImageId_fkey" FOREIGN KEY ("masterImageId") REFERENCES "MasterImage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LayoutRegion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestionGroup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionGroupItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "questionGroupId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestionGroupItem_questionGroupId_fkey" FOREIGN KEY ("questionGroupId") REFERENCES "QuestionGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubtotalDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "layoutRegionId" TEXT NOT NULL,
    "questionGroupItemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubtotalDefinition_questionGroupItemId_fkey" FOREIGN KEY ("questionGroupItemId") REFERENCES "QuestionGroupItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubtotalDefinition_layoutRegionId_fkey" FOREIGN KEY ("layoutRegionId") REFERENCES "LayoutRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionSubtotalAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionLayoutRegionId" TEXT NOT NULL,
    "questionGroupItemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestionSubtotalAssignment_questionGroupItemId_fkey" FOREIGN KEY ("questionGroupItemId") REFERENCES "QuestionGroupItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionSubtotalAssignment_questionLayoutRegionId_fkey" FOREIGN KEY ("questionLayoutRegionId") REFERENCES "LayoutRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnswerSheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "studentId" TEXT,
    "pageNumber" INTEGER NOT NULL,
    "originalImagePath" TEXT NOT NULL,
    "processedImagePath" TEXT,
    "scoredPdfPath" TEXT,
    "isScored" BOOLEAN NOT NULL DEFAULT false,
    "totalScore" REAL,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "AnswerSheet_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AnswerSheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "maxScore" INTEGER NOT NULL DEFAULT 0,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionPart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "layoutRegionId" TEXT NOT NULL,
    "partLabel" TEXT NOT NULL DEFAULT '',
    "partScore" INTEGER NOT NULL DEFAULT 0,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestionPart_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionPart_layoutRegionId_fkey" FOREIGN KEY ("layoutRegionId") REFERENCES "LayoutRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionPartScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionPartId" TEXT NOT NULL,
    "answerSheetId" TEXT NOT NULL,
    "score" DECIMAL,
    "comment" TEXT,
    "scoredByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "scoreVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "QuestionPartScore_questionPartId_fkey" FOREIGN KEY ("questionPartId") REFERENCES "QuestionPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionPartScore_answerSheetId_fkey" FOREIGN KEY ("answerSheetId") REFERENCES "AnswerSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionPartScore_scoredByUserId_fkey" FOREIGN KEY ("scoredByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT,
    "answerSheetId" TEXT NOT NULL,
    "layoutRegionId" TEXT NOT NULL,
    "partialScore" DECIMAL,
    "comment" TEXT,
    "scoredByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "scoreVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "QuestionScore_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_scoredByUserId_fkey" FOREIGN KEY ("scoredByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_layoutRegionId_fkey" FOREIGN KEY ("layoutRegionId") REFERENCES "LayoutRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_answerSheetId_fkey" FOREIGN KEY ("answerSheetId") REFERENCES "AnswerSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScoreRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "totalScore" REAL NOT NULL,
    "excelOutputPath" TEXT,
    "pdfOutputPath" TEXT,
    "finalizedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScoreRecord_finalizedByUserId_fkey" FOREIGN KEY ("finalizedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ScoreRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScoreRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "machineIdentifier" TEXT,
    "sessionStartedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionEndedAt" DATETIME,
    CONSTRAINT "ProjectSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProjectSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "locks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lockedResourceId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "lockedByUserId" TEXT NOT NULL,
    "lockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    CONSTRAINT "locks_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ClassTeachers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ClassTeachers_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ClassTeachers_A_fkey" FOREIGN KEY ("A") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
        `
        
        // インデックス作成SQL
        const indexSQL = `
-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "classes_name_key" ON "classes"("name");
CREATE UNIQUE INDEX "Student_studentId_key" ON "Student"("studentId");
CREATE INDEX "StudentClassMembership_studentId_idx" ON "StudentClassMembership"("studentId");
CREATE INDEX "StudentClassMembership_classId_idx" ON "StudentClassMembership"("classId");
CREATE INDEX "StudentClassMembership_startDate_endDate_idx" ON "StudentClassMembership"("startDate", "endDate");
CREATE INDEX "StudentClassMembership_classId_attendanceNumber_idx" ON "StudentClassMembership"("classId", "attendanceNumber");
CREATE INDEX "MasterImage_projectId_idx" ON "MasterImage"("projectId");
CREATE UNIQUE INDEX "MasterImage_projectId_pageNumber_key" ON "MasterImage"("projectId", "pageNumber");
CREATE INDEX "Project_userId_idx" ON "Project"("userId");
CREATE INDEX "ProjectStudent_projectId_idx" ON "ProjectStudent"("projectId");
CREATE INDEX "ProjectStudent_studentId_idx" ON "ProjectStudent"("studentId");
CREATE INDEX "ProjectStudent_projectId_customOrder_idx" ON "ProjectStudent"("projectId", "customOrder");
CREATE UNIQUE INDEX "ProjectStudent_projectId_studentId_key" ON "ProjectStudent"("projectId", "studentId");
CREATE INDEX "GradingAssignment_userId_idx" ON "GradingAssignment"("userId");
CREATE INDEX "LayoutRegion_projectId_idx" ON "LayoutRegion"("projectId");
CREATE INDEX "LayoutRegion_masterImageId_idx" ON "LayoutRegion"("masterImageId");
CREATE INDEX "QuestionGroup_projectId_idx" ON "QuestionGroup"("projectId");
CREATE UNIQUE INDEX "QuestionGroup_projectId_name_key" ON "QuestionGroup"("projectId", "name");
CREATE INDEX "QuestionGroupItem_questionGroupId_idx" ON "QuestionGroupItem"("questionGroupId");
CREATE INDEX "QuestionGroupItem_questionGroupId_order_idx" ON "QuestionGroupItem"("questionGroupId", "order");
CREATE UNIQUE INDEX "QuestionGroupItem_questionGroupId_name_key" ON "QuestionGroupItem"("questionGroupId", "name");
CREATE INDEX "SubtotalDefinition_layoutRegionId_idx" ON "SubtotalDefinition"("layoutRegionId");
CREATE INDEX "SubtotalDefinition_questionGroupItemId_idx" ON "SubtotalDefinition"("questionGroupItemId");
CREATE UNIQUE INDEX "SubtotalDefinition_layoutRegionId_questionGroupItemId_key" ON "SubtotalDefinition"("layoutRegionId", "questionGroupItemId");
CREATE INDEX "QuestionSubtotalAssignment_questionLayoutRegionId_idx" ON "QuestionSubtotalAssignment"("questionLayoutRegionId");
CREATE INDEX "QuestionSubtotalAssignment_questionGroupItemId_idx" ON "QuestionSubtotalAssignment"("questionGroupItemId");
CREATE UNIQUE INDEX "QuestionSubtotalAssignment_questionLayoutRegionId_questionGroupItemId_key" ON "QuestionSubtotalAssignment"("questionLayoutRegionId", "questionGroupItemId");
CREATE INDEX "AnswerSheet_projectId_idx" ON "AnswerSheet"("projectId");
CREATE UNIQUE INDEX "AnswerSheet_projectId_studentId_pageNumber_key" ON "AnswerSheet"("projectId", "studentId", "pageNumber");
CREATE INDEX "Question_projectId_idx" ON "Question"("projectId");
CREATE INDEX "Question_projectId_orderIndex_idx" ON "Question"("projectId", "orderIndex");
CREATE INDEX "QuestionPart_questionId_idx" ON "QuestionPart"("questionId");
CREATE INDEX "QuestionPart_layoutRegionId_idx" ON "QuestionPart"("layoutRegionId");
CREATE INDEX "QuestionPart_questionId_orderIndex_idx" ON "QuestionPart"("questionId", "orderIndex");
CREATE UNIQUE INDEX "QuestionPart_questionId_layoutRegionId_key" ON "QuestionPart"("questionId", "layoutRegionId");
CREATE INDEX "QuestionPartScore_questionPartId_idx" ON "QuestionPartScore"("questionPartId");
CREATE INDEX "QuestionPartScore_answerSheetId_idx" ON "QuestionPartScore"("answerSheetId");
CREATE INDEX "QuestionPartScore_scoredByUserId_idx" ON "QuestionPartScore"("scoredByUserId");
CREATE UNIQUE INDEX "QuestionPartScore_questionPartId_answerSheetId_scoredByUserId_key" ON "QuestionPartScore"("questionPartId", "answerSheetId", "scoredByUserId");
CREATE INDEX "QuestionScore_answerSheetId_layoutRegionId_status_idx" ON "QuestionScore"("answerSheetId", "layoutRegionId", "status");
CREATE INDEX "QuestionScore_layoutRegionId_idx" ON "QuestionScore"("layoutRegionId");
CREATE INDEX "QuestionScore_questionId_idx" ON "QuestionScore"("questionId");
CREATE UNIQUE INDEX "QuestionScore_answerSheetId_layoutRegionId_scoredByUserId_key" ON "QuestionScore"("answerSheetId", "layoutRegionId", "scoredByUserId");
CREATE INDEX "ScoreRecord_projectId_idx" ON "ScoreRecord"("projectId");
CREATE UNIQUE INDEX "ScoreRecord_studentId_projectId_key" ON "ScoreRecord"("studentId", "projectId");
CREATE INDEX "ProjectSession_projectId_idx" ON "ProjectSession"("projectId");
CREATE INDEX "ProjectSession_userId_idx" ON "ProjectSession"("userId");
CREATE UNIQUE INDEX "locks_lockedResourceId_key" ON "locks"("lockedResourceId");
CREATE INDEX "locks_lockedResourceId_resourceType_idx" ON "locks"("lockedResourceId", "resourceType");
CREATE INDEX "_ClassTeachers_B_index" ON "_ClassTeachers"("B");
CREATE UNIQUE INDEX "_ClassTeachers_AB_unique" ON "_ClassTeachers"("A", "B");
        `
        
        // SQLを複数のステートメントに分割して実行
        const allSQL = migrationSQL + indexSQL
        const statements = allSQL.split(';').filter(stmt => stmt.trim())
        
        for (const statement of statements) {
          if (statement.trim()) {
            await prisma.$executeRawUnsafe(statement.trim())
          }
        }
        
        console.log("Database schema initialized successfully")
        return true
      } catch (error) {
        console.error("Failed to initialize database schema:", error)
        if (error instanceof Error) {
          console.error("Error details:", {
            message: error.message,
            name: error.name,
            stack: error.stack
          })
        }
        
        // データベースファイルを削除して再試行
        try {
          await fs.unlink(dbPath)
          console.log("Removed corrupted database file")
        } catch (unlinkError) {
          console.error("Failed to remove corrupted database file:", unlinkError)
        }
        
        throw error
      } finally {
        await prisma.$disconnect()
      }
    } else {
      console.log("Database already exists")
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

// データベースのバックアップ作成
export const createDatabaseBackup = async (): Promise<string> => {
  const databasePath = getDatabasePath()
  const backupPath = `${databasePath}.backup.${Date.now()}`

  try {
    await fs.copyFile(databasePath, backupPath)
    return backupPath
  } catch (error) {
    console.error("Failed to create database backup:", error)
    throw error
  }
}
