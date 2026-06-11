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
