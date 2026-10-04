import type { ReactNode } from "react"

/**
 * その場で書き換える3つ。
 *
 * 日付は `<input type="date">` が扱う **yyyy-mm-dd**（未設定は空文字）で持つ。
 * DB の列は4実体とも `referenceDate` に揃っているが、境界を越えてくる姿は
 * `Date`（試験・成績・資料）と ISO 文字列（解答用紙）で割れているので、
 * 入力欄の形へ寄せる側で1つにする（`EntityOverviewPage.tsx` の `toDateInputValue`）。
 */
export interface EntityOverviewBasics {
  name: string
  /** yyyy-mm-dd。未設定は空文字 */
  referenceDate: string
  /** 未設定は空文字 */
  description: string
}

/**
 * 要約の帯の1項目に付ける色。
 *
 * **どの語に何色かは呼ぶ側が決める。** 色は「模範解答は青、答案は橙」という
 * 実体ごとの割り当てで、共通部品には決めようがない（以前の `QuickStats` は
 * 試験の5項目を名前で決め打ちしていた）。省略すれば灰。
 */
export type EntityOverviewStatTone =
  "blue" | "green" | "purple" | "indigo" | "orange" | "teal" | "rose"

/** 要約の帯に並べる1項目 */
export interface EntityOverviewStat {
  /** 見出しの語。帯の中で一意なので React の key も兼ねる */
  label: string
  value: ReactNode
  /** 数が入っているときの色。省略すると灰 */
  tone?: EntityOverviewStatTone
}
