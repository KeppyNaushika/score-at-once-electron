/**
 * AI 採点（実験的機能）の事業者ごとの同意・API キー・既定値 Preload API
 *
 * キーを読み出すメソッドは無い（main にも、キーを返すチャンネルは無い）。
 */

import { bind } from "./invoke"

export function createAiProviderApi() {
  return {
    aiProvider: {
      getStatuses: bind("aiProvider:getStatuses"),

      recordConsent: bind("aiProvider:recordConsent"),

      revokeConsent: bind("aiProvider:revokeConsent"),

      setApiKey: bind("aiProvider:setApiKey"),

      clearApiKey: bind("aiProvider:clearApiKey"),

      getSettings: bind("aiProvider:getSettings"),

      updateSettings: bind("aiProvider:updateSettings"),

      testConnection: bind("aiProvider:testConnection"),

      getModelCatalogs: bind("aiProvider:getModelCatalogs"),

      fetchModels: bind("aiProvider:fetchModels"),

      openTermsLink: bind("aiProvider:openTermsLink"),

      getPricing: bind("aiProvider:getPricing"),

      setModelPrices: bind("aiProvider:setModelPrices"),

      fetchPricingPage: bind("aiProvider:fetchPricingPage"),

      removeModelPrice: bind("aiProvider:removeModelPrice"),

      setBatchPricePercent: bind("aiProvider:setBatchPricePercent"),
    },
  }
}
