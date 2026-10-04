/**
 * AI 採点（実験的機能）の事業者ごとの同意・API キー・既定値の IPC（設計 §9）。
 *
 * **API キーを返すチャンネルは作らない。** 出すのは「キーがあるか」だけで、キーの復号は
 * 接続テストの中（main）だけで行う（`__tests__/aiGrading/aiProviderHandlers.test.ts` が
 * 全チャンネルの戻り値にキーが現れないことを確かめている）。
 *
 * 同意が「今の同意か」（版が一致し、同意した人が今の利用者か）は renderer が判定する。
 * main は記録そのもの（利用者 id・版・日時）を返す。
 */

import { shell } from "electron"

import {
  AI_GRADING_CONSENT_VERSION,
  AI_GRADING_PROVIDER_TERMS,
  findAiGradingTermsLink,
} from "../../src/lib/shared/aiGrading/consentText"
import { electronFetch } from "../lib/aiGrading/electronFetch"
import { testProviderConnection } from "../lib/aiGrading/providerConnectionTest"
import {
  type AiGradingSettings,
  getProviderCredentialStore,
} from "../lib/aiGrading/providerCredentialStore"
import { createGradingProvider } from "../lib/aiGrading/providers/createGradingProvider"
import {
  type GradingProviderId,
  isGradingProviderId,
} from "../lib/aiGrading/providers/types"
import { getCurrentActorUserId } from "../lib/prisma/auditActor"
import { recordAuditLog } from "../lib/prisma/auditLog"
import { type HandlerMap } from "./ipcHandlerUtils"

/** renderer から来た事業者 id を確かめる（型は名乗っていても、値は IPC を渡ってくる） */
function assertProviderId(candidate: unknown): GradingProviderId {
  if (!isGradingProviderId(candidate)) {
    throw new Error(`対応していない事業者です: ${String(candidate)}`)
  }
  return candidate
}

export const aiProviderHandlers = {
  /** 事業者ごとの状態（キーがあるか・暗号化できるか・同意の記録）。キーは含めない */
  "aiProvider:getStatuses": async () =>
    getProviderCredentialStore().getProviderStatuses(),

  /**
   * 同意を記録する。同意したのは今ログインしている利用者で、版は今の同意文の版。
   * どちらも renderer からは受け取らない（他人や古い版の名で同意できないように）
   */
  "aiProvider:recordConsent": async (provider: GradingProviderId) => {
    const providerId = assertProviderId(provider)
    const userId = getCurrentActorUserId()
    if (userId === null) {
      throw new Error(
        "ログインしている利用者が分からないため、同意を記録できません"
      )
    }
    const store = getProviderCredentialStore()
    // 別の利用者が同意し直すときは、前の利用者のキーを引き継がない
    // （キーは利用者が自分で事業者と契約して用意するもの。費用はその契約に掛かる）
    const previousConsent = store.getProviderStatus(providerId).consent
    if (previousConsent !== null && previousConsent.userId !== userId) {
      store.clearApiKey(providerId)
    }
    const consent = store.recordConsent(providerId, {
      userId,
      consentVersion: AI_GRADING_CONSENT_VERSION,
    })
    // 同意文の本文やキーは残さない。版だけを残す
    await recordAuditLog({
      action: "ai_grading.consent",
      userId,
      entityType: "AiProvider",
      entityId: providerId,
      target: AI_GRADING_PROVIDER_TERMS[providerId].providerName,
      extra: { consentVersion: consent.consentVersion },
    })
    return consent
  },

  /** 同意を取り消す。保存した API キーも消える（送信済みのものは戻らない） */
  "aiProvider:revokeConsent": async (provider: GradingProviderId) => {
    const providerId = assertProviderId(provider)
    getProviderCredentialStore().revokeConsent(providerId)
    await recordAuditLog({
      action: "ai_grading.consent_revoked",
      entityType: "AiProvider",
      entityId: providerId,
      target: AI_GRADING_PROVIDER_TERMS[providerId].providerName,
    })
  },

  /** API キーを暗号化して保存する。何も返さない */
  "aiProvider:setApiKey": async (
    provider: GradingProviderId,
    apiKey: string
  ) => {
    getProviderCredentialStore().setApiKey(assertProviderId(provider), apiKey)
  },

  /** 保存した API キーを消す */
  "aiProvider:clearApiKey": async (provider: GradingProviderId) => {
    getProviderCredentialStore().clearApiKey(assertProviderId(provider))
  },

  /** 機密でない既定値（モデル・effort・同時実行数・予算の警告額） */
  "aiProvider:getSettings": async () =>
    getProviderCredentialStore().getSettings(),

  /** 既定値を変える（渡した項目だけ） */
  "aiProvider:updateSettings": async (update: Partial<AiGradingSettings>) =>
    getProviderCredentialStore().updateSettings(update),

  /** 保存したキーで事業者へつながるか試す。結果は種類で返し、キーは返さない */
  "aiProvider:testConnection": async (provider: GradingProviderId) =>
    testProviderConnection(assertProviderId(provider), {
      store: getProviderCredentialStore(),
      createProvider: createGradingProvider,
      fetch: electronFetch,
    }),

  /**
   * 事業者の規約のページを既定のブラウザで開く。
   * URL は renderer から受け取らず、同意文のモジュールにある名前から引く（任意の URL は開かない）
   */
  "aiProvider:openTermsLink": async (
    provider: GradingProviderId,
    linkKey: string
  ) => {
    const link = findAiGradingTermsLink(assertProviderId(provider), linkKey)
    if (link === null) {
      throw new Error(`規約のリンクが見つかりません: ${linkKey}`)
    }
    await shell.openExternal(link.url)
  },
} satisfies HandlerMap
