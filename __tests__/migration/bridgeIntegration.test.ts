/**
 * ブリッジマイグレーション統合テスト
 *
 * 各バージョンのスキーマ状態のDBを作成し、
 * ブリッジマイグレーション → ベースライン → 最終スキーマ検証を行う
 */
import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import {
  getTableColumns,
  tableExists,
} from "../../electron-src/lib/prisma/databaseUtils"
import { createBaseline } from "../../electron-src/lib/prisma/schema/baselineMigrations"
import { runBridgeMigration } from "../../electron-src/lib/prisma/schema/bridgeMigrations"
import {
  detectSchemaVersion,
  SchemaVersion,
} from "../../electron-src/lib/prisma/schema/versionDetector"
import { createPrismaClientForPath } from "../helpers/testPrismaClient"

const TEST_DB_DIR = path.resolve(__dirname, "../../data")
const TEST_DB_PATH = path.join(TEST_DB_DIR, "test-bridge-integration.db")

let prisma: PrismaClient

const createPrisma = () => createPrismaClientForPath(TEST_DB_PATH)

const resetDb = async () => {
  if (prisma) await prisma.$disconnect()
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
  fs.writeFileSync(TEST_DB_PATH, "")
  prisma = createPrisma()
  await prisma.$connect()
}

const exec = async (sql: string) => {
  await prisma.$executeRawUnsafe(sql)
}

beforeAll(async () => {
  if (!fs.existsSync(TEST_DB_DIR))
    fs.mkdirSync(TEST_DB_DIR, { recursive: true })
  prisma = createPrisma()
})

afterEach(async () => {
  if (prisma) await prisma.$disconnect()
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
})

afterAll(async () => {
  if (prisma) await prisma.$disconnect()
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
})

/** S9に必要な全テーブル */
const S9_REQUIRED_TABLES = [
  "User",
  "classes",
  "Student",
  "StudentClassMembership",
  "Exam",
  "ExamStudent",
  "ExamPage",
  "ExamClass",
  "MasterImage",
  "StudentAnswerImage",
  "CropRegion",
  "QuestionScore",
  "DrawingAnnotation",
  "SubtotalGroup",
  "Subtotal",
  "CropSubtotal",
  "UserExam",
  "ExamSubtotalGroup",
  "ExamMarkingFormat",
  "ExamExportSettings",
  "CropRegionMarkingOverride",
  "UserKeyboardShortcut",
  "UserPreference",
  "Subject",
  "SubjectSubtotalGroup",
  "Grade",
  "GradeItem",
  "GradeClass",
  "GradeStudent",
  "GradeDataSource",
  "ManualScore",
  "GradeItemExclusion",
  "GradeBoundarySet",
  "GradeBoundary",
  "GradeOverride",
  "GradeExportSettings",
  "AsbDefinition",
  "AsbMajorQuestion",
  "AsbSubQuestion",
  "AsbBranchQuestion",
  "AsbTextElement",
  "AsbImageElement",
  "AsbOmrConfig",
  "AsbOmrChoiceOption",
  "AsbHeaderField",
  "CropRegionOmrConfig",
  "CropRegionOmrChoiceOption",
  "DeletedRecord",
]

/** S9のスキーマ検証 */
const verifyS9Schema = async () => {
  for (const table of S9_REQUIRED_TABLES) {
    const exists = await tableExists(prisma, table)
    expect(exists, `Table ${table} should exist`).toBe(true)
  }

  // UserPreferenceがKV形式であること
  const userPreferenceColumns = await getTableColumns(prisma, "UserPreference")
  expect(userPreferenceColumns).toContain("key")
  expect(userPreferenceColumns).toContain("value")

  // MasterImage.pageSizeが存在
  const masterImageColumns = await getTableColumns(prisma, "MasterImage")
  expect(masterImageColumns).toContain("pageSize")

  // DrawingAnnotation.isFavorite + userId
  const drawingAnnotationColumns = await getTableColumns(
    prisma,
    "DrawingAnnotation"
  )
  expect(drawingAnnotationColumns).toContain("isFavorite")
  expect(drawingAnnotationColumns).toContain("userId")
  expect(drawingAnnotationColumns).not.toContain("createdByUserId")

  // _prisma_migrationsが1件（ベースライン）
  const migrations = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM "_prisma_migrations"`
  )
  expect(Number(migrations[0].cnt)).toBe(1)

  // Project/GradeProjectテーブルが存在しないこと（リネーム済み）
  expect(await tableExists(prisma, "Project")).toBe(false)
  expect(await tableExists(prisma, "GradeProject")).toBe(false)
  expect(await tableExists(prisma, "UserScoringPreference")).toBe(false)
}

// ============================================================
// S3テスト用DBを構築する関数
// ============================================================
const buildS3Database = async () => {
  await exec(
    `CREATE TABLE "User" ("id" TEXT NOT NULL PRIMARY KEY, "username" TEXT NOT NULL, "passcode" TEXT, "name" TEXT NOT NULL, "role" TEXT NOT NULL DEFAULT 'teacher', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  )
  await exec(`CREATE UNIQUE INDEX "User_username_key" ON "User"("username")`)
  await exec(
    `CREATE TABLE "classes" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "classroomCode" TEXT, "grade" INTEGER, "description" TEXT, "isVisible" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  )
  await exec(`CREATE UNIQUE INDEX "classes_name_key" ON "classes"("name")`)
  await exec(
    `CREATE TABLE "Student" ("id" TEXT NOT NULL PRIMARY KEY, "studentId" TEXT NOT NULL, "lastName" TEXT NOT NULL, "firstName" TEXT NOT NULL, "lastNameKana" TEXT NOT NULL, "firstNameKana" TEXT NOT NULL, "enrollmentYear" INTEGER, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  )
  await exec(
    `CREATE UNIQUE INDEX "Student_studentId_key" ON "Student"("studentId")`
  )
  await exec(
    `CREATE TABLE "StudentClassMembership" ("id" TEXT NOT NULL PRIMARY KEY, "studentId" TEXT NOT NULL, "classId" TEXT NOT NULL, "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "endDate" DATETIME, "attendanceNumber" INTEGER, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  )
  await exec(
    `CREATE TABLE "Project" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  )
  await exec(
    `CREATE TABLE "ProjectStudent" ("id" TEXT NOT NULL PRIMARY KEY, "projectId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "customOrder" INTEGER, "status" TEXT NOT NULL DEFAULT 'expected', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  )
  await exec(
    `CREATE UNIQUE INDEX "ProjectStudent_projectId_studentId_key" ON "ProjectStudent"("projectId", "studentId")`
  )
  await exec(
    `CREATE INDEX "ProjectStudent_projectId_idx" ON "ProjectStudent"("projectId")`
  )
  await exec(
    `CREATE INDEX "ProjectStudent_studentId_idx" ON "ProjectStudent"("studentId")`
  )
  await exec(
    `CREATE INDEX "ProjectStudent_projectId_customOrder_idx" ON "ProjectStudent"("projectId", "customOrder")`
  )
  await exec(
    `CREATE TABLE "ProjectPage" ("id" TEXT NOT NULL PRIMARY KEY, "projectId" TEXT NOT NULL, "pageNumber" INTEGER NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  )
  await exec(
    `CREATE TABLE "PageImage" ("id" TEXT NOT NULL PRIMARY KEY, "projectPageId" TEXT NOT NULL, "studentId" TEXT, "imagePath" TEXT NOT NULL, "pageNumber" INTEGER NOT NULL DEFAULT 1, "imageType" TEXT NOT NULL DEFAULT 'master', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  )
  await exec(
    `CREATE TABLE "CropRegion" ("id" TEXT NOT NULL PRIMARY KEY, "projectPageId" TEXT NOT NULL, "questionNumber" TEXT, "maxScore" REAL NOT NULL DEFAULT 0, "label" TEXT, "x" REAL NOT NULL, "y" REAL NOT NULL, "width" REAL NOT NULL, "height" REAL NOT NULL, "order" INTEGER NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  )
  await exec(
    `CREATE TABLE "QuestionScore" ("id" TEXT NOT NULL PRIMARY KEY, "cropRegionId" TEXT NOT NULL, "studentId" TEXT, "status" TEXT NOT NULL DEFAULT 'unscored', "partialScore" DECIMAL, "scoredByUserId" TEXT, "scoredAt" DATETIME, "version" INTEGER NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  )
  await exec(
    `CREATE TABLE "DrawingAnnotation" ("id" TEXT NOT NULL PRIMARY KEY, "questionScoreId" TEXT NOT NULL, "type" TEXT NOT NULL, "x" REAL NOT NULL, "y" REAL NOT NULL, "color" TEXT NOT NULL DEFAULT '#ef4444', "strokeWidth" INTEGER NOT NULL DEFAULT 3, "width" REAL NOT NULL DEFAULT 0.0, "height" REAL NOT NULL DEFAULT 0.0, "endX" REAL NOT NULL DEFAULT 0.0, "endY" REAL NOT NULL DEFAULT 0.0, "lineStyle" TEXT NOT NULL DEFAULT 'solid', "text" TEXT NOT NULL DEFAULT '', "fontSize" INTEGER NOT NULL DEFAULT 16, "textBoxWidth" REAL NOT NULL DEFAULT 0.0, "textBoxHeight" REAL NOT NULL DEFAULT 0.0, "horizontalAlign" TEXT NOT NULL DEFAULT 'left', "verticalAlign" TEXT NOT NULL DEFAULT 'top', "anchorDirection" TEXT NOT NULL DEFAULT 'top-left', "displayX" REAL NOT NULL DEFAULT 0.0, "displayY" REAL NOT NULL DEFAULT 0.0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdByUserId" TEXT)`
  )
  await exec(
    `CREATE INDEX "DrawingAnnotation_questionScoreId_idx" ON "DrawingAnnotation"("questionScoreId")`
  )
  await exec(
    `CREATE TABLE "SubtotalGroup" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  )
  await exec(
    `CREATE TABLE "Subtotal" ("id" TEXT NOT NULL PRIMARY KEY, "subtotalGroupId" TEXT NOT NULL, "name" TEXT NOT NULL, "order" INTEGER NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  )
  await exec(
    `CREATE INDEX "Subtotal_subtotalGroupId_idx" ON "Subtotal"("subtotalGroupId")`
  )
  await exec(
    `CREATE TABLE "CropSubtotal" ("id" TEXT NOT NULL PRIMARY KEY, "cropRegionId" TEXT NOT NULL, "subtotalId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  )
  await exec(
    `CREATE TABLE "UserProject" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "projectId" TEXT NOT NULL, "role" TEXT NOT NULL DEFAULT 'GRADER', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  )
  await exec(
    `CREATE TABLE "ProjectSubtotalGroup" ("id" TEXT NOT NULL PRIMARY KEY, "projectId" TEXT NOT NULL, "subtotalGroupId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  )
}

/** テストデータを挿入 */
const insertTestData = async () => {
  await exec(
    `INSERT INTO "User" ("id", "username", "name", "role") VALUES ('user1', 'admin', 'テスト管理者', 'admin')`
  )
  await exec(
    `INSERT INTO "classes" ("id", "name") VALUES ('class1', 'テスト学級')`
  )
  await exec(
    `INSERT INTO "Student" ("id", "studentId", "lastName", "firstName", "lastNameKana", "firstNameKana") VALUES ('stu1', 'STU001', '山田', '太郎', 'ヤマダ', 'タロウ')`
  )
  await exec(
    `INSERT INTO "Project" ("id", "name") VALUES ('proj1', 'テスト試験')`
  )
  await exec(
    `INSERT INTO "ProjectPage" ("id", "projectId", "pageNumber") VALUES ('page1', 'proj1', 1)`
  )
  await exec(
    `INSERT INTO "PageImage" ("id", "projectPageId", "imagePath", "imageType") VALUES ('img1', 'page1', 'exams/proj1/master-images/page1.png', 'master')`
  )
  await exec(
    `INSERT INTO "PageImage" ("id", "projectPageId", "studentId", "imagePath", "imageType") VALUES ('img2', 'page1', 'stu1', 'exams/proj1/answer-sheets/stu1.png', 'answer')`
  )
  await exec(
    `INSERT INTO "UserProject" ("id", "userId", "projectId") VALUES ('up1', 'user1', 'proj1')`
  )
  await exec(
    `INSERT INTO "CropRegion" ("id", "projectPageId", "x", "y", "width", "height") VALUES ('cr1', 'page1', 10, 10, 100, 50)`
  )
  await exec(
    `INSERT INTO "QuestionScore" ("id", "cropRegionId", "studentId", "status", "scoredByUserId") VALUES ('qs1', 'cr1', 'stu1', 'correct', 'user1')`
  )
  await exec(
    `INSERT INTO "DrawingAnnotation" ("id", "questionScoreId", "type", "x", "y", "createdByUserId") VALUES ('da1', 'qs1', 'circle', 10, 10, 'user1')`
  )
}

describe("ブリッジマイグレーション統合テスト", () => {
  it("S3 → S9: PageImage分割 + 全マイグレーション + データ保持", async () => {
    await resetDb()
    await buildS3Database()
    await insertTestData()

    // バージョン検出
    const version = await detectSchemaVersion(prisma)
    expect(version).toBe("S3")

    // ブリッジ実行
    await runBridgeMigration(prisma, version as SchemaVersion)
    await createBaseline(prisma)

    // スキーマ検証
    await verifyS9Schema()

    // データ保持確認: MasterImageにmaster画像が移行されている
    const masterImages = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "MasterImage"`
    )
    expect(masterImages.length).toBe(1)
    expect(masterImages[0].id).toBe("img1")

    // StudentAnswerImageにanswer画像が移行されている
    const answerImages = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "StudentAnswerImage"`
    )
    expect(answerImages.length).toBe(1)
    expect(answerImages[0].id).toBe("img2")

    // PageImageテーブルは削除されている
    expect(await tableExists(prisma, "PageImage")).toBe(false)

    // DrawingAnnotationのuserIdが設定されている
    const annotations = await prisma.$queryRawUnsafe<{ userId: string }[]>(
      `SELECT "userId" FROM "DrawingAnnotation"`
    )
    expect(annotations[0].userId).toBe("user1")

    // Student.studentId → studentNumber
    const students = await prisma.$queryRawUnsafe<{ studentNumber: string }[]>(
      `SELECT "studentNumber" FROM "Student"`
    )
    expect(students[0].studentNumber).toBe("STU001")

    // Examテーブルにデータ移行（Project→Exam）
    const exams = await prisma.$queryRawUnsafe<{ id: string; name: string }[]>(
      `SELECT id, name FROM "Exam"`
    )
    expect(exams[0].name).toBe("テスト試験")
  }, 30000)

  it("S7 → S9: Exam命名のDBからの移行", async () => {
    await resetDb()
    // S7相当のDBを構築（S3を作成してS6→S7まで進めるより、直接構築）
    await exec(
      `CREATE TABLE "User" ("id" TEXT NOT NULL PRIMARY KEY, "username" TEXT NOT NULL, "name" TEXT NOT NULL, "role" TEXT NOT NULL DEFAULT 'teacher', "passcodeType" TEXT DEFAULT 'none', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "Exam" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "ExamPage" ("id" TEXT NOT NULL PRIMARY KEY, "examId" TEXT NOT NULL, "pageNumber" INTEGER NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "MasterImage" ("id" TEXT NOT NULL PRIMARY KEY, "examPageId" TEXT NOT NULL, "imagePath" TEXT NOT NULL, "pageNumber" INTEGER NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "StudentAnswerImage" ("id" TEXT NOT NULL PRIMARY KEY, "examPageId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "imagePath" TEXT NOT NULL, "pageNumber" INTEGER NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "CropRegion" ("id" TEXT NOT NULL PRIMARY KEY, "examPageId" TEXT NOT NULL, "x" REAL NOT NULL, "y" REAL NOT NULL, "width" REAL NOT NULL, "height" REAL NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "QuestionScore" ("id" TEXT NOT NULL PRIMARY KEY, "cropRegionId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'unscored', "userId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "DrawingAnnotation" ("id" TEXT NOT NULL PRIMARY KEY, "questionScoreId" TEXT NOT NULL, "type" TEXT NOT NULL, "x" REAL NOT NULL, "y" REAL NOT NULL, "color" TEXT NOT NULL DEFAULT '#ef4444', "strokeWidth" INTEGER NOT NULL DEFAULT 3, "width" REAL NOT NULL DEFAULT 0.0, "height" REAL NOT NULL DEFAULT 0.0, "endX" REAL NOT NULL DEFAULT 0.0, "endY" REAL NOT NULL DEFAULT 0.0, "lineStyle" TEXT NOT NULL DEFAULT 'solid', "text" TEXT NOT NULL DEFAULT '', "fontSize" INTEGER NOT NULL DEFAULT 16, "textBoxWidth" REAL NOT NULL DEFAULT 0.0, "textBoxHeight" REAL NOT NULL DEFAULT 0.0, "horizontalAlign" TEXT NOT NULL DEFAULT 'left', "verticalAlign" TEXT NOT NULL DEFAULT 'top', "anchorDirection" TEXT NOT NULL DEFAULT 'top-left', "displayX" REAL NOT NULL DEFAULT 0.0, "displayY" REAL NOT NULL DEFAULT 0.0, "isFavorite" BOOLEAN NOT NULL DEFAULT false, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "userId" TEXT NOT NULL)`
    )
    await exec(
      `CREATE TABLE "classes" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "Student" ("id" TEXT NOT NULL PRIMARY KEY, "studentNumber" TEXT NOT NULL, "lastName" TEXT NOT NULL, "firstName" TEXT NOT NULL, "lastNameKana" TEXT NOT NULL, "firstNameKana" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "StudentClassMembership" ("id" TEXT NOT NULL PRIMARY KEY, "studentId" TEXT NOT NULL, "classId" TEXT NOT NULL, "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "endDate" DATETIME, "attendanceNumber" INTEGER, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "SubtotalGroup" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "Subtotal" ("id" TEXT NOT NULL PRIMARY KEY, "subtotalGroupId" TEXT NOT NULL, "name" TEXT NOT NULL, "order" INTEGER NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "CropSubtotal" ("id" TEXT NOT NULL PRIMARY KEY, "cropRegionId" TEXT NOT NULL, "subtotalId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "UserExam" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "examId" TEXT NOT NULL, "role" TEXT NOT NULL DEFAULT 'GRADER', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "ExamStudent" ("id" TEXT NOT NULL PRIMARY KEY, "examId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "ExamSubtotalGroup" ("id" TEXT NOT NULL PRIMARY KEY, "examId" TEXT NOT NULL, "subtotalGroupId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "ExamClass" ("id" TEXT NOT NULL PRIMARY KEY, "examId" TEXT NOT NULL, "classId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "ExamMarkingFormat" ("id" TEXT NOT NULL PRIMARY KEY, "examId" TEXT NOT NULL, "markType" TEXT NOT NULL, "symbol" TEXT NOT NULL, "color" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "ExamExportSettings" ("id" TEXT NOT NULL PRIMARY KEY, "examId" TEXT NOT NULL, "settingsJson" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "CropRegionMarkingOverride" ("id" TEXT NOT NULL PRIMARY KEY, "cropRegionId" TEXT NOT NULL, "markType" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "UserKeyboardShortcut" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "action" TEXT NOT NULL, "key" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "UserScoringPreference" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "showStudentNames" BOOLEAN NOT NULL DEFAULT true, "autoScroll" BOOLEAN NOT NULL DEFAULT true, "itemsPerLine" INTEGER NOT NULL DEFAULT 5, "layoutDirection" TEXT NOT NULL DEFAULT 'right-down', "expandMargin" INTEGER NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "Subject" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "SubjectSubtotalGroup" ("id" TEXT NOT NULL PRIMARY KEY, "subjectId" TEXT NOT NULL, "subtotalGroupId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "Grade" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "GradeItem" ("id" TEXT NOT NULL PRIMARY KEY, "gradeId" TEXT NOT NULL, "name" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "GradeClass" ("id" TEXT NOT NULL PRIMARY KEY, "gradeId" TEXT NOT NULL, "classId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "GradeStudent" ("id" TEXT NOT NULL PRIMARY KEY, "gradeId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "GradeDataSource" ("id" TEXT NOT NULL PRIMARY KEY, "gradeItemId" TEXT NOT NULL, "type" TEXT NOT NULL, "examId" TEXT, "name" TEXT NOT NULL, "maxScore" DECIMAL NOT NULL, "weight" DECIMAL NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "ManualScore" ("id" TEXT NOT NULL PRIMARY KEY, "gradeDataSourceId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "GradeItemExclusion" ("id" TEXT NOT NULL PRIMARY KEY, "gradeId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "gradeItemId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "GradeBoundarySet" ("id" TEXT NOT NULL PRIMARY KEY, "gradeId" TEXT NOT NULL, "targetType" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "GradeBoundary" ("id" TEXT NOT NULL PRIMARY KEY, "gradeBoundarySetId" TEXT NOT NULL, "label" TEXT NOT NULL, "minPercentage" DECIMAL NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "GradeOverride" ("id" TEXT NOT NULL PRIMARY KEY, "gradeId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "targetType" TEXT NOT NULL, "overrideLabel" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "GradeExportSettings" ("id" TEXT NOT NULL PRIMARY KEY, "gradeId" TEXT NOT NULL, "settingsJson" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "AsbDefinition" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "userId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "AsbMajorQuestion" ("id" TEXT NOT NULL PRIMARY KEY, "definitionId" TEXT NOT NULL, "label" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "AsbSubQuestion" ("id" TEXT NOT NULL PRIMARY KEY, "majorQuestionId" TEXT NOT NULL, "label" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "AsbBranchQuestion" ("id" TEXT NOT NULL PRIMARY KEY, "subQuestionId" TEXT NOT NULL, "label" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "AsbTextElement" ("id" TEXT NOT NULL PRIMARY KEY, "text" TEXT NOT NULL, "fontSize" REAL NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "AsbOmrConfig" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )
    await exec(
      `CREATE TABLE "AsbOmrChoiceOption" ("id" TEXT NOT NULL PRIMARY KEY, "omrConfigId" TEXT NOT NULL, "choiceIndex" INTEGER NOT NULL, "label" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    )

    // テストデータ
    await exec(
      `INSERT INTO "User" ("id", "username", "name") VALUES ('u1', 'admin', 'Admin')`
    )
    await exec(
      `INSERT INTO "UserScoringPreference" ("id", "userId", "showStudentNames", "itemsPerLine", "layoutDirection", "expandMargin") VALUES ('usp1', 'u1', 1, 5, 'right-down', 0)`
    )

    const version = await detectSchemaVersion(prisma)
    expect(version).toBe("S7")

    await runBridgeMigration(prisma, version as SchemaVersion)
    await createBaseline(prisma)

    // S9テーブル存在確認（主要なもの）
    expect(await tableExists(prisma, "CropRegionOmrConfig")).toBe(true)
    expect(await tableExists(prisma, "DeletedRecord")).toBe(true)
    expect(await tableExists(prisma, "AsbImageElement")).toBe(true)
    expect(await tableExists(prisma, "AsbHeaderField")).toBe(true)

    // UserScoringPreference → UserPreference移行
    expect(await tableExists(prisma, "UserScoringPreference")).toBe(false)
    const userPreferenceColumns = await getTableColumns(
      prisma,
      "UserPreference"
    )
    expect(userPreferenceColumns).toContain("key")

    // 移行されたデータ確認
    const prefs = await prisma.$queryRawUnsafe<
      { key: string; value: string }[]
    >(
      `SELECT "key", "value" FROM "UserPreference" WHERE "userId" = 'u1' ORDER BY "key"`
    )
    const prefMap = Object.fromEntries(
      prefs.map((pref) => [pref.key, pref.value])
    )
    expect(prefMap["showStudentNames"]).toBe("true")
    expect(prefMap["itemsPerLine"]).toBe("5")

    // MasterImage.pageSize
    const masterImageColumns = await getTableColumns(prisma, "MasterImage")
    expect(masterImageColumns).toContain("pageSize")

    // ベースライン
    const migrations = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
      `SELECT COUNT(*) as cnt FROM "_prisma_migrations"`
    )
    expect(Number(migrations[0].cnt)).toBe(1)
  }, 30000)
})
