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
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examName" TEXT NOT NULL,
    "examDate" DATETIME,
    "subject" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ExamStudent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PARTICIPATING',
    "customOrder" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamStudent_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamPage_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "MasterImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examPageId" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MasterImage_examPageId_fkey" FOREIGN KEY ("examPageId") REFERENCES "ExamPage" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "StudentAnswerImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examPageId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentAnswerImage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "StudentAnswerImage_examPageId_fkey" FOREIGN KEY ("examPageId") REFERENCES "ExamPage" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "CropRegion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examPageId" TEXT NOT NULL,
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
    CONSTRAINT "CropRegion_examPageId_fkey" FOREIGN KEY ("examPageId") REFERENCES "ExamPage" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
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
CREATE TABLE "UserExam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'GRADER',
    "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserExam_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "UserExam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "UserExam_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "ExamSubtotalGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "subtotalGroupId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamSubtotalGroup_subtotalGroupId_fkey" FOREIGN KEY ("subtotalGroupId") REFERENCES "SubtotalGroup" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "ExamSubtotalGroup_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
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
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "DrawingAnnotation_questionScoreId_fkey" FOREIGN KEY ("questionScoreId") REFERENCES "QuestionScore" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DrawingAnnotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamClass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "administered" BOOLEAN NOT NULL DEFAULT false,
    "statistics" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamClass_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
CREATE TABLE "ExamMarkingFormat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "markType" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "fontSize" INTEGER,
    "strokeWidth" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamMarkingFormat_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamExportSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "settingsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamExportSettings_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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

-- CreateTable (Grade)
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "referenceDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GradeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeItem_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeClass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeClass_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeStudent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "customOrder" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeStudent_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeDataSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeItemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "examId" TEXT,
    "subtotalId" TEXT,
    "cropRegionId" TEXT,
    "name" TEXT NOT NULL,
    "maxScore" DECIMAL NOT NULL,
    "weight" DECIMAL NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "absentMethod" TEXT NOT NULL DEFAULT 'null',
    "absentRatio" DECIMAL NOT NULL DEFAULT 1.0,
    "absentOffset" DECIMAL NOT NULL DEFAULT 0,
    "treatExpectedAsMissing" BOOLEAN NOT NULL DEFAULT false,
    "estimationMode" TEXT NOT NULL DEFAULT 'all',
    "estimationSourceIds" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeDataSource_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeDataSource_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GradeDataSource_subtotalId_fkey" FOREIGN KEY ("subtotalId") REFERENCES "Subtotal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeDataSource_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManualScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeDataSourceId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "score" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ManualScore_gradeDataSourceId_fkey" FOREIGN KEY ("gradeDataSourceId") REFERENCES "GradeDataSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ManualScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeItemExclusion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "gradeItemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeItemExclusion_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeItemExclusion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeItemExclusion_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeBoundarySet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "gradeItemId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeBoundarySet_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeBoundarySet_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "gradeItemId" TEXT,
    "overrideLabel" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeOverride_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeOverride_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeOverride_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeBoundary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeBoundarySetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minPercentage" DECIMAL NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeBoundary_gradeBoundarySetId_fkey" FOREIGN KEY ("gradeBoundarySetId") REFERENCES "GradeBoundarySet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeExportSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeId" TEXT NOT NULL,
    "settingsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeExportSettings_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable (ASB)
CREATE TABLE "AsbDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '新しい解答用紙',
    "renderMode" TEXT NOT NULL DEFAULT 'answer-sheet',
    "labelPresetMajor" TEXT,
    "labelPresetSub" TEXT,
    "labelPresetBranch" TEXT,
    "paperSize" TEXT NOT NULL DEFAULT 'A4',
    "orientation" TEXT NOT NULL DEFAULT 'portrait',
    "baseRowHeight" REAL NOT NULL DEFAULT 12,
    "numberDisplayMode" TEXT NOT NULL DEFAULT 'multirow',
    "marginTop" REAL NOT NULL DEFAULT 15,
    "marginBottom" REAL NOT NULL DEFAULT 15,
    "marginLeft" REAL NOT NULL DEFAULT 10,
    "marginRight" REAL NOT NULL DEFAULT 10,
    "colWidthMajorNumber" REAL NOT NULL DEFAULT 10,
    "colWidthSubNumber" REAL NOT NULL DEFAULT 10,
    "colWidthBranchNumber" REAL NOT NULL DEFAULT 10,
    "majorQuestionSpacing" REAL NOT NULL DEFAULT 5,
    "headerHeight" REAL NOT NULL DEFAULT 0,
    "borderOuterBorder" TEXT NOT NULL DEFAULT 'solid',
    "borderMajorDivider" TEXT NOT NULL DEFAULT 'solid',
    "borderSubDivider" TEXT NOT NULL DEFAULT 'solid',
    "borderBranchDivider" TEXT NOT NULL DEFAULT 'dashed',
    "borderMajorNumberDivider" TEXT NOT NULL DEFAULT 'solid',
    "borderSubNumberDivider" TEXT NOT NULL DEFAULT 'solid',
    "borderBranchNumberDivider" TEXT NOT NULL DEFAULT 'solid',
    "borderOuterBorderWidth" REAL DEFAULT 0.7,
    "borderMajorDividerWidth" REAL DEFAULT 0.5,
    "borderSubDividerWidth" REAL DEFAULT 0.4,
    "borderBranchDividerWidth" REAL DEFAULT 0.3,
    "borderMajorNumberDividerWidth" REAL DEFAULT 0.4,
    "borderSubNumberDividerWidth" REAL DEFAULT 0.4,
    "borderBranchNumberDividerWidth" REAL DEFAULT 0.3,
    "omrMarkersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "omrMarkersSizeMm" REAL NOT NULL DEFAULT 5,
    "omrMarkersOffsetMm" REAL NOT NULL DEFAULT 3,
    "fontFamily" TEXT NOT NULL DEFAULT 'Noto Sans JP',
    "fontDefaultSize" REAL NOT NULL DEFAULT 6,
    "fontMajorNumberSize" REAL NOT NULL DEFAULT 6,
    "fontSubNumberSize" REAL NOT NULL DEFAULT 6,
    "fontBranchNumberSize" REAL NOT NULL DEFAULT 5,
    "multiColumnEnabled" BOOLEAN NOT NULL DEFAULT false,
    "multiColumnCount" INTEGER NOT NULL DEFAULT 2,
    "multiColumnGapMm" REAL NOT NULL DEFAULT 5,
    "multiColumnDividerLine" TEXT,
    "multiColumnDividerLineWidth" REAL NOT NULL DEFAULT 0.3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "AsbDefinition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AsbHeaderField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "definitionId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'field',
    "label" TEXT NOT NULL,
    "widthMm" REAL NOT NULL DEFAULT 30,
    "heightMm" REAL NOT NULL DEFAULT 8,
    "gridCount" INTEGER NOT NULL DEFAULT 0,
    "lineStyle" TEXT NOT NULL DEFAULT 'solid',
    "lineWidth" REAL NOT NULL DEFAULT 0.4,
    "order" INTEGER NOT NULL DEFAULT 0,
    "fontSize" REAL,
    "linkedRegionType" TEXT,
    CONSTRAINT "AsbHeaderField_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "AsbDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AsbMajorQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "definitionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbMajorQuestion_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "AsbDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AsbSubQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "majorQuestionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "heightMultiplier" REAL NOT NULL DEFAULT 1,
    "points" REAL NOT NULL DEFAULT 1,
    "usesBranchPoints" BOOLEAN,
    "layoutWidth" TEXT,
    "nextPlacement" TEXT,
    "goUp" INTEGER,
    "manuscriptEnabled" BOOLEAN NOT NULL DEFAULT false,
    "manuscriptColumns" INTEGER NOT NULL DEFAULT 20,
    "manuscriptRows" INTEGER NOT NULL DEFAULT 10,
    "manuscriptCellSizeMm" REAL NOT NULL DEFAULT 8,
    "borderStyleTop" TEXT,
    "borderStyleBottom" TEXT,
    "borderStyleLeft" TEXT,
    "borderStyleRight" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbSubQuestion_majorQuestionId_fkey" FOREIGN KEY ("majorQuestionId") REFERENCES "AsbMajorQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AsbBranchQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subQuestionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "heightMultiplier" REAL NOT NULL DEFAULT 1,
    "points" REAL NOT NULL DEFAULT 1,
    "layoutWidth" TEXT,
    "nextPlacement" TEXT,
    "goUp" INTEGER,
    "borderStyleTop" TEXT,
    "borderStyleBottom" TEXT,
    "borderStyleLeft" TEXT,
    "borderStyleRight" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbBranchQuestion_subQuestionId_fkey" FOREIGN KEY ("subQuestionId") REFERENCES "AsbSubQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AsbTextElement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subQuestionId" TEXT,
    "branchQuestionId" TEXT,
    "text" TEXT NOT NULL,
    "fontSize" REAL NOT NULL,
    "horizontalAlign" TEXT NOT NULL DEFAULT 'left',
    "verticalAlign" TEXT NOT NULL DEFAULT 'top',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbTextElement_subQuestionId_fkey" FOREIGN KEY ("subQuestionId") REFERENCES "AsbSubQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AsbTextElement_branchQuestionId_fkey" FOREIGN KEY ("branchQuestionId") REFERENCES "AsbBranchQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AsbImageElement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subQuestionId" TEXT,
    "branchQuestionId" TEXT,
    "imagePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "objectFit" TEXT NOT NULL DEFAULT 'contain',
    "horizontalAlign" TEXT NOT NULL DEFAULT 'center',
    "verticalAlign" TEXT NOT NULL DEFAULT 'middle',
    "opacity" REAL NOT NULL DEFAULT 1,
    "visibility" TEXT NOT NULL DEFAULT 'both',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbImageElement_subQuestionId_fkey" FOREIGN KEY ("subQuestionId") REFERENCES "AsbSubQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AsbImageElement_branchQuestionId_fkey" FOREIGN KEY ("branchQuestionId") REFERENCES "AsbBranchQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AsbOmrConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subQuestionId" TEXT,
    "branchQuestionId" TEXT,
    "type" TEXT NOT NULL,
    "numChoices" INTEGER,
    "choiceLayout" TEXT,
    "numDigits" INTEGER,
    "correctAnswer" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbOmrConfig_subQuestionId_fkey" FOREIGN KEY ("subQuestionId") REFERENCES "AsbSubQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AsbOmrConfig_branchQuestionId_fkey" FOREIGN KEY ("branchQuestionId") REFERENCES "AsbBranchQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AsbOmrChoiceOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "omrConfigId" TEXT NOT NULL,
    "choiceIndex" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbOmrChoiceOption_omrConfigId_fkey" FOREIGN KEY ("omrConfigId") REFERENCES "AsbOmrConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CropRegionOmrConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "numChoices" INTEGER,
    "choiceLayout" TEXT,
    "numDigits" INTEGER,
    "correctAnswer" TEXT,
    "cellGeometryJson" TEXT,
    "colorThreshold" INTEGER,
    "areaThreshold" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CropRegionOmrConfig_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CropRegionOmrChoiceOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "omrConfigId" TEXT NOT NULL,
    "choiceIndex" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CropRegionOmrChoiceOption_omrConfigId_fkey" FOREIGN KEY ("omrConfigId") REFERENCES "CropRegionOmrConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
CREATE INDEX "ExamStudent_examId_idx" ON "ExamStudent"("examId");

-- CreateIndex
CREATE INDEX "ExamStudent_studentId_idx" ON "ExamStudent"("studentId");

-- CreateIndex
CREATE INDEX "ExamStudent_examId_customOrder_idx" ON "ExamStudent"("examId", "customOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ExamStudent_examId_studentId_key" ON "ExamStudent"("examId", "studentId");

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
CREATE INDEX "DrawingAnnotation_isFavorite_idx" ON "DrawingAnnotation"("isFavorite");

-- CreateIndex
CREATE UNIQUE INDEX "UserExam_userId_examId_key" ON "UserExam"("userId", "examId");

-- CreateIndex
CREATE INDEX "UserExam_examId_idx" ON "UserExam"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamClass_examId_classId_key" ON "ExamClass"("examId", "classId");

-- CreateIndex
CREATE INDEX "ExamClass_examId_idx" ON "ExamClass"("examId");

-- CreateIndex
CREATE INDEX "ExamClass_classId_idx" ON "ExamClass"("classId");

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
CREATE UNIQUE INDEX "ExamMarkingFormat_examId_markType_key" ON "ExamMarkingFormat"("examId", "markType");

-- CreateIndex
CREATE INDEX "ExamMarkingFormat_examId_idx" ON "ExamMarkingFormat"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamExportSettings_examId_key" ON "ExamExportSettings"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "CropRegionMarkingOverride_cropRegionId_markType_key" ON "CropRegionMarkingOverride"("cropRegionId", "markType");

-- CreateIndex
CREATE INDEX "CropRegionMarkingOverride_cropRegionId_idx" ON "CropRegionMarkingOverride"("cropRegionId");

-- CreateIndex (MasterImage/StudentAnswerImage)
CREATE UNIQUE INDEX "StudentAnswerImage_examPageId_studentId_key" ON "StudentAnswerImage"("examPageId", "studentId");

-- CreateIndex
CREATE INDEX "StudentAnswerImage_examPageId_idx" ON "StudentAnswerImage"("examPageId");

-- CreateIndex
CREATE INDEX "StudentAnswerImage_studentId_idx" ON "StudentAnswerImage"("studentId");

-- CreateIndex (Grade)
CREATE INDEX "GradeItem_gradeId_idx" ON "GradeItem"("gradeId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeClass_gradeId_classId_key" ON "GradeClass"("gradeId", "classId");

-- CreateIndex
CREATE INDEX "GradeClass_gradeId_idx" ON "GradeClass"("gradeId");

-- CreateIndex
CREATE INDEX "GradeClass_classId_idx" ON "GradeClass"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeStudent_gradeId_studentId_key" ON "GradeStudent"("gradeId", "studentId");

-- CreateIndex
CREATE INDEX "GradeStudent_gradeId_idx" ON "GradeStudent"("gradeId");

-- CreateIndex
CREATE INDEX "GradeStudent_studentId_idx" ON "GradeStudent"("studentId");

-- CreateIndex
CREATE INDEX "GradeStudent_gradeId_customOrder_idx" ON "GradeStudent"("gradeId", "customOrder");

-- CreateIndex
CREATE INDEX "GradeDataSource_gradeItemId_idx" ON "GradeDataSource"("gradeItemId");

-- CreateIndex
CREATE INDEX "GradeDataSource_examId_idx" ON "GradeDataSource"("examId");

-- CreateIndex
CREATE INDEX "GradeDataSource_subtotalId_idx" ON "GradeDataSource"("subtotalId");

-- CreateIndex
CREATE INDEX "GradeDataSource_cropRegionId_idx" ON "GradeDataSource"("cropRegionId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualScore_gradeDataSourceId_studentId_key" ON "ManualScore"("gradeDataSourceId", "studentId");

-- CreateIndex
CREATE INDEX "ManualScore_gradeDataSourceId_idx" ON "ManualScore"("gradeDataSourceId");

-- CreateIndex
CREATE INDEX "ManualScore_studentId_idx" ON "ManualScore"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeItemExclusion_gradeId_studentId_gradeItemId_key" ON "GradeItemExclusion"("gradeId", "studentId", "gradeItemId");

-- CreateIndex
CREATE INDEX "GradeItemExclusion_gradeId_idx" ON "GradeItemExclusion"("gradeId");

-- CreateIndex
CREATE INDEX "GradeItemExclusion_studentId_idx" ON "GradeItemExclusion"("studentId");

-- CreateIndex
CREATE INDEX "GradeItemExclusion_gradeItemId_idx" ON "GradeItemExclusion"("gradeItemId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeBoundarySet_gradeId_targetType_gradeItemId_key" ON "GradeBoundarySet"("gradeId", "targetType", "gradeItemId");

-- CreateIndex
CREATE INDEX "GradeBoundarySet_gradeId_idx" ON "GradeBoundarySet"("gradeId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeOverride_gradeId_studentId_targetType_gradeItemId_key" ON "GradeOverride"("gradeId", "studentId", "targetType", "gradeItemId");

-- CreateIndex
CREATE INDEX "GradeOverride_gradeId_idx" ON "GradeOverride"("gradeId");

-- CreateIndex
CREATE INDEX "GradeOverride_studentId_idx" ON "GradeOverride"("studentId");

-- CreateIndex
CREATE INDEX "GradeOverride_gradeItemId_idx" ON "GradeOverride"("gradeItemId");

-- CreateIndex
CREATE INDEX "GradeBoundary_gradeBoundarySetId_idx" ON "GradeBoundary"("gradeBoundarySetId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeExportSettings_gradeId_key" ON "GradeExportSettings"("gradeId");

-- CreateIndex (ASB)
CREATE INDEX "AsbDefinition_userId_idx" ON "AsbDefinition"("userId");

-- CreateIndex
CREATE INDEX "AsbHeaderField_definitionId_idx" ON "AsbHeaderField"("definitionId");

-- CreateIndex
CREATE INDEX "AsbMajorQuestion_definitionId_idx" ON "AsbMajorQuestion"("definitionId");

-- CreateIndex
CREATE INDEX "AsbSubQuestion_majorQuestionId_idx" ON "AsbSubQuestion"("majorQuestionId");

-- CreateIndex
CREATE INDEX "AsbBranchQuestion_subQuestionId_idx" ON "AsbBranchQuestion"("subQuestionId");

-- CreateIndex
CREATE INDEX "AsbTextElement_subQuestionId_idx" ON "AsbTextElement"("subQuestionId");

-- CreateIndex
CREATE INDEX "AsbTextElement_branchQuestionId_idx" ON "AsbTextElement"("branchQuestionId");

-- CreateIndex
CREATE INDEX "AsbImageElement_subQuestionId_idx" ON "AsbImageElement"("subQuestionId");

-- CreateIndex
CREATE INDEX "AsbImageElement_branchQuestionId_idx" ON "AsbImageElement"("branchQuestionId");

-- CreateIndex
CREATE UNIQUE INDEX "AsbOmrConfig_subQuestionId_key" ON "AsbOmrConfig"("subQuestionId");

-- CreateIndex
CREATE UNIQUE INDEX "AsbOmrConfig_branchQuestionId_key" ON "AsbOmrConfig"("branchQuestionId");

-- CreateIndex
CREATE INDEX "AsbOmrConfig_subQuestionId_idx" ON "AsbOmrConfig"("subQuestionId");

-- CreateIndex
CREATE INDEX "AsbOmrConfig_branchQuestionId_idx" ON "AsbOmrConfig"("branchQuestionId");

-- CreateIndex
CREATE UNIQUE INDEX "AsbOmrChoiceOption_omrConfigId_choiceIndex_key" ON "AsbOmrChoiceOption"("omrConfigId", "choiceIndex");

-- CreateIndex
CREATE INDEX "AsbOmrChoiceOption_omrConfigId_idx" ON "AsbOmrChoiceOption"("omrConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "CropRegionOmrConfig_cropRegionId_key" ON "CropRegionOmrConfig"("cropRegionId");

-- CreateIndex
CREATE INDEX "CropRegionOmrConfig_cropRegionId_idx" ON "CropRegionOmrConfig"("cropRegionId");

-- CreateIndex
CREATE UNIQUE INDEX "CropRegionOmrChoiceOption_omrConfigId_choiceIndex_key" ON "CropRegionOmrChoiceOption"("omrConfigId", "choiceIndex");

-- CreateIndex
CREATE INDEX "CropRegionOmrChoiceOption_omrConfigId_idx" ON "CropRegionOmrChoiceOption"("omrConfigId");
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

// テーブルのカラム情報を取得するヘルパー
const getTableColumns = async (
  prisma: PrismaClient,
  tableName: string
): Promise<string[]> => {
  try {
    const tableInfo = await prisma.$queryRawUnsafe<{ name: string }[]>(
      `PRAGMA table_info("${tableName}")`
    )
    return tableInfo.map((col) => col.name)
  } catch {
    return [] // テーブルが存在しない場合
  }
}

// テーブルが存在するか確認するヘルパー
const tableExists = async (
  prisma: PrismaClient,
  tableName: string
): Promise<boolean> => {
  const result = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`
  )
  return result.length > 0
}

// 既存データベースのスキーママイグレーション
export const migrateExistingDatabase = async (): Promise<void> => {
  const prisma = createSharedPrismaClient()

  try {
    await prisma.$connect()

    // --- Migration: DrawingAnnotation.isFavorite (20260303200000) ---
    try {
      const daColumns = await getTableColumns(prisma, "DrawingAnnotation")
      if (daColumns.length > 0 && !daColumns.includes("isFavorite")) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "DrawingAnnotation" ADD COLUMN "isFavorite" BOOLEAN NOT NULL DEFAULT false`
        )
        await prisma.$executeRawUnsafe(
          `CREATE INDEX IF NOT EXISTS "DrawingAnnotation_isFavorite_idx" ON "DrawingAnnotation"("isFavorite")`
        )
        console.info("Migration: Added isFavorite column to DrawingAnnotation")
      }
    } catch (error) {
      console.warn("Migration DrawingAnnotation.isFavorite failed:", error)
    }

    // --- Migration: AsbImageElement テーブル (20260304000000) ---
    try {
      if (!(await tableExists(prisma, "AsbImageElement"))) {
        // AsbSubQuestion テーブルが存在する場合のみ（ASB機能が有効なDB）
        if (await tableExists(prisma, "AsbSubQuestion")) {
          await prisma.$executeRawUnsafe(`
            CREATE TABLE "AsbImageElement" (
              "id" TEXT NOT NULL PRIMARY KEY,
              "subQuestionId" TEXT,
              "branchQuestionId" TEXT,
              "imagePath" TEXT NOT NULL,
              "originalName" TEXT NOT NULL,
              "objectFit" TEXT NOT NULL DEFAULT 'contain',
              "horizontalAlign" TEXT NOT NULL DEFAULT 'center',
              "verticalAlign" TEXT NOT NULL DEFAULT 'middle',
              "opacity" REAL NOT NULL DEFAULT 1,
              "visibility" TEXT NOT NULL DEFAULT 'both',
              "order" INTEGER NOT NULL DEFAULT 0,
              "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" DATETIME NOT NULL,
              CONSTRAINT "AsbImageElement_subQuestionId_fkey" FOREIGN KEY ("subQuestionId") REFERENCES "AsbSubQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
              CONSTRAINT "AsbImageElement_branchQuestionId_fkey" FOREIGN KEY ("branchQuestionId") REFERENCES "AsbBranchQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
            )
          `)
          await prisma.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS "AsbImageElement_subQuestionId_idx" ON "AsbImageElement"("subQuestionId")`
          )
          await prisma.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS "AsbImageElement_branchQuestionId_idx" ON "AsbImageElement"("branchQuestionId")`
          )
          console.info("Migration: Created AsbImageElement table")
        }
      }
    } catch (error) {
      console.warn("Migration AsbImageElement table failed:", error)
    }

    // --- Migration: AsbDefinition multiColumn カラム (20260305000000) ---
    try {
      const asbDefColumns = await getTableColumns(prisma, "AsbDefinition")
      if (
        asbDefColumns.length > 0 &&
        !asbDefColumns.includes("multiColumnEnabled")
      ) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "AsbDefinition" ADD COLUMN "multiColumnEnabled" BOOLEAN NOT NULL DEFAULT false`
        )
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "AsbDefinition" ADD COLUMN "multiColumnCount" INTEGER NOT NULL DEFAULT 2`
        )
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "AsbDefinition" ADD COLUMN "multiColumnGapMm" REAL NOT NULL DEFAULT 5`
        )
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "AsbDefinition" ADD COLUMN "multiColumnDividerLine" TEXT`
        )
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "AsbDefinition" ADD COLUMN "multiColumnDividerLineWidth" REAL NOT NULL DEFAULT 0.3`
        )
        console.info("Migration: Added multiColumn columns to AsbDefinition")
      }
    } catch (error) {
      console.warn("Migration AsbDefinition multiColumn failed:", error)
    }

    // --- Migration: AsbHeaderField テーブル (20260305000000) ---
    try {
      if (!(await tableExists(prisma, "AsbHeaderField"))) {
        if (await tableExists(prisma, "AsbDefinition")) {
          await prisma.$executeRawUnsafe(`
            CREATE TABLE "AsbHeaderField" (
              "id" TEXT NOT NULL PRIMARY KEY,
              "definitionId" TEXT NOT NULL,
              "type" TEXT NOT NULL DEFAULT 'field',
              "label" TEXT NOT NULL,
              "widthMm" REAL NOT NULL DEFAULT 30,
              "heightMm" REAL NOT NULL DEFAULT 8,
              "gridCount" INTEGER NOT NULL DEFAULT 0,
              "lineStyle" TEXT NOT NULL DEFAULT 'solid',
              "lineWidth" REAL NOT NULL DEFAULT 0.4,
              "order" INTEGER NOT NULL DEFAULT 0,
              "fontSize" REAL,
              "linkedRegionType" TEXT,
              CONSTRAINT "AsbHeaderField_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "AsbDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
            )
          `)
          await prisma.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS "AsbHeaderField_definitionId_idx" ON "AsbHeaderField"("definitionId")`
          )
          console.info("Migration: Created AsbHeaderField table")
        }
      }
    } catch (error) {
      console.warn("Migration AsbHeaderField table failed:", error)
    }

    // --- Migration: AsbImageElement.visibility (20260305100000) ---
    try {
      const imgColumns = await getTableColumns(prisma, "AsbImageElement")
      if (imgColumns.length > 0 && !imgColumns.includes("visibility")) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "AsbImageElement" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'both'`
        )
        console.info("Migration: Added visibility column to AsbImageElement")
      }
    } catch (error) {
      console.warn("Migration AsbImageElement.visibility failed:", error)
    }

    // --- Migration: AsbHeaderField.type, fontSize (20260306000000) ---
    try {
      const hfColumns = await getTableColumns(prisma, "AsbHeaderField")
      if (hfColumns.length > 0 && !hfColumns.includes("type")) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "AsbHeaderField" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'field'`
        )
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "AsbHeaderField" ADD COLUMN "fontSize" REAL`
        )
        console.info("Migration: Added type/fontSize columns to AsbHeaderField")
      }
    } catch (error) {
      console.warn("Migration AsbHeaderField.type failed:", error)
    }

    // --- Migration: AsbHeaderField.linkedRegionType (20260307000000) ---
    try {
      const hfColumns2 = await getTableColumns(prisma, "AsbHeaderField")
      if (hfColumns2.length > 0 && !hfColumns2.includes("linkedRegionType")) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "AsbHeaderField" ADD COLUMN "linkedRegionType" TEXT`
        )
        console.info(
          "Migration: Added linkedRegionType column to AsbHeaderField"
        )
      }
    } catch (error) {
      console.warn("Migration AsbHeaderField.linkedRegionType failed:", error)
    }

    // --- Migration: CropRegionOmrConfig テーブル (20260314000000) ---
    try {
      if (!(await tableExists(prisma, "CropRegionOmrConfig"))) {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE "CropRegionOmrConfig" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "cropRegionId" TEXT NOT NULL,
            "type" TEXT NOT NULL,
            "numChoices" INTEGER,
            "choiceLayout" TEXT,
            "numDigits" INTEGER,
            "correctAnswer" TEXT,
            "cellGeometryJson" TEXT,
            "colorThreshold" INTEGER,
            "areaThreshold" REAL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            CONSTRAINT "CropRegionOmrConfig_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
          )
        `)
        await prisma.$executeRawUnsafe(
          `CREATE UNIQUE INDEX IF NOT EXISTS "CropRegionOmrConfig_cropRegionId_key" ON "CropRegionOmrConfig"("cropRegionId")`
        )
        await prisma.$executeRawUnsafe(
          `CREATE INDEX IF NOT EXISTS "CropRegionOmrConfig_cropRegionId_idx" ON "CropRegionOmrConfig"("cropRegionId")`
        )
        console.info("Migration: Created CropRegionOmrConfig table")
      }
    } catch (error) {
      console.warn("Migration CropRegionOmrConfig table failed:", error)
    }

    // --- Migration: CropRegionOmrChoiceOption テーブル (20260314000001) ---
    try {
      if (!(await tableExists(prisma, "CropRegionOmrChoiceOption"))) {
        if (await tableExists(prisma, "CropRegionOmrConfig")) {
          await prisma.$executeRawUnsafe(`
            CREATE TABLE "CropRegionOmrChoiceOption" (
              "id" TEXT NOT NULL PRIMARY KEY,
              "omrConfigId" TEXT NOT NULL,
              "choiceIndex" INTEGER NOT NULL,
              "label" TEXT NOT NULL,
              "isCorrect" BOOLEAN NOT NULL DEFAULT false,
              "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" DATETIME NOT NULL,
              CONSTRAINT "CropRegionOmrChoiceOption_omrConfigId_fkey" FOREIGN KEY ("omrConfigId") REFERENCES "CropRegionOmrConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
            )
          `)
          await prisma.$executeRawUnsafe(
            `CREATE UNIQUE INDEX IF NOT EXISTS "CropRegionOmrChoiceOption_omrConfigId_choiceIndex_key" ON "CropRegionOmrChoiceOption"("omrConfigId", "choiceIndex")`
          )
          await prisma.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS "CropRegionOmrChoiceOption_omrConfigId_idx" ON "CropRegionOmrChoiceOption"("omrConfigId")`
          )
          console.info("Migration: Created CropRegionOmrChoiceOption table")
        }
      }
    } catch (error) {
      console.warn("Migration CropRegionOmrChoiceOption table failed:", error)
    }
  } catch (error) {
    console.error("Database migration failed:", error)
  } finally {
    await prisma.$disconnect()
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
