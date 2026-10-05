import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { createAnthropicProvider } from "./anthropicProvider"
import { createOpenAiProvider } from "./openaiProvider"
import { GradingProviderError } from "./providerShared"
import type {
  GradingProvider,
  GradingProviderId,
  ProviderFetch,
  ProviderModelInfo,
} from "./types"

interface CreateGradingProviderOptions {
  provider: GradingProviderId
  /** 復号した API キー。main の中だけで扱い、IPC へ出さない */
  apiKey: string
  /** 接続先を変えるとき（OpenAI 互換の接続先など）。省略すると事業者の既定 */
  baseUrl?: string
  /** 学校のプロキシに従わせるための fetch（main では Electron の net.fetch を包んで渡す） */
  fetch?: ProviderFetch
  /**
   * 取得しておいたその事業者のモデルの一覧。Anthropic では adaptive thinking を送るかの
   * 判断に使う（無ければ許可リストで決める）
   */
  catalogModels?: readonly ProviderModelInfo[]
}

/**
 * 事業者の実装を作る。
 *
 * SDK の再試行（429・5xx を既定で2回）はそのまま使う。
 *
 * @throws {GradingProviderError} API キーが空のとき（kind: authentication）
 */
export function createGradingProvider(
  options: CreateGradingProviderOptions
): GradingProvider {
  const apiKey = options.apiKey.trim()
  if (apiKey === "") {
    throw new GradingProviderError("authentication", "API キーがありません")
  }
  switch (options.provider) {
    case "anthropic":
      return createAnthropicProvider(
        new Anthropic({
          apiKey,
          baseURL: options.baseUrl,
          fetch: options.fetch,
        }),
        { catalogModels: options.catalogModels }
      )
    case "openai":
      return createOpenAiProvider(
        new OpenAI({
          apiKey,
          baseURL: options.baseUrl,
          fetch: options.fetch,
        })
      )
  }
}
