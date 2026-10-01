/**
 * sqlite-nas-syncのテーブル同期設定
 *
 * v0.8.0以降、同期対象テーブルはDBから自動検出される（`id` と `updatedAt` を持つ非内部テーブル）。
 * ここではローカル専用テーブルの除外リストと、特殊なテーブルオプションのみを定義する。
 */

import type { TableOptions } from "sqlite-nas-sync"

/**
 * 同期から除外するテーブル一覧。**いま除外する表は1つも無い。**
 *
 * 業務データはすべて同期する（解答用紙定義・試験・試験外成績資料・成績算出・生徒・学級・
 * 小計点・タグ）。設定も同期する。利用者ごとの設定（`UserPreference` /
 * `UserKeyboardShortcut`）は**端末ではなく利用者に付く**ので、同じ人がどの端末で採点しても
 * 同じキー割り当て・同じ表示で始まるのが正しい。
 *
 * 空のまま残すのは、**除外という考え方そのものが要らなくなったわけではない**から。
 * 除外に入るのは「同じ DB を共有していても、端末ごとに違う値であるべき表」——たとえば
 * 窓の位置や大きさ、その端末のプリンタ、その端末のファイル置き場のような、他の端末へ
 * 持っていくと誤った値になるものを**テーブルで**持つようになった場合。現時点でそういう値は
 * DB に無い（窓の状態は main が持ち、DB には入らない）ので、一覧は空になる。
 *
 * **判断は「端末に付くか・利用者に付くか」で行う。** 同期を切ると競合しない、では無い
 * （競合は同期で解くもので、除外で避けるものではない）。
 *
 * かつては Asb\* も端末固有として除外していたが、除外していたのは親（AsbDefinition /
 * AsbHeaderField / AsbMajorQuestion / AsbSubQuestion / AsbBranchQuestion）だけで、
 * 後から増えた子（AsbTextElement / AsbImageElement / AsbOmrConfig / AsbOmrChoiceOption /
 * AsbCharGuide / AsbDefinitionTag）は自動検出で同期されていた。親の作成は伝わらないのに
 * 子の削除は伝わるという歪んだ状態で、端末Aで小問を消すと端末Bでは枠だけ残って中身が消えた。
 * 除外リストは「テーブルを足したら書き足す」運用に依存して2度漏れた（`AsbCharGuide` は
 * #913、`AsbDefinitionTag` はタグ対応）ので、`syncTableConfig.test.ts` で漏れを検知する。
 */
export const SYNC_EXCLUDE_TABLES: string[] = []

/**
 * テーブル別の同期オプション
 *
 * 「この表では他端末の削除を効かせない」という指定（`deleteProtected`）は v0.21.0 で
 * ライブラリから無くなった。**削除はどの表でも普通に伝わる**。消えてほしくない子行が
 * あるときは、設定ではなく外部キーの宣言（`ON DELETE SET NULL` / `SET DEFAULT`）で守る。
 */
export const SYNC_TABLE_OPTIONS: Record<string, TableOptions> = {
  // 監査ログ。連続操作の集約で既存行を上書きするため、LWWは updatedAt で収束させる。
  // v0.20.0 までは deleteProtected にしていたが、そのせいで保持期間を過ぎた行の整理
  // （`pruneAuditLogs`）が同期している間は効かず、端末どうしが互いに戻し合って古い行が
  // 消えなかった。v0.21.0 で指定ごと無くなり、削除はそのまま他端末へ伝わる（＝整理が効く）。
  // AuditLog は外部キーを1本も持たないので、親の削除に巻き込まれて表から外れることもない。
  AuditLog: {
    timestampColumn: "updatedAt",
  },
}
