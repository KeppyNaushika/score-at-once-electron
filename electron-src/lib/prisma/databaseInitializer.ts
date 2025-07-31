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
  const databaseUrl = `file:${absolutePath.replace(/\\/g, "/")}`

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
    log: ["error", "warn"],
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
      await fs.writeFile(dbPath, "", { mode: 0o644 })

      // ファイルが実際に作成されたか確認
      try {
        const stats = await fs.stat(dbPath)
        console.log(
          `Database file created successfully, size: ${stats.size} bytes`,
        )
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
            setTimeout(
              () =>
                reject(
                  new Error("Database connection timeout after 15 seconds"),
                ),
              15000,
            )
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
              await new Promise((resolve) => setTimeout(resolve, 2000))
              await prisma.$connect()
              connectionSuccessful = true
              console.log("Windows-specific connection successful")
            } catch (winError) {
              console.error(
                "Windows-specific connection also failed:",
                winError,
              )
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

        // 現在のスキーマに合わせたマイグレーションSQL
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
    "attendanceNumber" INTEGER,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentClassMembership_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentClassMembership_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examName" TEXT NOT NULL,
    "examDate" DATETIME,
    "subject" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectPage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PageImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectPageId" TEXT NOT NULL,
    "studentId" TEXT,
    "imagePath" TEXT NOT NULL,
    "imageType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PageImage_projectPageId_fkey" FOREIGN KEY ("projectPageId") REFERENCES "ProjectPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PageImage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CropRegion_projectPageId_fkey" FOREIGN KEY ("projectPageId") REFERENCES "ProjectPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubtotalGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Subtotal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "subtotalGroupId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subtotal_subtotalGroupId_fkey" FOREIGN KEY ("subtotalGroupId") REFERENCES "SubtotalGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CropSubtotal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "subtotalId" TEXT NOT NULL,
    "assignmentType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CropSubtotal_subtotalId_fkey" FOREIGN KEY ("subtotalId") REFERENCES "Subtotal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CropSubtotal_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'GRADER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectSubtotalGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "subtotalGroupId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectSubtotalGroup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectSubtotalGroup_subtotalGroupId_fkey" FOREIGN KEY ("subtotalGroupId") REFERENCES "SubtotalGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "studentId" TEXT,
    "partialScore" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'unscored',
    "scoredByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestionScore_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_scoredByUserId_fkey" FOREIGN KEY ("scoredByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
        `

        // 現在のスキーマに合わせたインデックス作成SQL
        const indexSQL = `
-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "classes_name_key" ON "classes"("name");
CREATE UNIQUE INDEX "Student_studentId_key" ON "Student"("studentId");
CREATE UNIQUE INDEX "StudentClassMembership_studentId_classId_startDate_key" ON "StudentClassMembership"("studentId", "classId", "startDate");
CREATE INDEX "StudentClassMembership_studentId_idx" ON "StudentClassMembership"("studentId");
CREATE INDEX "StudentClassMembership_classId_idx" ON "StudentClassMembership"("classId");
CREATE INDEX "StudentClassMembership_startDate_idx" ON "StudentClassMembership"("startDate");
CREATE INDEX "StudentClassMembership_endDate_idx" ON "StudentClassMembership"("endDate");
CREATE UNIQUE INDEX "ProjectPage_projectId_pageNumber_key" ON "ProjectPage"("projectId", "pageNumber");
CREATE INDEX "ProjectPage_projectId_idx" ON "ProjectPage"("projectId");
CREATE INDEX "PageImage_projectPageId_idx" ON "PageImage"("projectPageId");
CREATE INDEX "PageImage_studentId_idx" ON "PageImage"("studentId");
CREATE INDEX "CropRegion_projectPageId_idx" ON "CropRegion"("projectPageId");
CREATE UNIQUE INDEX "Subtotal_subtotalGroupId_name_key" ON "Subtotal"("subtotalGroupId", "name");
CREATE INDEX "Subtotal_subtotalGroupId_idx" ON "Subtotal"("subtotalGroupId");
CREATE INDEX "Subtotal_subtotalGroupId_order_idx" ON "Subtotal"("subtotalGroupId", "order");
CREATE UNIQUE INDEX "CropSubtotal_cropRegionId_subtotalId_assignmentType_key" ON "CropSubtotal"("cropRegionId", "subtotalId", "assignmentType");
CREATE INDEX "CropSubtotal_cropRegionId_idx" ON "CropSubtotal"("cropRegionId");
CREATE INDEX "CropSubtotal_subtotalId_idx" ON "CropSubtotal"("subtotalId");
CREATE UNIQUE INDEX "UserProject_userId_projectId_key" ON "UserProject"("userId", "projectId");
CREATE INDEX "UserProject_userId_idx" ON "UserProject"("userId");
CREATE INDEX "UserProject_projectId_idx" ON "UserProject"("projectId");
CREATE UNIQUE INDEX "ProjectSubtotalGroup_projectId_subtotalGroupId_key" ON "ProjectSubtotalGroup"("projectId", "subtotalGroupId");
CREATE INDEX "ProjectSubtotalGroup_projectId_idx" ON "ProjectSubtotalGroup"("projectId");
CREATE INDEX "ProjectSubtotalGroup_subtotalGroupId_idx" ON "ProjectSubtotalGroup"("subtotalGroupId");
CREATE INDEX "ProjectStudent_projectId_idx" ON "ProjectStudent"("projectId");
CREATE INDEX "ProjectStudent_studentId_idx" ON "ProjectStudent"("studentId");
CREATE INDEX "ProjectStudent_projectId_customOrder_idx" ON "ProjectStudent"("projectId", "customOrder");
CREATE UNIQUE INDEX "ProjectStudent_projectId_studentId_key" ON "ProjectStudent"("projectId", "studentId");
CREATE UNIQUE INDEX "QuestionScore_cropRegionId_studentId_scoredByUserId_key" ON "QuestionScore"("cropRegionId", "studentId", "scoredByUserId");
CREATE INDEX "QuestionScore_cropRegionId_idx" ON "QuestionScore"("cropRegionId");
CREATE INDEX "QuestionScore_studentId_idx" ON "QuestionScore"("studentId");
CREATE INDEX "QuestionScore_scoredByUserId_idx" ON "QuestionScore"("scoredByUserId");
        `

        // SQLを複数のステートメントに分割して実行
        const allSQL = migrationSQL + indexSQL
        const statements = allSQL.split(";").filter((stmt) => stmt.trim())

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
            stack: error.stack,
          })
        }

        // データベースファイルを削除して再試行
        try {
          await fs.unlink(dbPath)
          console.log("Removed corrupted database file")
        } catch (unlinkError) {
          console.error(
            "Failed to remove corrupted database file:",
            unlinkError,
          )
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
