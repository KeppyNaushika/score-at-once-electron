import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

import { getDatabasePath } from "../databaseInitializer"
import { getTableColumns, tableExists } from "../databaseUtils"
import { SchemaVersion } from "./versionDetector"

/** SQLを文単位で分割して順次実行する */
const executeSqlStatements = async (
  prisma: PrismaClient,
  sql: string
): Promise<void> => {
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"))
  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt)
  }
}

const BACKUP_SUFFIX = ".pre-migration-backup"
const BACKUP_KEEP_COUNT = 5

/** 古いバックアップを削除し、直近のBACKUP_KEEP_COUNT世代のみ保持する */
const pruneOldBackups = (absolutePath: string): void => {
  try {
    const dir = path.dirname(absolutePath)
    const prefix = `${path.basename(absolutePath)}${BACKUP_SUFFIX}`
    const backups = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith(prefix))
      .sort()
    for (const f of backups.slice(
      0,
      Math.max(0, backups.length - BACKUP_KEEP_COUNT)
    )) {
      fs.unlinkSync(path.join(dir, f))
    }
  } catch (error) {
    console.warn("Failed to prune old migration backups:", error)
  }
}

/**
 * マイグレーション前にDBファイルをバックアップする。
 * NAS共有時に他クライアントのバックアップを上書きしないようタイムスタンプを付与する。
 */
export const createBackup = (): string | null => {
  try {
    const dbPath = getDatabasePath()
    const absolutePath = path.resolve(dbPath)
    if (!fs.existsSync(absolutePath)) return null
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, "")
      .slice(0, 14)
    const backupPath = `${absolutePath}${BACKUP_SUFFIX}-${timestamp}`
    fs.copyFileSync(absolutePath, backupPath)
    pruneOldBackups(absolutePath)
    console.info(`Migration backup created: ${backupPath}`)
    return backupPath
  } catch (error) {
    console.warn("Failed to create migration backup:", error)
    return null
  }
}

/** バックアップからDBを復元する */
export const restoreBackup = (backupPath: string): void => {
  try {
    const dbPath = path.resolve(getDatabasePath())
    fs.copyFileSync(backupPath, dbPath)
    console.info("Database restored from backup")
  } catch (error) {
    console.error("Failed to restore database from backup:", error)
  }
}

/** 検出されたバージョンからS9までブリッジマイグレーションを適用する */
export const runBridgeMigration = async (
  prisma: PrismaClient,
  fromVersion: SchemaVersion
): Promise<void> => {
  const steps: SchemaVersion[] = ["S3", "S4", "S5", "S6", "S7", "S8"]
  const startIndex = steps.indexOf(fromVersion)
  if (startIndex === -1) return

  for (let i = startIndex; i < steps.length; i++) {
    const current = steps[i]
    const next = i + 1 < steps.length ? steps[i + 1] : "S9"
    console.info(`Bridge migration: ${current} → ${next}`)

    switch (current) {
      case "S3":
        await migrateS3toS4(prisma)
        break
      case "S4":
        await migrateS4toS5(prisma)
        break
      case "S5":
        await migrateS5toS6(prisma)
        break
      case "S6":
        await migrateS6toS7(prisma)
        break
      case "S7":
        await migrateS7toS8(prisma)
        break
      case "S8":
        await migrateS8toS9(prisma)
        break
    }

    console.info(`Bridge migration: ${current} → ${next} completed`)
  }
}

// ============================================================
// S3 → S4: +Settings, Marking, Subject等 (v0.2.x → v0.3.x)
// ============================================================
const migrateS3toS4 = async (prisma: PrismaClient): Promise<void> => {
  // 20250101000000_add_v030_settings_and_marking_override
  if (!(await tableExists(prisma, "UserPreference"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "UserPreference" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "selectionBorderColor" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId")`
    )
  }

  if (!(await tableExists(prisma, "UserKeyboardShortcut"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "UserKeyboardShortcut" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "action" TEXT NOT NULL,
        "key" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "UserKeyboardShortcut_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "UserKeyboardShortcut_userId_action_key" ON "UserKeyboardShortcut"("userId", "action")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "UserKeyboardShortcut_userId_idx" ON "UserKeyboardShortcut"("userId")`
    )
  }

  if (!(await tableExists(prisma, "UserScoringPreference"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "UserScoringPreference" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "showStudentNames" BOOLEAN NOT NULL DEFAULT true,
        "autoScroll" BOOLEAN NOT NULL DEFAULT true,
        "itemsPerLine" INTEGER NOT NULL DEFAULT 5,
        "layoutDirection" TEXT NOT NULL DEFAULT 'right-down',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "UserScoringPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "UserScoringPreference_userId_key" ON "UserScoringPreference"("userId")`
    )
  }

  if (!(await tableExists(prisma, "ProjectMarkingFormat"))) {
    await prisma.$executeRawUnsafe(`
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
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "ProjectMarkingFormat_projectId_markType_key" ON "ProjectMarkingFormat"("projectId", "markType")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "ProjectMarkingFormat_projectId_idx" ON "ProjectMarkingFormat"("projectId")`
    )
  }

  if (!(await tableExists(prisma, "ProjectExportSettings"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "ProjectExportSettings" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "projectId" TEXT NOT NULL,
        "settingsJson" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "ProjectExportSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "ProjectExportSettings_projectId_key" ON "ProjectExportSettings"("projectId")`
    )
  }

  if (!(await tableExists(prisma, "CropRegionMarkingOverride"))) {
    await prisma.$executeRawUnsafe(`
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
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "CropRegionMarkingOverride_cropRegionId_markType_key" ON "CropRegionMarkingOverride"("cropRegionId", "markType")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "CropRegionMarkingOverride_cropRegionId_idx" ON "CropRegionMarkingOverride"("cropRegionId")`
    )
  }

  // 20251230143455_add_v030_project_class_and_roles
  if (!(await tableExists(prisma, "ProjectClass"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "ProjectClass" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "projectId" TEXT NOT NULL,
        "classId" TEXT NOT NULL,
        "administered" BOOLEAN NOT NULL DEFAULT false,
        "statistics" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "ProjectClass_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "ProjectClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "ProjectClass_projectId_idx" ON "ProjectClass"("projectId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "ProjectClass_classId_idx" ON "ProjectClass"("classId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "ProjectClass_projectId_classId_key" ON "ProjectClass"("projectId", "classId")`
    )
  }

  if (!(await tableExists(prisma, "Subject"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "Subject" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "Subject_name_key" ON "Subject"("name")`
    )
  }

  if (!(await tableExists(prisma, "SubjectSubtotalGroup"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "SubjectSubtotalGroup" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "subjectId" TEXT NOT NULL,
        "subtotalGroupId" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "SubjectSubtotalGroup_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "SubjectSubtotalGroup_subtotalGroupId_fkey" FOREIGN KEY ("subtotalGroupId") REFERENCES "SubtotalGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "SubjectSubtotalGroup_subjectId_idx" ON "SubjectSubtotalGroup"("subjectId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "SubjectSubtotalGroup_subtotalGroupId_idx" ON "SubjectSubtotalGroup"("subtotalGroupId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "SubjectSubtotalGroup_subjectId_subtotalGroupId_key" ON "SubjectSubtotalGroup"("subjectId", "subtotalGroupId")`
    )
  }

  // UserProject テーブルの再定義（invitedAt, invitedBy追加）
  const upColumns = await getTableColumns(prisma, "UserProject")
  if (upColumns.length > 0 && !upColumns.includes("invitedAt")) {
    await executeSqlStatements(
      prisma,
      `
      PRAGMA defer_foreign_keys=ON;
      PRAGMA foreign_keys=OFF;
      CREATE TABLE "new_UserProject" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "projectId" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'GRADER',
        "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "invitedBy" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "UserProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UserProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UserProject_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
      );
      INSERT INTO "new_UserProject" ("createdAt", "id", "projectId", "role", "updatedAt", "userId") SELECT "createdAt", "id", "projectId", "role", "updatedAt", "userId" FROM "UserProject";
      DROP TABLE "UserProject";
      ALTER TABLE "new_UserProject" RENAME TO "UserProject";
      CREATE INDEX "UserProject_projectId_idx" ON "UserProject"("projectId");
      CREATE UNIQUE INDEX "UserProject_userId_projectId_key" ON "UserProject"("userId", "projectId");
      PRAGMA foreign_keys=ON;
      PRAGMA defer_foreign_keys=OFF
    `
    )
  }
}

// ============================================================
// S4 → S5: PageImage分割、nullable→required (v0.3.x → v0.4.x)
// カスタムSQL（既存マイグレーションファイルなし）
// ============================================================
const migrateS4toS5 = async (prisma: PrismaClient): Promise<void> => {
  // PageImage → MasterImage + StudentAnswerImage 分割
  if (
    (await tableExists(prisma, "PageImage")) &&
    !(await tableExists(prisma, "MasterImage"))
  ) {
    // MasterImageテーブル作成
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "MasterImage" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "projectPageId" TEXT NOT NULL,
        "imagePath" TEXT NOT NULL,
        "pageNumber" INTEGER NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "MasterImage_projectPageId_fkey" FOREIGN KEY ("projectPageId") REFERENCES "ProjectPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "MasterImage_projectPageId_idx" ON "MasterImage"("projectPageId")`
    )

    // StudentAnswerImageテーブル作成
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "StudentAnswerImage" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "projectPageId" TEXT NOT NULL,
        "studentId" TEXT NOT NULL,
        "imagePath" TEXT NOT NULL,
        "pageNumber" INTEGER NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "StudentAnswerImage_projectPageId_fkey" FOREIGN KEY ("projectPageId") REFERENCES "ProjectPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "StudentAnswerImage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "StudentAnswerImage_projectPageId_idx" ON "StudentAnswerImage"("projectPageId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "StudentAnswerImage_studentId_idx" ON "StudentAnswerImage"("studentId")`
    )

    // PageImageからデータを移行
    // master画像: imageType='master' または studentIdがNULL
    const pageImageColumns = await getTableColumns(prisma, "PageImage")
    if (pageImageColumns.includes("imageType")) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "MasterImage" ("id", "projectPageId", "imagePath", "pageNumber", "createdAt", "updatedAt")
        SELECT "id", "projectPageId", "imagePath", COALESCE("pageNumber", 1), "createdAt", "updatedAt"
        FROM "PageImage" WHERE "imageType" = 'master' OR "studentId" IS NULL
      `)
      await prisma.$executeRawUnsafe(`
        INSERT INTO "StudentAnswerImage" ("id", "projectPageId", "studentId", "imagePath", "pageNumber", "createdAt", "updatedAt")
        SELECT "id", "projectPageId", "studentId", "imagePath", COALESCE("pageNumber", 1), "createdAt", "updatedAt"
        FROM "PageImage" WHERE "imageType" = 'answer' AND "studentId" IS NOT NULL
      `)
    } else {
      // imageTypeカラムがない場合はstudentIdで判定
      await prisma.$executeRawUnsafe(`
        INSERT INTO "MasterImage" ("id", "projectPageId", "imagePath", "pageNumber", "createdAt", "updatedAt")
        SELECT "id", "projectPageId", "imagePath", COALESCE("pageNumber", 1), "createdAt", "updatedAt"
        FROM "PageImage" WHERE "studentId" IS NULL
      `)
      await prisma.$executeRawUnsafe(`
        INSERT INTO "StudentAnswerImage" ("id", "projectPageId", "studentId", "imagePath", "pageNumber", "createdAt", "updatedAt")
        SELECT "id", "projectPageId", "studentId", "imagePath", COALESCE("pageNumber", 1), "createdAt", "updatedAt"
        FROM "PageImage" WHERE "studentId" IS NOT NULL
      `)
    }

    // PageImageテーブルを削除
    await prisma.$executeRawUnsafe(`DROP TABLE "PageImage"`)
  }

  // UserScoringPreference に expandMargin 追加
  const uspColumns = await getTableColumns(prisma, "UserScoringPreference")
  if (uspColumns.length > 0 && !uspColumns.includes("expandMargin")) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "UserScoringPreference" ADD COLUMN "expandMargin" INTEGER NOT NULL DEFAULT 0`
    )
  }

  // UserScoringPreference に scoringStatusColors, scoringColorPresetId 追加
  if (uspColumns.length > 0 && !uspColumns.includes("scoringStatusColors")) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "UserScoringPreference" ADD COLUMN "scoringStatusColors" TEXT`
    )
  }
  if (uspColumns.length > 0 && !uspColumns.includes("scoringColorPresetId")) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "UserScoringPreference" ADD COLUMN "scoringColorPresetId" TEXT`
    )
  }

  // User に passcodeType 追加
  const userColumns = await getTableColumns(prisma, "User")
  if (userColumns.length > 0 && !userColumns.includes("passcodeType")) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN "passcodeType" TEXT DEFAULT 'none'`
    )
  }
}

// ============================================================
// S5 → S6: +Grade系、studentNumber (v0.4.x → v0.5.x)
// ============================================================
const migrateS5toS6 = async (prisma: PrismaClient): Promise<void> => {
  // 20260111000000: Student.studentId → studentNumber
  const studentColumns = await getTableColumns(prisma, "Student")
  if (
    studentColumns.includes("studentId") &&
    !studentColumns.includes("studentNumber")
  ) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Student" RENAME COLUMN "studentId" TO "studentNumber"`
    )
  }

  // 20260219000000: Grade系テーブル追加
  if (!(await tableExists(prisma, "GradeProject"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "GradeProject" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "referenceDate" DATETIME,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      )
    `)
  }

  if (!(await tableExists(prisma, "GradeItem"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "GradeItem" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "gradeProjectId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "order" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "GradeItem_gradeProjectId_fkey" FOREIGN KEY ("gradeProjectId") REFERENCES "GradeProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "GradeItem_gradeProjectId_idx" ON "GradeItem"("gradeProjectId")`
    )
  }

  if (!(await tableExists(prisma, "GradeProjectClass"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "GradeProjectClass" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "gradeProjectId" TEXT NOT NULL,
        "classId" TEXT NOT NULL,
        "order" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "GradeProjectClass_gradeProjectId_fkey" FOREIGN KEY ("gradeProjectId") REFERENCES "GradeProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "GradeProjectClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "GradeProjectClass_gradeProjectId_idx" ON "GradeProjectClass"("gradeProjectId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "GradeProjectClass_classId_idx" ON "GradeProjectClass"("classId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "GradeProjectClass_gradeProjectId_classId_key" ON "GradeProjectClass"("gradeProjectId", "classId")`
    )
  }

  if (!(await tableExists(prisma, "GradeProjectStudent"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "GradeProjectStudent" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "gradeProjectId" TEXT NOT NULL,
        "studentId" TEXT NOT NULL,
        "customOrder" INTEGER,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "GradeProjectStudent_gradeProjectId_fkey" FOREIGN KEY ("gradeProjectId") REFERENCES "GradeProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "GradeProjectStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "GradeProjectStudent_gradeProjectId_idx" ON "GradeProjectStudent"("gradeProjectId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "GradeProjectStudent_studentId_idx" ON "GradeProjectStudent"("studentId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "GradeProjectStudent_gradeProjectId_customOrder_idx" ON "GradeProjectStudent"("gradeProjectId", "customOrder")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "GradeProjectStudent_gradeProjectId_studentId_key" ON "GradeProjectStudent"("gradeProjectId", "studentId")`
    )
  }

  if (!(await tableExists(prisma, "GradeDataSource"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "GradeDataSource" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "gradeItemId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "examProjectId" TEXT,
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
        CONSTRAINT "GradeDataSource_examProjectId_fkey" FOREIGN KEY ("examProjectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT "GradeDataSource_subtotalId_fkey" FOREIGN KEY ("subtotalId") REFERENCES "Subtotal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "GradeDataSource_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "GradeDataSource_gradeItemId_idx" ON "GradeDataSource"("gradeItemId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "GradeDataSource_examProjectId_idx" ON "GradeDataSource"("examProjectId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "GradeDataSource_subtotalId_idx" ON "GradeDataSource"("subtotalId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "GradeDataSource_cropRegionId_idx" ON "GradeDataSource"("cropRegionId")`
    )
  }

  if (!(await tableExists(prisma, "ManualScore"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "ManualScore" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "gradeDataSourceId" TEXT NOT NULL,
        "studentId" TEXT NOT NULL,
        "score" DECIMAL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "ManualScore_gradeDataSourceId_fkey" FOREIGN KEY ("gradeDataSourceId") REFERENCES "GradeDataSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "ManualScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "ManualScore_gradeDataSourceId_idx" ON "ManualScore"("gradeDataSourceId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "ManualScore_studentId_idx" ON "ManualScore"("studentId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "ManualScore_gradeDataSourceId_studentId_key" ON "ManualScore"("gradeDataSourceId", "studentId")`
    )
  }

  if (!(await tableExists(prisma, "GradeItemExclusion"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "GradeItemExclusion" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "gradeProjectId" TEXT NOT NULL,
        "studentId" TEXT NOT NULL,
        "gradeItemId" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "GradeItemExclusion_gradeProjectId_fkey" FOREIGN KEY ("gradeProjectId") REFERENCES "GradeProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "GradeItemExclusion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "GradeItemExclusion_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "GradeItemExclusion_gradeProjectId_idx" ON "GradeItemExclusion"("gradeProjectId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "GradeItemExclusion_studentId_idx" ON "GradeItemExclusion"("studentId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "GradeItemExclusion_gradeItemId_idx" ON "GradeItemExclusion"("gradeItemId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "GradeItemExclusion_gradeProjectId_studentId_gradeItemId_key" ON "GradeItemExclusion"("gradeProjectId", "studentId", "gradeItemId")`
    )
  }

  if (!(await tableExists(prisma, "GradeBoundarySet"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "GradeBoundarySet" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "gradeProjectId" TEXT NOT NULL,
        "targetType" TEXT NOT NULL,
        "gradeItemId" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "GradeBoundarySet_gradeProjectId_fkey" FOREIGN KEY ("gradeProjectId") REFERENCES "GradeProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "GradeBoundarySet_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "GradeBoundarySet_gradeProjectId_idx" ON "GradeBoundarySet"("gradeProjectId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "GradeBoundarySet_gradeProjectId_targetType_gradeItemId_key" ON "GradeBoundarySet"("gradeProjectId", "targetType", "gradeItemId")`
    )
  }

  if (!(await tableExists(prisma, "GradeOverride"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "GradeOverride" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "gradeProjectId" TEXT NOT NULL,
        "studentId" TEXT NOT NULL,
        "targetType" TEXT NOT NULL,
        "gradeItemId" TEXT,
        "overrideLabel" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "GradeOverride_gradeProjectId_fkey" FOREIGN KEY ("gradeProjectId") REFERENCES "GradeProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "GradeOverride_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "GradeOverride_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "GradeOverride_gradeProjectId_idx" ON "GradeOverride"("gradeProjectId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "GradeOverride_studentId_idx" ON "GradeOverride"("studentId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "GradeOverride_gradeItemId_idx" ON "GradeOverride"("gradeItemId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "GradeOverride_gradeProjectId_studentId_targetType_gradeItemId_key" ON "GradeOverride"("gradeProjectId", "studentId", "targetType", "gradeItemId")`
    )
  }

  if (!(await tableExists(prisma, "GradeBoundary"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "GradeBoundary" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "gradeBoundarySetId" TEXT NOT NULL,
        "label" TEXT NOT NULL,
        "minPercentage" DECIMAL NOT NULL,
        "order" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "GradeBoundary_gradeBoundarySetId_fkey" FOREIGN KEY ("gradeBoundarySetId") REFERENCES "GradeBoundarySet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "GradeBoundary_gradeBoundarySetId_idx" ON "GradeBoundary"("gradeBoundarySetId")`
    )
  }

  // 20260222000000: GradeProjectExportSettings
  if (!(await tableExists(prisma, "GradeProjectExportSettings"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "GradeProjectExportSettings" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "gradeProjectId" TEXT NOT NULL,
        "settingsJson" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "GradeProjectExportSettings_gradeProjectId_fkey" FOREIGN KEY ("gradeProjectId") REFERENCES "GradeProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "GradeProjectExportSettings_gradeProjectId_key" ON "GradeProjectExportSettings"("gradeProjectId")`
    )
  }

  // 20260226000000: StudentAnswerImage unique制約
  // 重複クリーンアップしてからUNIQUE INDEX追加
  try {
    await prisma.$executeRawUnsafe(`
      DELETE FROM "StudentAnswerImage"
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY "projectPageId", "studentId"
            ORDER BY "updatedAt" DESC
          ) as rn
          FROM "StudentAnswerImage"
        ) ranked
        WHERE rn = 1
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "StudentAnswerImage_projectPageId_studentId_key" ON "StudentAnswerImage"("projectPageId", "studentId")`
    )
  } catch {
    // インデックスが既に存在する場合はスキップ
  }
}

// ============================================================
// S6 → S7: Project→Examリネーム + ASB (v0.5.x-v0.6.x → v0.7.x)
// ============================================================
const migrateS6toS7 = async (prisma: PrismaClient): Promise<void> => {
  // 20260303000000: Project→Exam大規模リネーム
  // PRAGMA foreign_keys = ONが必要（ALTER TABLE RENAMEでFK参照も更新される）
  await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = ON`)

  // Step 1: テーブルリネーム
  await prisma.$executeRawUnsafe(`ALTER TABLE "Project" RENAME TO "Exam"`)
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ProjectStudent" RENAME TO "ExamStudent"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ProjectPage" RENAME TO "ExamPage"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "UserProject" RENAME TO "UserExam"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ProjectSubtotalGroup" RENAME TO "ExamSubtotalGroup"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ProjectClass" RENAME TO "ExamClass"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ProjectMarkingFormat" RENAME TO "ExamMarkingFormat"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ProjectExportSettings" RENAME TO "ExamExportSettings"`
  )
  await prisma.$executeRawUnsafe(`ALTER TABLE "GradeProject" RENAME TO "Grade"`)
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "GradeProjectClass" RENAME TO "GradeClass"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "GradeProjectStudent" RENAME TO "GradeStudent"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "GradeProjectExportSettings" RENAME TO "GradeExportSettings"`
  )

  // Step 2: カラムリネーム
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ExamStudent" RENAME COLUMN "projectId" TO "examId"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ExamPage" RENAME COLUMN "projectId" TO "examId"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "UserExam" RENAME COLUMN "projectId" TO "examId"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ExamSubtotalGroup" RENAME COLUMN "projectId" TO "examId"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ExamClass" RENAME COLUMN "projectId" TO "examId"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ExamMarkingFormat" RENAME COLUMN "projectId" TO "examId"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ExamExportSettings" RENAME COLUMN "projectId" TO "examId"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "MasterImage" RENAME COLUMN "projectPageId" TO "examPageId"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "StudentAnswerImage" RENAME COLUMN "projectPageId" TO "examPageId"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "CropRegion" RENAME COLUMN "projectPageId" TO "examPageId"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "GradeItem" RENAME COLUMN "gradeProjectId" TO "gradeId"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "GradeClass" RENAME COLUMN "gradeProjectId" TO "gradeId"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "GradeStudent" RENAME COLUMN "gradeProjectId" TO "gradeId"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "GradeItemExclusion" RENAME COLUMN "gradeProjectId" TO "gradeId"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "GradeBoundarySet" RENAME COLUMN "gradeProjectId" TO "gradeId"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "GradeOverride" RENAME COLUMN "gradeProjectId" TO "gradeId"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "GradeExportSettings" RENAME COLUMN "gradeProjectId" TO "gradeId"`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "GradeDataSource" RENAME COLUMN "examProjectId" TO "examId"`
  )

  // Step 3: インデックス再作成（DROP → CREATE）
  const indexRenames = [
    [
      `ProjectStudent_projectId_studentId_key`,
      `ExamStudent_examId_studentId_key`,
      `"ExamStudent"("examId", "studentId")`,
      true,
    ],
    [
      `ProjectStudent_projectId_idx`,
      `ExamStudent_examId_idx`,
      `"ExamStudent"("examId")`,
      false,
    ],
    [
      `ProjectStudent_studentId_idx`,
      `ExamStudent_studentId_idx`,
      `"ExamStudent"("studentId")`,
      false,
    ],
    [
      `ProjectStudent_projectId_customOrder_idx`,
      `ExamStudent_examId_customOrder_idx`,
      `"ExamStudent"("examId", "customOrder")`,
      false,
    ],
    [
      `StudentAnswerImage_projectPageId_studentId_key`,
      `StudentAnswerImage_examPageId_studentId_key`,
      `"StudentAnswerImage"("examPageId", "studentId")`,
      true,
    ],
    [
      `StudentAnswerImage_projectPageId_idx`,
      `StudentAnswerImage_examPageId_idx`,
      `"StudentAnswerImage"("examPageId")`,
      false,
    ],
    [
      `UserProject_userId_projectId_key`,
      `UserExam_userId_examId_key`,
      `"UserExam"("userId", "examId")`,
      true,
    ],
    [
      `UserProject_projectId_idx`,
      `UserExam_examId_idx`,
      `"UserExam"("examId")`,
      false,
    ],
    [
      `ProjectClass_projectId_classId_key`,
      `ExamClass_examId_classId_key`,
      `"ExamClass"("examId", "classId")`,
      true,
    ],
    [
      `ProjectClass_projectId_idx`,
      `ExamClass_examId_idx`,
      `"ExamClass"("examId")`,
      false,
    ],
    [
      `ProjectClass_classId_idx`,
      `ExamClass_classId_idx`,
      `"ExamClass"("classId")`,
      false,
    ],
    [
      `ProjectMarkingFormat_projectId_markType_key`,
      `ExamMarkingFormat_examId_markType_key`,
      `"ExamMarkingFormat"("examId", "markType")`,
      true,
    ],
    [
      `ProjectMarkingFormat_projectId_idx`,
      `ExamMarkingFormat_examId_idx`,
      `"ExamMarkingFormat"("examId")`,
      false,
    ],
    [
      `ProjectExportSettings_projectId_key`,
      `ExamExportSettings_examId_key`,
      `"ExamExportSettings"("examId")`,
      true,
    ],
    [
      `GradeItem_gradeProjectId_idx`,
      `GradeItem_gradeId_idx`,
      `"GradeItem"("gradeId")`,
      false,
    ],
    [
      `GradeProjectClass_gradeProjectId_classId_key`,
      `GradeClass_gradeId_classId_key`,
      `"GradeClass"("gradeId", "classId")`,
      true,
    ],
    [
      `GradeProjectClass_gradeProjectId_idx`,
      `GradeClass_gradeId_idx`,
      `"GradeClass"("gradeId")`,
      false,
    ],
    [
      `GradeProjectClass_classId_idx`,
      `GradeClass_classId_idx`,
      `"GradeClass"("classId")`,
      false,
    ],
    [
      `GradeProjectStudent_gradeProjectId_studentId_key`,
      `GradeStudent_gradeId_studentId_key`,
      `"GradeStudent"("gradeId", "studentId")`,
      true,
    ],
    [
      `GradeProjectStudent_gradeProjectId_idx`,
      `GradeStudent_gradeId_idx`,
      `"GradeStudent"("gradeId")`,
      false,
    ],
    [
      `GradeProjectStudent_studentId_idx`,
      `GradeStudent_studentId_idx`,
      `"GradeStudent"("studentId")`,
      false,
    ],
    [
      `GradeProjectStudent_gradeProjectId_customOrder_idx`,
      `GradeStudent_gradeId_customOrder_idx`,
      `"GradeStudent"("gradeId", "customOrder")`,
      false,
    ],
    [
      `GradeDataSource_examProjectId_idx`,
      `GradeDataSource_examId_idx`,
      `"GradeDataSource"("examId")`,
      false,
    ],
    [
      `GradeItemExclusion_gradeProjectId_studentId_gradeItemId_key`,
      `GradeItemExclusion_gradeId_studentId_gradeItemId_key`,
      `"GradeItemExclusion"("gradeId", "studentId", "gradeItemId")`,
      true,
    ],
    [
      `GradeItemExclusion_gradeProjectId_idx`,
      `GradeItemExclusion_gradeId_idx`,
      `"GradeItemExclusion"("gradeId")`,
      false,
    ],
    [
      `GradeBoundarySet_gradeProjectId_targetType_gradeItemId_key`,
      `GradeBoundarySet_gradeId_targetType_gradeItemId_key`,
      `"GradeBoundarySet"("gradeId", "targetType", "gradeItemId")`,
      true,
    ],
    [
      `GradeBoundarySet_gradeProjectId_idx`,
      `GradeBoundarySet_gradeId_idx`,
      `"GradeBoundarySet"("gradeId")`,
      false,
    ],
    [
      `GradeOverride_gradeProjectId_studentId_targetType_gradeItemId_key`,
      `GradeOverride_gradeId_studentId_targetType_gradeItemId_key`,
      `"GradeOverride"("gradeId", "studentId", "targetType", "gradeItemId")`,
      true,
    ],
    [
      `GradeOverride_gradeProjectId_idx`,
      `GradeOverride_gradeId_idx`,
      `"GradeOverride"("gradeId")`,
      false,
    ],
    [
      `GradeProjectExportSettings_gradeProjectId_key`,
      `GradeExportSettings_gradeId_key`,
      `"GradeExportSettings"("gradeId")`,
      true,
    ],
  ] as const

  for (const [oldName, newName, columns, isUnique] of indexRenames) {
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${oldName}"`)
    const uniqueStr = isUnique ? "UNIQUE " : ""
    await prisma.$executeRawUnsafe(
      `CREATE ${uniqueStr}INDEX "${newName}" ON ${columns}`
    )
  }

  // Step 4: データ値変更
  await prisma.$executeRawUnsafe(
    `UPDATE "GradeDataSource" SET "type" = 'exam_total' WHERE "type" = 'project_total'`
  )

  // 20260303100000: ASBテーブル追加
  if (!(await tableExists(prisma, "AsbDefinition"))) {
    // ASBテーブル群はmigration.sqlのIF NOT EXISTSをそのまま流用
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AsbDefinition" (
        "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL DEFAULT '新しい解答用紙',
        "renderMode" TEXT NOT NULL DEFAULT 'answer-sheet', "labelPresetMajor" TEXT, "labelPresetSub" TEXT, "labelPresetBranch" TEXT,
        "paperSize" TEXT NOT NULL DEFAULT 'A4', "orientation" TEXT NOT NULL DEFAULT 'portrait',
        "baseRowHeight" REAL NOT NULL DEFAULT 12, "numberDisplayMode" TEXT NOT NULL DEFAULT 'multirow',
        "marginTop" REAL NOT NULL DEFAULT 15, "marginBottom" REAL NOT NULL DEFAULT 15,
        "marginLeft" REAL NOT NULL DEFAULT 10, "marginRight" REAL NOT NULL DEFAULT 10,
        "colWidthMajorNumber" REAL NOT NULL DEFAULT 10, "colWidthSubNumber" REAL NOT NULL DEFAULT 10, "colWidthBranchNumber" REAL NOT NULL DEFAULT 10,
        "majorQuestionSpacing" REAL NOT NULL DEFAULT 5, "headerHeight" REAL NOT NULL DEFAULT 0,
        "borderOuterBorder" TEXT NOT NULL DEFAULT 'solid', "borderMajorDivider" TEXT NOT NULL DEFAULT 'solid',
        "borderSubDivider" TEXT NOT NULL DEFAULT 'solid', "borderBranchDivider" TEXT NOT NULL DEFAULT 'dashed',
        "borderMajorNumberDivider" TEXT NOT NULL DEFAULT 'solid', "borderSubNumberDivider" TEXT NOT NULL DEFAULT 'solid', "borderBranchNumberDivider" TEXT NOT NULL DEFAULT 'solid',
        "borderOuterBorderWidth" REAL DEFAULT 0.7, "borderMajorDividerWidth" REAL DEFAULT 0.5,
        "borderSubDividerWidth" REAL DEFAULT 0.4, "borderBranchDividerWidth" REAL DEFAULT 0.3,
        "borderMajorNumberDividerWidth" REAL DEFAULT 0.4, "borderSubNumberDividerWidth" REAL DEFAULT 0.4, "borderBranchNumberDividerWidth" REAL DEFAULT 0.3,
        "omrMarkersEnabled" BOOLEAN NOT NULL DEFAULT false, "omrMarkersSizeMm" REAL NOT NULL DEFAULT 5, "omrMarkersOffsetMm" REAL NOT NULL DEFAULT 3,
        "fontFamily" TEXT NOT NULL DEFAULT 'Noto Sans JP', "fontDefaultSize" REAL NOT NULL DEFAULT 6,
        "fontMajorNumberSize" REAL NOT NULL DEFAULT 6, "fontSubNumberSize" REAL NOT NULL DEFAULT 6, "fontBranchNumberSize" REAL NOT NULL DEFAULT 5,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, "userId" TEXT NOT NULL,
        CONSTRAINT "AsbDefinition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AsbDefinition_userId_idx" ON "AsbDefinition"("userId")`
    )

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AsbMajorQuestion" (
        "id" TEXT NOT NULL PRIMARY KEY, "definitionId" TEXT NOT NULL, "label" TEXT NOT NULL, "order" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "AsbMajorQuestion_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "AsbDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AsbMajorQuestion_definitionId_idx" ON "AsbMajorQuestion"("definitionId")`
    )

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AsbSubQuestion" (
        "id" TEXT NOT NULL PRIMARY KEY, "majorQuestionId" TEXT NOT NULL, "label" TEXT NOT NULL, "order" INTEGER NOT NULL DEFAULT 0,
        "heightMultiplier" REAL NOT NULL DEFAULT 1, "points" REAL NOT NULL DEFAULT 1, "usesBranchPoints" BOOLEAN,
        "layoutWidth" TEXT, "nextPlacement" TEXT, "goUp" INTEGER,
        "manuscriptEnabled" BOOLEAN NOT NULL DEFAULT false, "manuscriptColumns" INTEGER NOT NULL DEFAULT 20,
        "manuscriptRows" INTEGER NOT NULL DEFAULT 10, "manuscriptCellSizeMm" REAL NOT NULL DEFAULT 8,
        "borderStyleTop" TEXT, "borderStyleBottom" TEXT, "borderStyleLeft" TEXT, "borderStyleRight" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "AsbSubQuestion_majorQuestionId_fkey" FOREIGN KEY ("majorQuestionId") REFERENCES "AsbMajorQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AsbSubQuestion_majorQuestionId_idx" ON "AsbSubQuestion"("majorQuestionId")`
    )

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AsbBranchQuestion" (
        "id" TEXT NOT NULL PRIMARY KEY, "subQuestionId" TEXT NOT NULL, "label" TEXT NOT NULL, "order" INTEGER NOT NULL DEFAULT 0,
        "heightMultiplier" REAL NOT NULL DEFAULT 1, "points" REAL NOT NULL DEFAULT 1,
        "layoutWidth" TEXT, "nextPlacement" TEXT, "goUp" INTEGER,
        "borderStyleTop" TEXT, "borderStyleBottom" TEXT, "borderStyleLeft" TEXT, "borderStyleRight" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "AsbBranchQuestion_subQuestionId_fkey" FOREIGN KEY ("subQuestionId") REFERENCES "AsbSubQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AsbBranchQuestion_subQuestionId_idx" ON "AsbBranchQuestion"("subQuestionId")`
    )

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AsbTextElement" (
        "id" TEXT NOT NULL PRIMARY KEY, "subQuestionId" TEXT, "branchQuestionId" TEXT,
        "text" TEXT NOT NULL, "fontSize" REAL NOT NULL, "horizontalAlign" TEXT NOT NULL DEFAULT 'left', "verticalAlign" TEXT NOT NULL DEFAULT 'top',
        "order" INTEGER NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "AsbTextElement_subQuestionId_fkey" FOREIGN KEY ("subQuestionId") REFERENCES "AsbSubQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "AsbTextElement_branchQuestionId_fkey" FOREIGN KEY ("branchQuestionId") REFERENCES "AsbBranchQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AsbTextElement_subQuestionId_idx" ON "AsbTextElement"("subQuestionId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AsbTextElement_branchQuestionId_idx" ON "AsbTextElement"("branchQuestionId")`
    )

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AsbOmrConfig" (
        "id" TEXT NOT NULL PRIMARY KEY, "subQuestionId" TEXT, "branchQuestionId" TEXT,
        "type" TEXT NOT NULL, "numChoices" INTEGER, "choiceLayout" TEXT, "numDigits" INTEGER, "correctAnswer" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "AsbOmrConfig_subQuestionId_fkey" FOREIGN KEY ("subQuestionId") REFERENCES "AsbSubQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "AsbOmrConfig_branchQuestionId_fkey" FOREIGN KEY ("branchQuestionId") REFERENCES "AsbBranchQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "AsbOmrConfig_subQuestionId_key" ON "AsbOmrConfig"("subQuestionId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "AsbOmrConfig_branchQuestionId_key" ON "AsbOmrConfig"("branchQuestionId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AsbOmrConfig_subQuestionId_idx" ON "AsbOmrConfig"("subQuestionId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AsbOmrConfig_branchQuestionId_idx" ON "AsbOmrConfig"("branchQuestionId")`
    )

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AsbOmrChoiceOption" (
        "id" TEXT NOT NULL PRIMARY KEY, "omrConfigId" TEXT NOT NULL, "choiceIndex" INTEGER NOT NULL,
        "label" TEXT NOT NULL, "isCorrect" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "AsbOmrChoiceOption_omrConfigId_fkey" FOREIGN KEY ("omrConfigId") REFERENCES "AsbOmrConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "AsbOmrChoiceOption_omrConfigId_choiceIndex_key" ON "AsbOmrChoiceOption"("omrConfigId", "choiceIndex")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AsbOmrChoiceOption_omrConfigId_idx" ON "AsbOmrChoiceOption"("omrConfigId")`
    )
  }

  // 20260303200000: DrawingAnnotation再定義 (isFavorite追加 + userId変更)
  // createdByUserId → userId、isFavorite追加
  // isFavoriteが旧migrationRunnerでADD COLUMNされていても、createdByUserId→userIdが未変更の場合は再定義が必要
  const daColumns = await getTableColumns(prisma, "DrawingAnnotation")
  const needsRedefinition =
    daColumns.length > 0 &&
    (!daColumns.includes("isFavorite") || daColumns.includes("createdByUserId"))
  if (needsRedefinition) {
    // userId列の取得元を動的に決定（createdByUserIdが存在する旧スキーマ対応）
    const userIdExpr = daColumns.includes("userId")
      ? `"userId"`
      : daColumns.includes("createdByUserId")
        ? `"createdByUserId"`
        : `(SELECT "id" FROM "User" LIMIT 1)`

    // isFavoriteの取得（存在しない場合はデフォルト値）
    const isFavoriteExpr = daColumns.includes("isFavorite")
      ? `"isFavorite"`
      : `0`

    await prisma.$executeRawUnsafe(`PRAGMA defer_foreign_keys=ON`)
    await prisma.$executeRawUnsafe(`PRAGMA foreign_keys=OFF`)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "new_DrawingAnnotation" (
        "id" TEXT NOT NULL PRIMARY KEY, "questionScoreId" TEXT NOT NULL, "type" TEXT NOT NULL,
        "x" REAL NOT NULL, "y" REAL NOT NULL, "color" TEXT NOT NULL DEFAULT '#ef4444',
        "strokeWidth" INTEGER NOT NULL DEFAULT 3, "width" REAL NOT NULL DEFAULT 0.0, "height" REAL NOT NULL DEFAULT 0.0,
        "endX" REAL NOT NULL DEFAULT 0.0, "endY" REAL NOT NULL DEFAULT 0.0, "lineStyle" TEXT NOT NULL DEFAULT 'solid',
        "text" TEXT NOT NULL DEFAULT '', "fontSize" INTEGER NOT NULL DEFAULT 16,
        "textBoxWidth" REAL NOT NULL DEFAULT 0.0, "textBoxHeight" REAL NOT NULL DEFAULT 0.0,
        "horizontalAlign" TEXT NOT NULL DEFAULT 'left', "verticalAlign" TEXT NOT NULL DEFAULT 'top',
        "anchorDirection" TEXT NOT NULL DEFAULT 'top-left', "displayX" REAL NOT NULL DEFAULT 0.0, "displayY" REAL NOT NULL DEFAULT 0.0,
        "isFavorite" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
        "userId" TEXT NOT NULL,
        CONSTRAINT "DrawingAnnotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "DrawingAnnotation_questionScoreId_fkey" FOREIGN KEY ("questionScoreId") REFERENCES "QuestionScore" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(`
      INSERT INTO "new_DrawingAnnotation" ("anchorDirection", "color", "createdAt", "displayX", "displayY", "endX", "endY", "fontSize", "height", "horizontalAlign", "id", "isFavorite", "lineStyle", "questionScoreId", "strokeWidth", "text", "textBoxHeight", "textBoxWidth", "type", "updatedAt", "userId", "verticalAlign", "width", "x", "y")
      SELECT "anchorDirection", "color", "createdAt", "displayX", "displayY", "endX", "endY", "fontSize", "height", "horizontalAlign", "id", ${isFavoriteExpr}, "lineStyle", "questionScoreId", "strokeWidth", "text", "textBoxHeight", "textBoxWidth", "type", "updatedAt", ${userIdExpr}, "verticalAlign", "width", "x", "y" FROM "DrawingAnnotation"
    `)
    await prisma.$executeRawUnsafe(`DROP TABLE "DrawingAnnotation"`)
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "new_DrawingAnnotation" RENAME TO "DrawingAnnotation"`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "DrawingAnnotation_questionScoreId_idx" ON "DrawingAnnotation"("questionScoreId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "DrawingAnnotation_type_idx" ON "DrawingAnnotation"("type")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "DrawingAnnotation_createdAt_idx" ON "DrawingAnnotation"("createdAt")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "DrawingAnnotation_isFavorite_idx" ON "DrawingAnnotation"("isFavorite")`
    )
    await prisma.$executeRawUnsafe(`PRAGMA foreign_keys=ON`)
    await prisma.$executeRawUnsafe(`PRAGMA defer_foreign_keys=OFF`)
  }
}

// ============================================================
// S7 → S8: +ASBカラム、+CropRegionOmr (v0.7.x → v0.8.x)
// ============================================================
const migrateS7toS8 = async (prisma: PrismaClient): Promise<void> => {
  // 既存migrationRunnerのロジックを再利用（S7内の差分もカバー）

  // AsbImageElement テーブル
  if (
    !(await tableExists(prisma, "AsbImageElement")) &&
    (await tableExists(prisma, "AsbSubQuestion"))
  ) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "AsbImageElement" (
        "id" TEXT NOT NULL PRIMARY KEY, "subQuestionId" TEXT, "branchQuestionId" TEXT,
        "imagePath" TEXT NOT NULL, "originalName" TEXT NOT NULL,
        "objectFit" TEXT NOT NULL DEFAULT 'contain', "horizontalAlign" TEXT NOT NULL DEFAULT 'center', "verticalAlign" TEXT NOT NULL DEFAULT 'middle',
        "opacity" REAL NOT NULL DEFAULT 1, "visibility" TEXT NOT NULL DEFAULT 'both', "order" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
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
  }

  // AsbDefinition multiColumn カラム
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
  }

  // AsbHeaderField テーブル
  if (
    !(await tableExists(prisma, "AsbHeaderField")) &&
    (await tableExists(prisma, "AsbDefinition"))
  ) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "AsbHeaderField" (
        "id" TEXT NOT NULL PRIMARY KEY, "definitionId" TEXT NOT NULL,
        "type" TEXT NOT NULL DEFAULT 'field', "label" TEXT NOT NULL,
        "widthMm" REAL NOT NULL DEFAULT 30, "heightMm" REAL NOT NULL DEFAULT 8,
        "gridCount" INTEGER NOT NULL DEFAULT 0, "lineStyle" TEXT NOT NULL DEFAULT 'solid', "lineWidth" REAL NOT NULL DEFAULT 0.4,
        "order" INTEGER NOT NULL DEFAULT 0, "fontSize" REAL, "linkedRegionType" TEXT,
        CONSTRAINT "AsbHeaderField_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "AsbDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AsbHeaderField_definitionId_idx" ON "AsbHeaderField"("definitionId")`
    )
  }

  // AsbImageElement.visibility（テーブル作成時に含まれるが、既存テーブルの場合）
  const imgColumns = await getTableColumns(prisma, "AsbImageElement")
  if (imgColumns.length > 0 && !imgColumns.includes("visibility")) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "AsbImageElement" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'both'`
    )
  }

  // AsbHeaderField.type, fontSize（テーブル作成時に含まれるが、既存テーブルの場合）
  const hfColumns = await getTableColumns(prisma, "AsbHeaderField")
  if (hfColumns.length > 0 && !hfColumns.includes("type")) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "AsbHeaderField" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'field'`
    )
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "AsbHeaderField" ADD COLUMN "fontSize" REAL`
    )
  }
  if (hfColumns.length > 0 && !hfColumns.includes("linkedRegionType")) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "AsbHeaderField" ADD COLUMN "linkedRegionType" TEXT`
    )
  }

  // CropRegionOmrConfig テーブル
  if (!(await tableExists(prisma, "CropRegionOmrConfig"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "CropRegionOmrConfig" (
        "id" TEXT NOT NULL PRIMARY KEY, "cropRegionId" TEXT NOT NULL, "type" TEXT NOT NULL,
        "numChoices" INTEGER, "choiceLayout" TEXT, "numDigits" INTEGER, "correctAnswer" TEXT,
        "cellGeometryJson" TEXT, "colorThreshold" INTEGER, "areaThreshold" REAL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "CropRegionOmrConfig_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "CropRegionOmrConfig_cropRegionId_key" ON "CropRegionOmrConfig"("cropRegionId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "CropRegionOmrConfig_cropRegionId_idx" ON "CropRegionOmrConfig"("cropRegionId")`
    )
  }

  // CropRegionOmrChoiceOption テーブル
  if (
    !(await tableExists(prisma, "CropRegionOmrChoiceOption")) &&
    (await tableExists(prisma, "CropRegionOmrConfig"))
  ) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "CropRegionOmrChoiceOption" (
        "id" TEXT NOT NULL PRIMARY KEY, "omrConfigId" TEXT NOT NULL, "choiceIndex" INTEGER NOT NULL,
        "label" TEXT NOT NULL, "isCorrect" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "CropRegionOmrChoiceOption_omrConfigId_fkey" FOREIGN KEY ("omrConfigId") REFERENCES "CropRegionOmrConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "CropRegionOmrChoiceOption_omrConfigId_choiceIndex_key" ON "CropRegionOmrChoiceOption"("omrConfigId", "choiceIndex")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "CropRegionOmrChoiceOption_omrConfigId_idx" ON "CropRegionOmrChoiceOption"("omrConfigId")`
    )
  }
}

// ============================================================
// S8 → S9: +DeletedRecord, UserPreference変換, px→mm (v0.8.x → v0.9.x)
// ============================================================
const migrateS8toS9 = async (prisma: PrismaClient): Promise<void> => {
  // 20260315000000: UserScoringPreference → UserPreference (KV)
  if (await tableExists(prisma, "UserScoringPreference")) {
    // 旧UserPreference（1:1形式）を削除してKV形式を作成
    const upColumns = await getTableColumns(prisma, "UserPreference")
    if (upColumns.length > 0 && !upColumns.includes("key")) {
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "UserPreference"`)
    }

    if (!(await tableExists(prisma, "UserPreference"))) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "UserPreference" (
          "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "key" TEXT NOT NULL, "value" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `)
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX "UserPreference_userId_key_key" ON "UserPreference"("userId", "key")`
      )
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "UserPreference_userId_idx" ON "UserPreference"("userId")`
      )
    }

    // データ移行: UserScoringPreference → UserPreference
    const uuidExpr = `lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))`

    const prefKeys = [
      {
        key: "showStudentNames",
        expr: `CASE WHEN "showStudentNames" = 1 THEN 'true' ELSE 'false' END`,
      },
      {
        key: "autoScroll",
        expr: `CASE WHEN "autoScroll" = 1 THEN 'true' ELSE 'false' END`,
      },
      { key: "itemsPerLine", expr: `CAST("itemsPerLine" AS TEXT)` },
      { key: "layoutDirection", expr: `'"' || "layoutDirection" || '"'` },
      { key: "expandMargin", expr: `CAST("expandMargin" AS TEXT)` },
    ]

    for (const { key, expr } of prefKeys) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "UserPreference" ("id", "userId", "key", "value", "createdAt", "updatedAt")
        SELECT ${uuidExpr}, "userId", '${key}', ${expr}, "createdAt", "updatedAt"
        FROM "UserScoringPreference"
      `)
    }

    // nullable カラムのデータ移行
    const nullableKeys = [
      {
        key: "selectionBorderColor",
        expr: `'"' || "selectionBorderColor" || '"'`,
        col: "selectionBorderColor",
      },
      {
        key: "scoringStatusColors",
        expr: `"scoringStatusColors"`,
        col: "scoringStatusColors",
      },
      {
        key: "scoringColorPresetId",
        expr: `'"' || "scoringColorPresetId" || '"'`,
        col: "scoringColorPresetId",
      },
    ]

    for (const { key, expr, col } of nullableKeys) {
      const colExists = (
        await getTableColumns(prisma, "UserScoringPreference")
      ).includes(col)
      if (colExists) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "UserPreference" ("id", "userId", "key", "value", "createdAt", "updatedAt")
          SELECT ${uuidExpr}, "userId", '${key}', ${expr}, "createdAt", "updatedAt"
          FROM "UserScoringPreference" WHERE "${col}" IS NOT NULL
        `)
      }
    }

    await prisma.$executeRawUnsafe(`DROP TABLE "UserScoringPreference"`)
  } else {
    // UserScoringPreferenceが存在しない場合（新しめのDB）
    // UserPreference がKV形式でなければ再作成
    const upColumns = await getTableColumns(prisma, "UserPreference")
    if (upColumns.length > 0 && !upColumns.includes("key")) {
      await prisma.$executeRawUnsafe(`DROP TABLE "UserPreference"`)
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "UserPreference" (
          "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "key" TEXT NOT NULL, "value" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `)
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX "UserPreference_userId_key_key" ON "UserPreference"("userId", "key")`
      )
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "UserPreference_userId_idx" ON "UserPreference"("userId")`
      )
    }
  }

  // 20260316000000: MasterImage.pageSize + strokeWidth/fontSize px→mm
  const miColumns = await getTableColumns(prisma, "MasterImage")
  if (miColumns.length > 0 && !miColumns.includes("pageSize")) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "MasterImage" ADD COLUMN "pageSize" TEXT NOT NULL DEFAULT 'A4'`
    )
  }

  // DrawingAnnotation strokeWidth/fontSize px→mm変換
  const result = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM "DrawingAnnotation" WHERE "strokeWidth" >= 1`
  )
  const count = result[0]?.cnt ?? 0
  if (count > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE "DrawingAnnotation" SET "strokeWidth" = ROUND("strokeWidth" * 210.0 / 1190.0, 2), "fontSize" = ROUND("fontSize" * 210.0 / 1190.0, 2) WHERE "strokeWidth" >= 1`
    )
    console.info(
      `Converted ${count} DrawingAnnotation strokeWidth/fontSize from px to mm`
    )
  }

  // 20260322000000: DeletedRecord テーブル
  if (!(await tableExists(prisma, "DeletedRecord"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "DeletedRecord" (
        "id" TEXT NOT NULL PRIMARY KEY, "tableName" TEXT NOT NULL, "recordId" TEXT NOT NULL,
        "deletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "userId" TEXT, "examId" TEXT
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "DeletedRecord_examId_idx" ON "DeletedRecord"("examId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "DeletedRecord_deletedAt_idx" ON "DeletedRecord"("deletedAt")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "DeletedRecord_tableName_recordId_key" ON "DeletedRecord"("tableName", "recordId")`
    )
  }

  // v0.10.x: OMRバブル位置カラム追加 + CropRegionOmrDigitBox + CompoundAnswer
  if (await tableExists(prisma, "CropRegionOmrChoiceOption")) {
    const columns = await getTableColumns(prisma, "CropRegionOmrChoiceOption")
    if (!columns.includes("normalizedCx")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "CropRegionOmrChoiceOption" ADD COLUMN "shape" TEXT DEFAULT 'ellipse'`
      )
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "CropRegionOmrChoiceOption" ADD COLUMN "normalizedCx" REAL`
      )
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "CropRegionOmrChoiceOption" ADD COLUMN "normalizedCy" REAL`
      )
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "CropRegionOmrChoiceOption" ADD COLUMN "normalizedWidth" REAL`
      )
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "CropRegionOmrChoiceOption" ADD COLUMN "normalizedHeight" REAL`
      )
    }
  }

  if (!(await tableExists(prisma, "CropRegionOmrDigitBox"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "CropRegionOmrDigitBox" (
        "id" TEXT NOT NULL PRIMARY KEY, "omrConfigId" TEXT NOT NULL, "digitIndex" INTEGER NOT NULL,
        "normalizedX" REAL NOT NULL, "normalizedY" REAL NOT NULL, "normalizedW" REAL NOT NULL, "normalizedH" REAL NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "CropRegionOmrDigitBox_omrConfigId_fkey" FOREIGN KEY ("omrConfigId") REFERENCES "CropRegionOmrConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "CropRegionOmrDigitBox_omrConfigId_idx" ON "CropRegionOmrDigitBox"("omrConfigId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "CropRegionOmrDigitBox_omrConfigId_digitIndex_key" ON "CropRegionOmrDigitBox"("omrConfigId", "digitIndex")`
    )
  }

  if (!(await tableExists(prisma, "CompoundAnswer"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "CompoundAnswer" (
        "id" TEXT NOT NULL PRIMARY KEY, "examPageId" TEXT NOT NULL,
        "label" TEXT NOT NULL, "answerFormat" TEXT NOT NULL, "correctAnswer" TEXT NOT NULL,
        "points" INTEGER NOT NULL DEFAULT 0, "orderIndex" INTEGER,
        "alternativeAnswers" TEXT, "requireReduced" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CompoundAnswer_examPageId_fkey" FOREIGN KEY ("examPageId") REFERENCES "ExamPage" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "CompoundAnswer_examPageId_idx" ON "CompoundAnswer"("examPageId")`
    )
  }

  if (!(await tableExists(prisma, "CompoundAnswerMember"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "CompoundAnswerMember" (
        "id" TEXT NOT NULL PRIMARY KEY, "compoundAnswerId" TEXT NOT NULL,
        "cropRegionId" TEXT NOT NULL, "order" INTEGER NOT NULL,
        "roleLabel" TEXT, "separator" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CompoundAnswerMember_compoundAnswerId_fkey" FOREIGN KEY ("compoundAnswerId") REFERENCES "CompoundAnswer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "CompoundAnswerMember_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "CompoundAnswerMember_cropRegionId_key" ON "CompoundAnswerMember"("cropRegionId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "CompoundAnswerMember_compoundAnswerId_idx" ON "CompoundAnswerMember"("compoundAnswerId")`
    )
  }

  if (!(await tableExists(prisma, "CompoundAnswerScore"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "CompoundAnswerScore" (
        "id" TEXT NOT NULL PRIMARY KEY, "compoundAnswerId" TEXT NOT NULL,
        "studentId" TEXT NOT NULL, "userId" TEXT NOT NULL,
        "recognizedAnswer" TEXT, "status" TEXT NOT NULL DEFAULT 'unscored', "partialScore" DECIMAL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CompoundAnswerScore_compoundAnswerId_fkey" FOREIGN KEY ("compoundAnswerId") REFERENCES "CompoundAnswer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "CompoundAnswerScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "CompoundAnswerScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "CompoundAnswerScore_compoundAnswerId_studentId_key" ON "CompoundAnswerScore"("compoundAnswerId", "studentId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "CompoundAnswerScore_compoundAnswerId_idx" ON "CompoundAnswerScore"("compoundAnswerId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "CompoundAnswerScore_studentId_idx" ON "CompoundAnswerScore"("studentId")`
    )
  }
}
