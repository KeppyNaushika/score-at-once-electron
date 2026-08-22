/**
 * NAS同期機能の型定義
 */

/** sync設定（sync-config.jsonに永続化） */
export interface SyncAppConfig {
  enabled: boolean
  clientId: string
  intervalMs: number
  changelogRetentionDays: number
}

/** スキーマバージョン不一致でスキップされたリモートクライアント */
export interface VersionMismatchRemote {
  clientId: string
  remoteVersion: string | null
  /**
   * リモートの方が新しいかどうか（= このPCのアプリ更新が必要）。
   * マイグレーション名はタイムスタンプ接頭辞のため辞書順比較で判定できる。
   */
  remoteIsNewer: boolean
}

/**
 * 別id・同一ユニークキーの行を1つへ畳んだ記録。
 *
 * ライブラリの `RecordFold`（sqlite-nas-sync）と同じ形をアプリ側で名指ししたもの。
 * renderer は electron-src から型しか引けず、ライブラリ本体（better-sqlite3 を抱える）を
 * renderer の型空間へ持ち込みたくないのでここに置く。**中身は加工しない**ので、
 * `RecordFold[]` をそのまま代入でき、形がずれれば tsc が止める。
 */
export interface SyncRecordFold {
  /** 畳みが起きたテーブル名（Prisma のモデル名） */
  tableName: string
  /** 吸収されて消えた側のid */
  losingId: string
  /** 残った側のid */
  winningId: string
  /**
   * この端末で実際に行が消えたかどうか。
   * `false` は「敗者行をそもそもこの端末が持っていなかった」場合（届いた行が負けたとき）。
   */
  removedLocalRow: boolean
  /**
   * 消えた行から残った行へ**付け替えた直接の子の数**（孫は入らない）。
   * 「2つを1つにまとめました」だけでは影響範囲が伝わらないので、数を添える。
   */
  movedChildren: number
  /**
   * 残った行へ**引き継げずに失われた**直接の子の数。**ふつうは 0。**
   *
   * 0 でなくなるのは、子が親を主キー以外のユニーク列の**値**で握っていて、かつ
   * その参照列を一時的に外せない（`NOT NULL`・子自身の主キーを兼ねる等）ときに限る。
   * 消える行の `ON DELETE CASCADE` などが子に及ぶ（`defer_foreign_keys` が遅らせるのは
   * 制約の**検査**であって、カスケードの**動作**ではない）。
   *
   * **0 でなければ必ず利用者へ知らせる。** 畳みは行が1つ減るだけだが、これはその先の
   * データが消えたという話で、重さが違う。
   */
  lostChildren: number
}

/** syncステータス（ランタイム状態） */
export interface SyncAppStatus {
  state: "idle" | "syncing" | "error" | "disabled"
  lastSyncTime: string | null
  lastError: string | null
  syncCount: number
  /** 直近のsyncでスキーマバージョン不一致によりスキップされたリモート */
  versionMismatches: VersionMismatchRemote[]
}

/** デフォルトsync設定 */
export const DEFAULT_SYNC_CONFIG: SyncAppConfig = {
  enabled: false,
  clientId: "",
  intervalMs: 30000,
  changelogRetentionDays: 7,
}
