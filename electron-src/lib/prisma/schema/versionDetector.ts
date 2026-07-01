import { PrismaClient } from "@prisma/client"

import { getTableColumns, tableExists } from "../databaseUtils"

/**
 * データベースのスキーマバージョン
 *
 * S3=v0.2.x, S4=v0.3.x, S5=v0.4.x, S6=v0.5.x-v0.6.x,
 * S7=v0.7.x, S8=v0.8.x, S9=v0.9.x(現行)
 */
export type SchemaVersion =
  "S3" | "S4" | "S5" | "S6" | "S7" | "S8" | "S9" | "MIGRATED" | "UNKNOWN"

/** 既存DBのスキーマ状態を検出する */
export const detectSchemaVersion = async (
  prisma: PrismaClient
): Promise<SchemaVersion> => {
  // _prisma_migrationsテーブルが存在すればPrisma管理に移行済み
  if (await tableExists(prisma, "_prisma_migrations")) {
    return "MIGRATED"
  }

  const hasExamTable = await tableExists(prisma, "Exam")

  if (hasExamTable) {
    // S7+ (Post Project→Exam rename)
    return detectPostRenameVersion(prisma)
  }

  const hasProjectTable = await tableExists(prisma, "Project")

  if (hasProjectTable) {
    // S3〜S6 (Pre-rename)
    return detectPreRenameVersion(prisma)
  }

  return "UNKNOWN"
}

/** S7以降のバージョン検出 (Exam命名) */
const detectPostRenameVersion = async (
  prisma: PrismaClient
): Promise<SchemaVersion> => {
  // S9: DeletedRecordテーブル + UserPreferenceにkey列
  const hasDeletedRecord = await tableExists(prisma, "DeletedRecord")
  if (hasDeletedRecord) {
    const upColumns = await getTableColumns(prisma, "UserPreference")
    if (upColumns.includes("key")) {
      return "S9"
    }
  }

  // S9(部分): UserPreferenceがKV形式に移行済み
  const upColumns = await getTableColumns(prisma, "UserPreference")
  if (upColumns.includes("key")) {
    return "S9"
  }

  // S8: CropRegionOmrConfigテーブル存在
  if (await tableExists(prisma, "CropRegionOmrConfig")) {
    return "S8"
  }

  return "S7"
}

/** S3〜S6のバージョン検出 (Project命名) */
const detectPreRenameVersion = async (
  prisma: PrismaClient
): Promise<SchemaVersion> => {
  // S6: GradeProjectテーブル存在
  if (await tableExists(prisma, "GradeProject")) {
    return "S6"
  }

  // S5: MasterImageテーブル存在 (PageImage分割後)
  if (await tableExists(prisma, "MasterImage")) {
    return "S5"
  }

  // S4: ProjectClassテーブル存在
  if (await tableExists(prisma, "ProjectClass")) {
    return "S4"
  }

  // S3: 基本テーブルのみ
  return "S3"
}
