/**
 * sqlite-nas-syncのテーブル同期設定
 *
 * v0.8.0以降、同期対象テーブルはDBから自動検出される。
 * ここではローカル専用テーブルの除外リストと、
 * 特殊なテーブルオプションのみを定義する。
 */

import type { TableOptions } from "sqlite-nas-sync"

/**
 * 同期から除外するテーブル一覧
 *
 * ローカル設定テーブル（UserKeyboardShortcut, UserPreference）と
 * Answer Sheet Builder関連テーブル（Asb*）は端末固有のため除外。
 */
export const SYNC_EXCLUDE_TABLES: string[] = [
  "UserKeyboardShortcut",
  "UserPreference",
  "AsbDefinition",
  "AsbHeaderField",
  "AsbMajorQuestion",
  "AsbSubQuestion",
  "AsbBranchQuestion",
]

/** テーブル別の同期オプション */
export const SYNC_TABLE_OPTIONS: Record<string, TableOptions> = {
  DeletedRecord: {
    timestampColumn: "deletedAt",
    deleteProtected: true,
  },
  // 監査ログ。連続操作の集約で既存行を上書きするため、LWWは updatedAt で収束させる。
  // 削除はされない（deleteProtected）。
  AuditLog: {
    timestampColumn: "updatedAt",
    deleteProtected: true,
  },
}
