/**
 * 取り込みの方針（人が取り込みの最初に1回だけ選ぶ）
 *
 * 試験・試験外成績資料・成績のどの取り込みでも同じ3択で、**選んだ操作は取り込む全ての
 * レコードの全ての値に、例外なく同じように効く**（項目ごとの選択も、実体ごとの特別扱いも
 * 作らない）。id と時刻の扱いは選択で1対1に決まる。
 *
 * | 選択      | 既存と一致した行                              | 新しく作る行                        |
 * | --------- | --------------------------------------------- | ----------------------------------- |
 * | overwrite | 無条件に置き換え。updatedAt = 取り込み時刻     | createdAt/updatedAt = 取り込み時刻  |
 * | merge     | LWW（新しい方が勝つ）。updatedAt はその値      | createdAt/updatedAt = アーカイブの値 |
 * | separate  | （id を振り直すので一致が起きない）            | createdAt/updatedAt = アーカイブの値 |
 *
 * 実装は electron-src/lib/import/merge/importValuePolicy.ts に一本化してある。
 */
export type ImportAction = "overwrite" | "merge" | "separate"

/** UIのSelect等が返す string を ImportAction へ絞り込む */
export function isImportAction(value: string): value is ImportAction {
  return value === "overwrite" || value === "merge" || value === "separate"
}
