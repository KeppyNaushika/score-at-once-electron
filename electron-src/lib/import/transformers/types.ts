/**
 * アーカイブ変換器の型定義
 *
 * 連鎖変換パターン: 1.0.0 → 1.1.0 → 1.2.0 → ...
 * 各変換器は「次のバージョンへの変換」のみを担当する
 */

import type {
  ArchiveClassesData,
  ArchiveDeletedRecordsData,
  ArchiveExamData,
  ArchiveManifest,
  ArchiveScoresData,
  ArchiveStudentsData,
  ArchiveSubjectsData,
  ArchiveSubtotalsData,
  ArchiveTagsData,
  ArchiveUsersData,
} from "../../../../src/types/examArchive.types"

// =============================================================================
// Archive Version Types
// =============================================================================

/**
 * サポートされているアーカイブバージョン
 *
 * - 1.0.0: v0.2.x (UserExam.invitedAt/invitedBy なし, PageImage使用)
 * - 1.1.0: v0.3.x (UserExam完全対応, ExamClassroom追加, PageImage使用)
 * - 1.2.0: v0.4.x (MasterImage/StudentAnswerImage分離, userId/studentId非NULL)
 * - 1.3.0: v0.5.x (Student.studentId → Student.studentNumber リネーム)
 * - 1.4.0: v0.5.x (ExamMarkingFormat, ExamExportSettings, CropRegionMarkingOverride, Subject, SubjectSubtotalGroup追加)
 * - 1.5.0: v0.6.x (Project→Exam, GradeProject→Grade リネーム、DBスキーマ変更)
 * - 1.6.0: v0.7.x (DrawingAnnotation.isFavorite 追加)
 * - 1.7.0: v0.8.x (CropRegionOmrConfig, CropRegionOmrChoiceOption 追加)
 * - 1.8.0: v0.9.x (MasterImage.pageSize 追加)
 * - 1.9.0: v0.9.x (DeletedRecord tombstone 追加)
 * - 1.10.0: v0.9.x (Subject→Tag リネーム, ExamTag 追加, Exam.subject 削除)
 * - 1.11.0: v0.10.x (OMRバブル位置永続化, CropRegionOmrDigitBox追加, CompoundAnswer追加, cellGeometryJson削除)
 * - 1.12.0: v0.12.x (Exam.markerCorrectionEnabled 追加 — ASB由来試験のマーク補正既定ONフラグ)
 * - 1.13.0: v0.12.x (ScoreDecision 追加 — OWNERによる確定スコア。QuestionScoreのstatus proposed/final廃止)
 * - 1.14.0: v0.13.x (ReturnSnapshot 追加 — 答案返却版スナップショット。返却後の採点修正差分検出用)
 * - 1.15.0: v0.14.x (ExamClassroom に teacherStat/studentReport、ExamSubtotalGroup に selectedForTable/selectedForBoxPlot 追加 — 学級統計再設計。statistics 廃止)
 * - 1.16.0: v0.14.x (物理テーブル名を Classroom 系へ統一、ExamClassroom.teacherStat → teacherStatistics リネーム。読込は旧 teacherStat/statistics を補完)
 */
export type ArchiveVersion =
  | "1.0.0"
  | "1.1.0"
  | "1.2.0"
  | "1.3.0"
  | "1.4.0"
  | "1.5.0"
  | "1.6.0"
  | "1.7.0"
  | "1.8.0"
  | "1.9.0"
  | "1.10.0"
  | "1.11.0"
  | "1.12.0"
  | "1.13.0"
  | "1.14.0"
  | "1.15.0"
  | "1.16.0"
  | "1.17.0"

/** 現在の最新バージョン */
export const CURRENT_VERSION: ArchiveVersion = "1.17.0"

/** サポートされている全バージョン（古い順） */
export const SUPPORTED_VERSIONS: readonly ArchiveVersion[] = [
  "1.0.0",
  "1.1.0",
  "1.2.0",
  "1.3.0",
  "1.4.0",
  "1.5.0",
  "1.6.0",
  "1.7.0",
  "1.8.0",
  "1.9.0",
  "1.10.0",
  "1.11.0",
  "1.12.0",
  "1.13.0",
  "1.14.0",
  "1.15.0",
  "1.16.0",
  "1.17.0",
] as const

// =============================================================================
// Transformer Interface
// =============================================================================

/**
 * アーカイブデータ（変換対象）
 */
export interface ArchiveData {
  manifest: ArchiveManifest
  examData: ArchiveExamData
  studentsData: ArchiveStudentsData
  classesData: ArchiveClassesData
  usersData: ArchiveUsersData
  subtotalsData: ArchiveSubtotalsData
  scoresData: ArchiveScoresData
  /** v1.4.0-v1.9.0 教科データ (deprecated, v1.10.0でtagsDataに移行) */
  subjectsData?: ArchiveSubjectsData
  /** v1.10.0+ タグデータ (v1.10.0でSubject→Tagにリネーム) */
  tagsData?: ArchiveTagsData
  /** v1.9.0+ 削除記録データ */
  deletedRecordsData?: ArchiveDeletedRecordsData
}

/**
 * 変換結果
 */
export interface TransformResult {
  /** 変換後のデータ */
  data: ArchiveData
  /** 変換時の警告メッセージ */
  warnings: string[]
}

/**
 * バージョン変換器インターフェース
 *
 * 各変換器は「特定のバージョンから次のバージョンへ」の変換を担当する
 */
export interface VersionTransformer {
  /** 変換元バージョン */
  readonly fromVersion: ArchiveVersion
  /** 変換先バージョン */
  readonly toVersion: ArchiveVersion

  /**
   * アーカイブデータを次のバージョンに変換
   *
   * @param data - 変換元のアーカイブデータ
   * @returns 変換結果（データと警告）
   */
  transform(data: ArchiveData): TransformResult
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * 変換チェーン構築用のバージョンペア
 */
export interface VersionPair {
  from: ArchiveVersion
  to: ArchiveVersion
}

/**
 * 変換チェーンの実行結果
 */
export interface ChainTransformResult {
  /** 変換後のデータ */
  data: ArchiveData
  /** 元のバージョン */
  originalVersion: ArchiveVersion
  /** 最終バージョン */
  finalVersion: ArchiveVersion
  /** 適用された変換のリスト */
  appliedTransformations: VersionPair[]
  /** 累積された警告メッセージ */
  warnings: string[]
}
