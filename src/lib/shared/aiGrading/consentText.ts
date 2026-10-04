/**
 * AI 採点（実験的機能）の同意文と、事業者ごとの規約へのリンク（設計 §9-1）。
 *
 * **この文面は下書き（DRAFT）である。** 公開前にプロジェクトの OWNER が確定させる。
 * 文面を改めたら {@link AI_GRADING_CONSENT_VERSION} を上げること。上げると、同意済みの
 * 利用者も次に使うときに改めて同意を求められる（版の一致で「今の同意か」を判定するため）。
 *
 * main（同意の記録に版を付ける・規約のリンクを開く）と renderer（同意の画面・解放の判定）の
 * 両方が値で引くので `src/lib/shared/` に置く。
 */

import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"

/**
 * 同意文の版。同意の記録（`ai-providers.json`）にこの文字列が残り、一致しなければ同意し直す。
 *
 * TODO(OWNER): 文面を確定したら "-draft" を外した版にする
 */
export const AI_GRADING_CONSENT_VERSION = "2026-10-05-draft"

/** 同意の1項目。利用者は項目ごとに確かめる（読み飛ばせない形にする） */
export interface AiGradingConsentItem {
  /** 画面の key・テストの手がかりに使う安定した名前 */
  key: string
  title: string
  body: string
}

/** 同意の8項目目。取り消しの確認でも同じ文を示すので名前を付けて置く。DRAFT */
export const AI_GRADING_REVOCATION_ITEM: AiGradingConsentItem = {
  key: "revocation",
  title: "同意を取り消しても、送信済みのものは戻りません",
  body: "取り消すと、この端末で機能が隠れ、保存した API キーが消え、以後は送信されなくなります。それだけであり、すでに事業者へ送った内容の扱いは事業者の規約に従います（取り消しによって開発者が何かを負うことはありません）。アプリ内に記録した試行は残ります（消す操作は別にあります）。",
}

/** 同意の8項目（設計 §9-1 の 1〜8 と同じ順・同じ内容）。DRAFT */
export const AI_GRADING_CONSENT_ITEMS: readonly AiGradingConsentItem[] = [
  {
    key: "research-only",
    title: "研究・実験のための機能です",
    body: "学校の実運用での利用は想定していません。実際の生徒の答案で使う場合は、所属する学校・設置者の規程と承認が必要です。必要に応じて保護者への説明も行ってください。",
  },
  {
    key: "what-is-sent",
    title: "送られるもの",
    body: "設問枠の切り出し画像（氏名欄は含みません）、問題文・模範解答・採点基準、指示文が送られます。ただし、答案の本文に生徒が氏名などを書いている場合は、それも画像に写ります。",
  },
  {
    key: "where-it-goes",
    title: "送り先と、送った内容の扱い",
    body: "利用者が選んだ事業者へ送られます。送った内容の保持期間・学習への利用・所在国は事業者ごとの規約に従います。事業者との契約は利用者と事業者の間のもので、このアプリ（開発者）は関知しません。下のリンクは参考情報として載せています。",
  },
  {
    key: "what-is-not-sent",
    title: "送られないもの",
    body: "生徒の氏名・学籍番号・学級などの名簿情報は送りません。答案との対応付けはこの端末の中だけで行い、送信に使う識別子は意味を持たない uuid です。",
  },
  {
    key: "api-key-and-cost",
    title: "API キーと費用",
    body: "API キーは利用者が自分で事業者と契約して用意します。費用は利用者の契約で発生し、このアプリは負担も保証もしません。",
  },
  {
    key: "ai-is-a-candidate",
    title: "AI の判定は候補にすぎません",
    body: "採点の責任は教員にあります。AI の判定は、教員が確かめて採用しない限り採点に入りません。",
  },
  {
    key: "user-responsibility",
    title: "利用の責任は利用者にあります",
    body: "このソフトウェアは AGPLv3 で提供され、無保証です（同ライセンス第15条・第16条）。開発者はこの機能を通じて何のデータも受け取らず、送信は利用者と事業者の間で直接行われます。どの答案を送るか、送ってよいかの判断と、その結果の責任は利用者にあります。",
  },
  AI_GRADING_REVOCATION_ITEM,
]

/** 事業者の規約へのリンク */
export interface AiGradingTermsLink {
  /** 開く操作の指定に使う名前（main はこの名前から URL を引き、任意の URL は開かない） */
  key: string
  label: string
  url: string
}

/** 事業者ごとの表示名と規約 */
export interface AiGradingProviderTerms {
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
