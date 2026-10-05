/**
 * 操作履歴の絞り込みの状態と、その文字列（URL のクエリ）との往復。
 *
 * 画面の中では状態を「構造」（確定した欄の並び＋全文検索）で持ち、文字列にするのは
 * **URL の境界とリンクを組み立てるときだけ**（docs/audit-log-redesign.md「フィルタ UI」）。
 * 試験・成績算出・資料・解答用紙の詳細ページが「この作業領域の操作履歴」へ飛ぶリンクを
 * 組み立て、一覧のページがそれを読んで最初の状態にする。
 *
 * 形は `?scope=<id>:<名前>&student=<id>:<名前>&q=<全文検索>`。キーは欄の key、値は
 * 「id（や種別・日付）」と「chip に出す文言」を最初の `:` で区切ったもの。id・種別・日付は
 * `:` を含まないので、文言の側に `:` があっても読み違えない。
 *
 * 詳細ページ（`src/components/`）からも引くので、一覧の画面の下ではなくここに置く。
 */

/** 絞り込みの欄の種類。欄の定義（候補の出し方など）は一覧の画面の `filterFields.ts` */
export const AUDIT_FILTER_FIELD_KEYS = [
  "scope",
  "student",
  "cropRegion",
  "user",
  "verb",
  "category",
  "since",
  "until",
] as const
export type AuditFilterFieldKey = (typeof AUDIT_FILTER_FIELD_KEYS)[number]

/** 確定した絞り込み1つ（画面では chip になる） */
export interface AuditFilterToken {
  field: AuditFilterFieldKey
  /** 条件に使う値（id・種別・日付） */
  value: string
  /** chip に出す文言 */
  label: string
}

/** 絞り込みの画面の状態 */
export interface AuditFilterState {
  tokens: AuditFilterToken[]
  /** 内容（要約）の全文検索 */
  search?: string
}

/** 全文検索を載せるクエリのキー（欄の key と重ならない名前） */
const SEARCH_PARAM = "q"

/** 操作履歴の一覧のパス */
export const AUDIT_LOGS_PATH = "/audit-logs"

const isAuditFilterFieldKey = (key: string): key is AuditFilterFieldKey =>
  AUDIT_FILTER_FIELD_KEYS.some((fieldKey) => fieldKey === key)

/** `YYYY-MM-DD` の実在する日付か */
export const isDateText = (text: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(text) &&
  !Number.isNaN(new Date(`${text}T00:00:00`).getTime())

/** その欄の値として読めるか（日付の欄は日付でないと、条件にするとき壊れる） */
const isUsableValue = (field: AuditFilterFieldKey, value: string): boolean => {
  if (value === "") return false
  if (field === "since" || field === "until") return isDateText(value)
  return true
}

/** 状態を URL のクエリ（先頭の `?` は付けない）にする */
export function buildAuditFilterQuery(state: AuditFilterState): string {
  const params = new URLSearchParams()
  for (const token of state.tokens) {
    params.append(token.field, `${token.value}:${token.label}`)
  }
  if (state.search) params.set(SEARCH_PARAM, state.search)
  return params.toString()
}

/**
 * URL のクエリを状態にする。知らないキー・読めない値は捨てる
 * （手で打たれた URL や、欄を減らした後の古いリンクでも画面が壊れないように）。
 */
export function parseAuditFilterQuery(query: string): AuditFilterState {
  const params = new URLSearchParams(query)
  const tokens = [...params].flatMap(([key, text]): AuditFilterToken[] => {
    if (!isAuditFilterFieldKey(key)) return []
    const separatorIndex = text.indexOf(":")
    const value = separatorIndex < 0 ? text : text.slice(0, separatorIndex)
    const label = separatorIndex < 0 ? text : text.slice(separatorIndex + 1)
    return isUsableValue(key, value) ? [{ field: key, value, label }] : []
  })
  const search = params.get(SEARCH_PARAM)
  return search ? { tokens, search } : { tokens }
}

/**
 * 1つの作業領域（試験・成績算出・資料・解答用紙定義・学級）で絞り込んだ操作履歴への
 * リンク。名前は chip に出す文言で、無ければ「（名前なし）」
 */
export function auditLogsHrefOfScope(
  scopeId: string,
  scopeLabel: string | null
): string {
  const query = buildAuditFilterQuery({
    tokens: [
      { field: "scope", value: scopeId, label: scopeLabel ?? "（名前なし）" },
    ],
  })
  return `${AUDIT_LOGS_PATH}?${query}`
}
