/**
 * 「ページから読み込む」の下書き。読めた単価を今の単価と比べ、新規・変更・同じに分ける。
 *
 * 下書きは見せるだけで、教員が選んで保存するまで単価は変わらない。最初に選んでおくのは
 * 値の変わったモデルと、この端末で使う（使った・既定の・単価を入れた）モデルの新規だけ
 * （ページの全モデルを黙って足さない）。
 */

import type {
  AiModelPrice,
  AiPricing,
} from "@/electron-src/lib/aiGrading/providerCredentialStore"
import { findModelPrice } from "@/lib/aiUsageCost"

import type { PagePrice } from "./anthropicPricingPage"
import {
  fieldsFromPrice,
  isSamePriceAmounts,
  type ModelPriceFields,
} from "./modelPriceForm"

/** 今の単価と比べた状態 */
export type PricingDraftStatus = "new" | "changed" | "unchanged"

/** 下書きの1行 */
export interface PricingDraftRow {
  pagePrice: PagePrice
  status: PricingDraftStatus
  /** 今入れてある単価（比べる相手）。無ければ null */
  currentPrice: AiModelPrice | null
  /** 下書きの入力欄（読めた値から始まり、教員が直せる） */
  fields: ModelPriceFields
  /** 保存するか */
  isSelected: boolean
}

export const PRICING_DRAFT_STATUS_LABELS: Record<PricingDraftStatus, string> = {
  new: "新規",
  changed: "変更",
  unchanged: "同じ",
}

/** 読めた単価から下書きを作る（Anthropic の分） */
export function buildPricingDraft(
  pagePrices: readonly PagePrice[],
  pricing: AiPricing,
  modelsInUse: ReadonlySet<string>
): PricingDraftRow[] {
  return pagePrices.map((pagePrice) => {
    const currentPrice = findModelPrice(pricing, "anthropic", pagePrice.model)
    const status: PricingDraftStatus =
      currentPrice === null
        ? "new"
        : isSamePriceAmounts(currentPrice, pagePrice)
          ? "unchanged"
          : "changed"
    return {
      pagePrice,
      status,
      currentPrice,
      fields: fieldsFromPrice(pagePrice),
      isSelected:
        status === "changed" ||
        (status === "new" && modelsInUse.has(pagePrice.model)),
    }
  })
}
