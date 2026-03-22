import { createSharedPrismaClient } from "../databaseInitializer"
import { getTableColumns, tableExists } from "../databaseUtils"

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

    // --- Migration: MasterImage.pageSize (20260316000000) ---
    try {
      const miColumns = await getTableColumns(prisma, "MasterImage")
      if (miColumns.length > 0 && !miColumns.includes("pageSize")) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "MasterImage" ADD COLUMN "pageSize" TEXT NOT NULL DEFAULT 'A4'`
        )
        console.info("Migration: Added pageSize column to MasterImage")
      }
    } catch (error) {
      console.warn("Migration MasterImage.pageSize failed:", error)
    }

    // --- Migration: DrawingAnnotation strokeWidth/fontSize px→mm変換 (20260316000001) ---
    // A4 portrait + PDF scale=2.0 基準: 1px ≈ 210mm / 1190px ≈ 0.1765mm
    // strokeWidth >= 1 のレコードは旧px値と判定し変換
    try {
      const result = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
        `SELECT COUNT(*) as cnt FROM "DrawingAnnotation" WHERE "strokeWidth" >= 1`
      )
      const count = result[0]?.cnt ?? 0
      if (count > 0) {
        await prisma.$executeRawUnsafe(
          `UPDATE "DrawingAnnotation" SET "strokeWidth" = ROUND("strokeWidth" * 210.0 / 1190.0, 2), "fontSize" = ROUND("fontSize" * 210.0 / 1190.0, 2) WHERE "strokeWidth" >= 1`
        )
        console.info(
          `Migration: Converted ${count} DrawingAnnotation strokeWidth/fontSize from px to mm`
        )
      }
    } catch (error) {
      console.warn(
        "Migration DrawingAnnotation strokeWidth/fontSize conversion failed:",
        error
      )
    }
  } catch (error) {
    console.error("Database migration failed:", error)
  } finally {
    await prisma.$disconnect()
  }
}
