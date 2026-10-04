/**
 * 日付列に出す値。
 *
 * `Date` と ISO 文字列の両方を受けるのは、**いまの4画面で型が割れているから**。
 * 試験・資料・成績は Prisma の行がそのまま IPC の structured clone を通るので `Date`
 * （4実体とも `referenceDate` と `updatedAt`）だが、
 * 解答用紙だけは `listAsbDefinitions`（`electron-src/lib/prisma/asbDefinition.ts`）が
 * `toISOString()` して返すので文字列である（`ASBDefinitionListItem.updatedAt`）。
 * 既存の `useListFilter` の `date` accessor も同じ理由で両方を受けている。
 */
export type EntityListDate = Date | string | null

/** 「次のステップ」列に出すもの */
export interface EntityListNextStep {
  label: string
  url: string
}

/**
 * 日付列の絞り込み。`useListFilter` が持っている値と setter をそのまま渡す。
 *
 * 見出しの語は列の見出しと同じものを使うので、ここでは受け取らない
 * （呼び手が2回書くと、列の語と popover の語がずれる）。
 */
export interface EntityListDateFilter {
  /** YYYY-MM-DD、空文字は未指定 */
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}

/**
 * 名前列の popover に入る横断検索。
 *
 * 名前だけでなく説明・タグ名・学級名も見ているので、どの列の値でもない。
 * 名前列に置くのは、行の中でいちばん多く目に入る列だからである。
 */
export interface EntityListSearch {
  term: string
  onChange: (value: string) => void
  /** 「試験名・タグで検索」など、何を見ているかを言う */
  placeholder: string
}

/** 並べ替えに載せるために、行から値だけ抜いた形 */
export interface SortableEntityRow<TRow> {
  id: string
  name: string
  referenceDate: EntityListDate
  updatedAt: EntityListDate
  row: TRow
}

/** 並べ替えに使える列（`EntityListPage` の `SORTABLE_KEYS` と同じ3つ） */
export type EntityListSortKey = "name" | "referenceDate" | "updatedAt"
