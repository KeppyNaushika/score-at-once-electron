/**
 * sqlite-nas-syncに渡すテーブル設定
 *
 * Prisma schemaの全データテーブルを対象。
 * ローカル設定テーブル（UserKeyboardShortcut, UserPreference）と
 * Answer Sheet Builder関連テーブル（Asb*）は除外。
 */

import type { TableConfig } from "sqlite-nas-sync"

/** 標準テーブル設定（timestampColumn: 'updatedAt'） */
function std(name: string): TableConfig {
  return { name }
}

/** sqlite-nas-syncの同期対象テーブル一覧 */
export const SYNC_TABLES: TableConfig[] = [
  // ユーザー・生徒・学級
  std("User"),
  std("Student"),
  { name: "classes" }, // Prisma model "Class" → @@map("classes")
  std("StudentClassMembership"),

  // 試験構造
  std("Exam"),
  std("ExamPage"),
  std("CropRegion"),
  std("MasterImage"),
  std("StudentAnswerImage"),
  std("ExamStudent"),
  std("UserExam"),
  std("ExamClass"),

  // 採点データ
  std("QuestionScore"),
  std("DrawingAnnotation"),

  // 小計・タグ
  std("SubtotalGroup"),
  std("Subtotal"),
  std("CropSubtotal"),
  std("ExamSubtotalGroup"),
  std("Tag"),
  std("TagSubtotalGroup"),
  std("ExamTag"),

  // 試験設定
  std("ExamMarkingFormat"),
  std("ExamExportSettings"),
  std("CropRegionMarkingOverride"),
  std("CropRegionOmrConfig"),
  std("CropRegionOmrChoiceOption"),

  // 成績管理
  std("Grade"),
  std("GradeItem"),
  std("GradeClass"),
  std("GradeStudent"),
  std("GradeDataSource"),
  std("ManualScore"),
  std("GradeItemExclusion"),
  std("GradeBoundarySet"),
  std("GradeBoundary"),
  std("GradeOverride"),
  std("GradeExportSettings"),

  // 削除記録（tombstone）
  {
    name: "DeletedRecord",
    timestampColumn: "deletedAt",
    deleteProtected: true,
  },
]
