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
    /** 未設定なら config は null */
    getConfig(): Promise<{ config: SyncAppConfig | null; syncPath: string }>
    setConfig(config: Partial<SyncAppConfig>): Promise<void>
    triggerNow(): Promise<void>
    getStatus(): Promise<SyncAppStatus>
    onStatusChanged(callback: (status: SyncAppStatus) => void): () => void
  }
}
