/**
 * AI 採点（実験的機能）の同意文と、事業者ごとの規約へのリンク（設計 §10-1）。
 *
 * 文面を改めたら {@link AI_GRADING_CONSENT_VERSION} を上げること。上げると、同意済みの
 * 利用者も次に使うときに改めて同意を求められる（版の一致で「今の同意か」を判定するため）。
 * 文面は、送信する内容・判定が採点に入る経路・記録の扱いを、実装と食い違わないように保つ。
 *
 * main（同意の記録に版を付ける・規約のリンクを開く）と renderer（同意の画面・解放の判定）の
 * 両方が値で引くので `src/lib/shared/` に置く。
 */

import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"

/** 同意文の版。同意の記録（`ai-providers.json`）にこの文字列が残り、一致しなければ同意し直す */
export const AI_GRADING_CONSENT_VERSION = "2026-10-12"

/** 同意の1項目。利用者は項目ごとに確かめる（読み飛ばせない形にする） */
interface AiGradingConsentItem {
  /** 画面の key・テストの手がかりに使う安定した名前 */
  key: string
  title: string
  body: string
}

/** 同意の8項目目。「無効にする」の確認でも見出しを示すので名前を付けて置く */
export const AI_GRADING_REVOCATION_ITEM: AiGradingConsentItem = {
  key: "revocation",
  title: "本機能を無効にしても、送信済みのデータは取り消されません",
  body: "本機能を無効にした場合、この端末では本機能が表示されなくなり、保存されている API キーは削除され、以後、事業者への送信は行われません。ただし、既に事業者へ送信したデータの取扱いは、当該事業者の規約に従うものとし、無効化によって取り消されることはありません。また、開発者は、無効化に関して何らの責任も負いません。本アプリ内に記録された AI の判定結果、利用量および費用の記録は、無効化後も残ります。これらの記録は、当該試験を削除したときに併せて削除されます。",
}

/** 同意の8項目（設計 §10-1 と同じ順・同じ内容。CLI 経由の項目は、その送り方を実装するときに足す） */
export const AI_GRADING_CONSENT_ITEMS: readonly AiGradingConsentItem[] = [
  {
    key: "research-only",
    title: "本機能は研究・実験を目的とするものです",
    body: "本機能は、学校における実運用での利用を想定していません。実際の生徒の答案に本機能を用いる場合は、利用者の責任において、所属する学校およびその設置者の規程を確認し、必要な承認を得てください。また、必要に応じて保護者への説明を行ってください。",
  },
  {
    key: "what-is-sent",
    title: "送信される情報",
    body: "本機能は、次の情報を事業者へ送信します。(1) 答案の設問欄を切り出した画像（氏名欄は含みません）、(2) 採点指示として入力された問題文、問題の画像、模範解答（模範解答の画像を送る設定とした場合は、その画像を含みます）、採点基準および助言の文案の指示、(3) 登録された採点項目の一覧、(4) AI の判定結果を確認した教員が入力した再採点の指示、(5) 答案を項目ごとに分類する際の、1段目の AI による答案の読み取り結果、所見および判定。なお、答案の本文に生徒が氏名その他の個人を特定できる情報を記載している場合、当該情報も画像に含まれて送信されます。教員が付けた点数は送信しません。",
  },
  {
    key: "where-it-goes",
    title: "送信先および送信した情報の取扱い",
    body: "送信先は、利用者が選択した事業者です。送信した情報の保持期間、学習への利用の有無および保存される国・地域は、当該事業者の規約および利用者と当該事業者との契約に従います。当該契約は利用者と事業者との間で締結されるものであり、本アプリの開発者は当事者ではありません。下記の規約へのリンクは参考として掲載するものであり、その内容の正確性や最新性を保証するものではありません。",
  },
  {
    key: "what-is-not-sent",
    title: "送信されない情報",
    body: "生徒の氏名、学籍番号、学級その他の名簿情報は送信しません。答案と生徒との対応付けはこの端末内でのみ行い、送信時に用いる識別子は、生徒を特定する意味を持たない無作為の値（uuid）または送信ごとの仮の番号です。",
  },
  {
    key: "api-key-and-cost",
    title: "API キーおよび利用料金",
    body: "API キーは、利用者が自ら事業者と契約して取得するものとします。本機能の利用により生じる料金は、利用者と事業者との契約に基づき利用者に発生します。本アプリに表示される費用の見積もりは目安であり、実際の請求額を保証するものではありません。本アプリの開発者は、当該料金を負担せず、その額についても保証しません。",
  },
  {
    key: "ai-is-a-candidate",
    title: "AI の判定は参考情報です",
    body: "採点の責任は教員にあります。AI の判定は、教員が問いかけの画面で内容を確認し、確定の操作を行った場合に限り、当該教員の採点として記録されます。教員が確定しない限り、AI の判定が採点結果に反映されることはありません。",
  },
  {
    key: "user-responsibility",
    title: "本機能の利用に関する責任",
    body: "本ソフトウェアは GNU Affero General Public License 第3版（AGPLv3）に基づき提供され、法令で認められる範囲において一切の保証はありません（同ライセンス第15条および第16条）。本アプリの開発者は、本機能を通じていかなるデータも受け取らず、送信は利用者と事業者との間で直接行われます。いずれの答案を送信するか、送信してよいかの判断およびその結果についての責任は、利用者が負うものとします。",
  },
  AI_GRADING_REVOCATION_ITEM,
]

/** 事業者の規約へのリンク */
interface AiGradingTermsLink {
  /** 開く操作の指定に使う名前（main はこの名前から URL を引き、任意の URL は開かない） */
  key: string
  label: string
  url: string
}

/** 事業者ごとの表示名と規約 */
interface AiGradingProviderTerms {
  providerName: string
  links: readonly AiGradingTermsLink[]
}

/**
 * 事業者ごとの表示名と規約へのリンク。
 *
 * TODO(OWNER): 公開前に各 URL が今も正しいページを指しているか確かめる
 * （事業者は規約ページの置き場所を変えることがある）
 */
export const AI_GRADING_PROVIDER_TERMS: Record<
  GradingProviderId,
  AiGradingProviderTerms
> = {
  anthropic: {
    providerName: "Anthropic",
    links: [
      {
        key: "commercial-terms",
        label: "Anthropic 商用利用規約（Commercial Terms of Service）",
        url: "https://www.anthropic.com/legal/commercial-terms",
      },
      {
        key: "privacy",
        label: "Anthropic プライバシーポリシー",
        url: "https://www.anthropic.com/legal/privacy",
      },
    ],
  },
  openai: {
    providerName: "OpenAI",
    links: [
      {
        key: "business-terms",
        label: "OpenAI ビジネス利用規約（Business Terms）",
        url: "https://openai.com/policies/business-terms/",
      },
      {
        // TODO(OWNER): API のデータ利用方針の専用ページの URL を確かめる（いまは規約の一覧ページ）
        key: "api-data-usage",
        label: "OpenAI 規約とポリシー（API のデータ利用を含む）",
        url: "https://openai.com/policies/",
      },
    ],
  },
}

/** 規約のリンクを名前で引く。無ければ null */
export function findAiGradingTermsLink(
  provider: GradingProviderId,
  linkKey: string
): AiGradingTermsLink | null {
  return (
    AI_GRADING_PROVIDER_TERMS[provider].links.find(
      (link) => link.key === linkKey
    ) ?? null
  )
}
