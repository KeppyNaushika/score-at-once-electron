/**
 * 「料金」タブの単価の入力欄（文字）と、保存する単価（数）の行き来。
 *
 * 入力と出力は必須。キャッシュの3つの欄は空欄なら 0（書き込みに別の料金の無い事業者がある）。
 */

import type { AiModelPrice } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"

/** 単価の欄（並べる順） */
export const PRICE_FIELD_KEYS = [
  "inputPerMillionUsd",
  "outputPerMillionUsd",
  "cacheReadPerMillionUsd",
  "cacheWrite5mPerMillionUsd",
  "cacheWrite1hPerMillionUsd",
] as const

export type PriceFieldKey = (typeof PRICE_FIELD_KEYS)[number]

/** 入力欄の文字（欄ごと） */
export type ModelPriceFields = Record<PriceFieldKey, string>

/** 欄の見出し */
export const PRICE_FIELD_LABELS: Record<PriceFieldKey, string> = {
  inputPerMillionUsd: "入力",
  outputPerMillionUsd: "出力",
  cacheReadPerMillionUsd: "キャッシュ読み",
  cacheWrite5mPerMillionUsd: "キャッシュ書き（5分）",
  cacheWrite1hPerMillionUsd: "キャッシュ書き（1時間）",
}

/** 空欄を許さない欄 */
const REQUIRED_PRICE_FIELD_KEYS: ReadonlySet<PriceFieldKey> = new Set([
  "inputPerMillionUsd",
  "outputPerMillionUsd",
])

/** 単価を入力欄の文字にする。単価が無ければ全部空欄 */
export function fieldsFromPrice(
  modelPrice: Pick<AiModelPrice, PriceFieldKey> | null
): ModelPriceFields {
  return {
    inputPerMillionUsd: modelPrice ? String(modelPrice.inputPerMillionUsd) : "",
    outputPerMillionUsd: modelPrice
      ? String(modelPrice.outputPerMillionUsd)
      : "",
    cacheReadPerMillionUsd: modelPrice
      ? String(modelPrice.cacheReadPerMillionUsd)
      : "",
    cacheWrite5mPerMillionUsd: modelPrice
      ? String(modelPrice.cacheWrite5mPerMillionUsd)
      : "",
    cacheWrite1hPerMillionUsd: modelPrice
      ? String(modelPrice.cacheWrite1hPerMillionUsd)
      : "",
  }
}

/** 入力欄を確かめた結果 */
export type ModelPriceParseResult =
  | { isValid: true; modelPrice: AiModelPrice }
  | { isValid: false; message: string }

/** 1つの欄を数にする。空欄は必須でなければ 0、正しくなければ null */
function parsePriceField(key: PriceFieldKey, text: string): number | null {
  const trimmedText = text.trim()
  if (trimmedText === "") return REQUIRED_PRICE_FIELD_KEYS.has(key) ? null : 0
  const amount = Number(trimmedText)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

/** 入力欄を確かめて単価にする */
export function parseModelPriceFields(
  provider: GradingProviderId,
  model: string,
  fields: ModelPriceFields
): ModelPriceParseResult {
  const trimmedModel = model.trim()
  if (trimmedModel === "") {
    return { isValid: false, message: "モデルの id が空です" }
  }
  const invalidKeys = PRICE_FIELD_KEYS.filter(
    (key) => parsePriceField(key, fields[key]) === null
  )
  if (invalidKeys.length > 0) {
    return {
      isValid: false,
      message: `${trimmedModel}: ${invalidKeys
        .map((key) => PRICE_FIELD_LABELS[key])
        .join("・")} を 0 以上の数にしてください（入力と出力は必須）`,
    }
  }
  const amountOf = (key: PriceFieldKey) =>
    parsePriceField(key, fields[key]) ?? 0
  return {
    isValid: true,
    modelPrice: {
      provider,
      model: trimmedModel,
      inputPerMillionUsd: amountOf("inputPerMillionUsd"),
      outputPerMillionUsd: amountOf("outputPerMillionUsd"),
      cacheReadPerMillionUsd: amountOf("cacheReadPerMillionUsd"),
      cacheWrite5mPerMillionUsd: amountOf("cacheWrite5mPerMillionUsd"),
      cacheWrite1hPerMillionUsd: amountOf("cacheWrite1hPerMillionUsd"),
    },
  }
}

/** 5つの欄の値がすべて同じか */
export function isSamePriceAmounts(
  priceA: Pick<AiModelPrice, PriceFieldKey>,
  priceB: Pick<AiModelPrice, PriceFieldKey>
): boolean {
  return PRICE_FIELD_KEYS.every((key) => priceA[key] === priceB[key])
}
