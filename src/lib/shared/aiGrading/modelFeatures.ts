/**
 * モデル・事業者が受け付ける送り方の判断（docs/vlm-grading-design.md §6-3）。
 *
 * main（Anthropic への依頼に adaptive thinking と effort を入れるか）と renderer
 * （「手間」「バッチ」の選択肢を選べるようにするか）の両方が値で引くので `src/lib/shared/` に置く。
 * どちらも同じ判断を使うので、画面で選べる手間は、そのまま依頼に入る。
 */

import type {
  GradingProviderId,
  ProviderModelInfo,
} from "@/electron-src/lib/aiGrading/providers/types"

/**
 * adaptive thinking と effort を受け付けるモデルの接頭辞（Anthropic）。
 *
 * 一覧は「対応を確かめたもの」だけを並べる許可リストにする。一覧に無いモデルには
 * どちらも送らない（思考が既定で常に有効なモデルは、送らなくても既定の深さで考える）。
 * 逆の「非対応の一覧」にすると、新しい非対応モデルを足し忘れたときに 400 になる。
 * 取得したモデルの一覧が能力を言っていれば、そちらを優先する（`decideAdaptiveThinking`）
 */
const ADAPTIVE_THINKING_MODEL_PREFIXES = [
  "claude-fable-5",
  "claude-mythos-5",
  "claude-opus-5",
  "claude-sonnet-5",
  "claude-opus-4-6",
  "claude-opus-4-7",
  "claude-opus-4-8",
  "claude-sonnet-4-6",
] as const

/** 許可リストで見て、そのモデルに adaptive thinking と effort を送ってよいか */
export function supportsAdaptiveThinking(model: string): boolean {
  return ADAPTIVE_THINKING_MODEL_PREFIXES.some((prefix) =>
    model.startsWith(prefix)
  )
}

/**
 * Anthropic のそのモデルに adaptive thinking と effort を送るか。
 *
 * 取得したモデルの一覧にそのモデルがあり、能力が分かっている（null でない）ならそれに従う。
 * 一覧に無い・能力が分からないときは許可リストで決める
 */
export function decideAdaptiveThinking(
  model: string,
  catalogModels: readonly ProviderModelInfo[]
): boolean {
  const catalogModel = catalogModels.find((modelInfo) => modelInfo.id === model)
  return (
    catalogModel?.supportsAdaptiveThinking ?? supportsAdaptiveThinking(model)
  )
}

/**
 * そのモデルが推論の手間（effort）を受け付けるか。
 * Anthropic は adaptive thinking の判断と同じ。OpenAI は `reasoning.effort` を常に送る
 */
export function acceptsEffort(
  provider: GradingProviderId,
  model: string,
  catalogModels: readonly ProviderModelInfo[]
): boolean {
  switch (provider) {
    case "anthropic":
      return decideAdaptiveThinking(model, catalogModels)
    case "openai":
      return true
  }
}

/**
 * 事業者がバッチで送れるか（各事業者の実装の `capabilities.batch` と同じ値。
 * 食い違わないことは事業者の実装のテストで確かめている）
 */
export const PROVIDER_SUPPORTS_BATCH: Record<GradingProviderId, boolean> = {
  anthropic: true,
  openai: true,
}
