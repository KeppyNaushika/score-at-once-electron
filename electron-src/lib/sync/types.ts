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

/** syncステータス（ランタイム状態） */
export interface SyncAppStatus {
  state: "idle" | "syncing" | "error" | "disabled"
  lastSyncTime: string | null
  lastError: string | null
  syncCount: number
}

/** デフォルトsync設定 */
export const DEFAULT_SYNC_CONFIG: SyncAppConfig = {
  enabled: false,
  clientId: "",
  intervalMs: 30000,
  changelogRetentionDays: 7,
}
