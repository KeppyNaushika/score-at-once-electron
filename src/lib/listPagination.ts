/**
 * ページ送りの共通の決めごと。監査ログと一覧4画面が同じ選択肢を出す。
 */

/** 1ページに並べる件数を、表示領域の高さから決める指定 */
export const AUTO_PAGE_SIZE = "auto"

/** 1ページの件数の指定。「自動」は表示領域の高さから決める */
export type PageSizeChoice = typeof AUTO_PAGE_SIZE | number

/** 1ページに並べる件数の選択肢（「自動」は別枠） */
export const LIST_PAGE_SIZES = [10, 20, 50, 100] as const

/** 高さがまだ測れていないときに使う件数 */
export const FALLBACK_PAGE_SIZE = 10
