/**
 * NAS同期 API 型定義
 *
 * 型の SSOT は main 側 `electron-src/lib/sync/types.ts`。IPC 契約はそれを import する。
 */

import type {
  SyncAppConfig,
  SyncAppStatus,
} from "@/electron-src/lib/sync/types"

export interface SyncAPI {
  sync: {
    getConfig(): Promise<{
      success: boolean
      config?: SyncAppConfig
      syncPath?: string
      error?: string
    }>
    setConfig(
      config: Partial<SyncAppConfig>
    ): Promise<{ success: boolean; error?: string }>
    triggerNow(): Promise<{ success: boolean; error?: string }>
    getStatus(): Promise<{
      success: boolean
      status?: SyncAppStatus
      error?: string
    }>
    onStatusChanged(callback: (status: SyncAppStatus) => void): () => void
  }
}
