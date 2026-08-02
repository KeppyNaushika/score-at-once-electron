/**
 * sqlite-nas-syncのテーブル同期設定
 *
 * v0.8.0以降、同期対象テーブルはDBから自動検出される（`id` と `updatedAt` を持つ非内部テーブル）。
 * ここではローカル専用テーブルの除外リストと、特殊なテーブルオプションのみを定義する。
 */

import type { TableOptions } from "sqlite-nas-sync"

/**
 * 同期から除外するテーブル一覧
 *
 * **業務データはすべて同期する。** 解答用紙定義・試験・試験外成績資料・成績算出・生徒・学級・
 * 小計点・タグはいずれも共有される。除外するのは端末ごとの設定だけで、それ以外を足すときは
 * 「この端末でしか意味を持たないか」を基準に判断すること。
 *
 * かつては Asb\* も端末固有として除外していたが、除外していたのは親（AsbDefinition /
 * AsbHeaderField / AsbMajorQuestion / AsbSubQuestion / AsbBranchQuestion）だけで、
 * 後から増えた子（AsbTextElement / AsbImageElement / AsbOmrConfig / AsbOmrChoiceOption /
 * AsbCharGuide / AsbDefinitionTag）は自動検出で同期されていた。親の作成は伝わらないのに
 * 子の削除は伝わるという歪んだ状態で、端末Aで小問を消すと端末Bでは枠だけ残って中身が消えた。
 * 除外リストは「テーブルを足したら書き足す」運用に依存していて2度漏れている（`AsbCharGuide` は
 * #913、`AsbDefinitionTag` はタグ対応）ため、`syncTableConfig.test.ts` で漏れを検知する。
 */
export const SYNC_EXCLUDE_TABLES: string[] = [
  "UserKeyboardShortcut",
  "UserPreference",
]

/** テーブル別の同期オプション */
export const SYNC_TABLE_OPTIONS: Record<string, TableOptions> = {
  // 監査ログ。連続操作の集約で既存行を上書きするため、LWWは updatedAt で収束させる。
  // 削除はされない（deleteProtected）。
  AuditLog: {
    timestampColumn: "updatedAt",
    deleteProtected: true,
  },
}
