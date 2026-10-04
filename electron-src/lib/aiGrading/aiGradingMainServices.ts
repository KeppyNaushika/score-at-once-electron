/**
 * AI 採点のジョブへ、Electron の本物をつなぐ（アプリの main だけが使う）。
 *
 * - 事業者への通信は Electron の `net.fetch` を通す（学校のプロキシ・OS の設定に従わせる）
 * - API キーは保存の口（`providerCredentialStore.ts`）から main の中でだけ復号する
 * - 進み具合は全ウィンドウへ `aiGrading:run-progress` で押し出す（OMR と同じ形）
 * - バッチを回収する端末の目印は、同期の clientId
 *
 * ジョブ本体（`gradingJobRunner.ts` 等）は Electron に触れないので、テストは偽の事業者を
 * つないで走らせる。
 */

import { BrowserWindow, net } from "electron"

import type { AiGradingRunProgress } from "@/types/aiGrading.types"

import { getAbsolutePathFromSharedFiles } from "../dataManager"
import { loadSyncConfig } from "../sync/syncConfig"
import { createBatchCollector, startBatchPolling } from "./batchPoller"
import { createGradingJobRunner } from "./gradingJobRunner"
import type { AiGradingJobDependencies } from "./jobDependencies"
import { getProviderCredentialStore } from "./providerCredentialStore"
import { createGradingProvider } from "./providers/createGradingProvider"
import type { GradingProviderId, ProviderFetch } from "./providers/types"

/** 進み具合を押し出すチャンネル */
export const AI_GRADING_RUN_PROGRESS_CHANNEL = "aiGrading:run-progress"

/** 事業者の SDK へ渡す fetch（`net.fetch` は URL オブジェクトを受けないので文字列にする） */
const electronNetFetch: ProviderFetch = (input, init) =>
  net.fetch(input instanceof URL ? input.href : input, init)

/**
 * 事業者の実装を作る。同意していない・キーが無いときは投げる。
 * **復号したキーはここから外へ出さない**（事業者のクライアントの中にだけ渡る）
 */
function resolveProvider(providerId: GradingProviderId) {
  const apiKey =
    getProviderCredentialStore().readApiKeyForMainProcessOnly(providerId)
  if (apiKey === null) {
    throw new Error(
      "この事業者には同意していないか、API キーが設定されていません（設定の「実験的機能：AI採点」）"
    )
  }
  return createGradingProvider({
    provider: providerId,
    apiKey,
    fetch: electronNetFetch,
  })
}

function notifyProgress(progress: AiGradingRunProgress): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send(AI_GRADING_RUN_PROGRESS_CHANNEL, progress)
  })
}

/**
 * バッチを回収する端末の目印として、このPCの同期の clientId を読む。
 *
 * clientId は起動時に `prepareStorageAtStartup` がこのPCのものに確定させて保存する
 * （別のPCから data を写したときの振り直しもそこで済む）。ここでは読むだけにし、
 * AI 採点の側から同期の設定を書き換えない。
 */
function readClientIdOfThisPc(): string {
  const { clientId } = loadSyncConfig()
  if (clientId === "") {
    throw new Error("この端末の clientId がまだ決まっていません")
  }
  return clientId
}

const dependencies: AiGradingJobDependencies = {
  resolveProvider,
  resolveDataPath: getAbsolutePathFromSharedFiles,
  getClientId: readClientIdOfThisPc,
  getConcurrency: () => getProviderCredentialStore().getSettings().concurrency,
  notifyProgress,
}

let services: {
  jobRunner: ReturnType<typeof createGradingJobRunner>
  batchCollector: ReturnType<typeof createBatchCollector>
} | null = null

/** アプリで1つだけ使うジョブの口（走っている run の中止の口を持つので1つに限る） */
export function getAiGradingServices() {
  if (!services) {
    services = {
      jobRunner: createGradingJobRunner(dependencies),
      batchCollector: createBatchCollector(dependencies),
    }
  }
  return { ...services, dependencies }
}

/**
 * 起動時と一定間隔で、この端末が預けたバッチを回収する。
 * 同意してキーを設定した事業者が1つも無い端末では何もしない
 */
export function startAiGradingBatchPolling(): () => void {
  return startBatchPolling(getAiGradingServices().batchCollector, () => {
    try {
      return getProviderCredentialStore()
        .getProviderStatuses()
        .some(
          (providerStatus) =>
            providerStatus.hasApiKey && providerStatus.consent !== null
        )
    } catch {
      return false
    }
  })
}
