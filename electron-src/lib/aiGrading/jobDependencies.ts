/**
 * AI 採点のジョブ（採点・バッチの回収）が外から受け取るもの。
 *
 * Electron（`net.fetch`・`BrowserWindow`・`safeStorage`）に触れるものはすべてここを通して
 * 渡す。アプリでは `aiGradingMainServices.ts` が本物をつなぎ、テストは偽の事業者と
 * 一時ディレクトリをつなぐ。
 */

import type { AiGradingRunProgress } from "@/types/aiGrading.types"

import type { ResolveDataPath } from "./gradingRequestFactory"
import type { GradingProvider, GradingProviderId } from "./providers/types"

export interface AiGradingJobDependencies {
  /**
   * 事業者の実装を返す。同意していない・キーが無いときは投げる
   * （呼び出し側は送信を始める前にこれを呼び、失敗なら何も作らない）
   */
  resolveProvider: (providerId: GradingProviderId) => GradingProvider
  /** データディレクトリからの相対パスを絶対パスにする */
  resolveDataPath: ResolveDataPath
  /** この端末の同期の clientId（バッチを回収する端末の目印） */
  getClientId: () => string
  /** その場の採点で同時に投げる数 */
  getConcurrency: () => number
  /** 進み具合を画面へ押し出す */
  notifyProgress: (progress: AiGradingRunProgress) => void
}
