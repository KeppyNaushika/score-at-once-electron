/**
 * 取り込みウィザードの文言。main は理由の種類・鍵の識別子・生の行を返すので、
 * 人に見せる言葉と行の呼び名はここで作る。
 */

import type { UnifiedArchiveOpenErrorKind } from "@/electron-src/lib/import/unified-archive/archiveOpener"
import type { UnifiedArchiveUnresolvableKind } from "@/electron-src/lib/import/unified-archive/archiveRowImporter"
import { rowText } from "@/lib/matchRowText"

/** 開けなかった理由（`unifiedArchive:open` の rejected） */
export const ARCHIVE_REJECTION_MESSAGES: Record<
  UnifiedArchiveOpenErrorKind,
  string
> = {
  notArchive:
    "統合アーカイブ（.sao）のファイルではありません。別の種類のファイルか、ファイルが壊れています。",
  tooLarge:
    "アーカイブが大きすぎるか、中身の大きさが不自然なため、開きませんでした。書き出し直したファイルで試してください。",
  insufficientSpace:
    "アーカイブを展開するための空き容量が足りません。空き容量を増やしてから開き直してください。",
  invalidManifest:
    "アーカイブの説明書き（manifest.json）の形が正しくありません。ファイルが壊れている可能性があります。",
  unsupportedFormat:
    "このバージョンのアプリでは読めない形式です。アプリを更新してから開いてください。",
  newerSchema:
    "新しいバージョンのアプリで書き出されています。アプリを更新してから開いてください。",
  corrupt:
    "アーカイブのデータベースが壊れています。書き出し直したファイルで試してください。",
  unsafeSchema:
    "アーカイブのデータベースに想定外の仕掛け（トリガー・ビュー・仮想テーブル・生成列）があるため、開きませんでした。",
  schemaMismatch:
    "アーカイブのデータベースを、このアプリのデータの形に揃えられませんでした。",
  unsafeValues:
    "アーカイブの中に、このアプリが書き出さない形の id かファイルの場所があるため、開きませんでした。書き出し直したファイルで試してください。",
  mistypedValues:
    "アーカイブの中に、列の型に合わない値（文字列の欄の数値など）があるため、開きませんでした。書き出し直したファイルで試してください。",
}

/** 解けない衝突の種類（`unresolvable` の reasons） */
export const ARCHIVE_UNRESOLVABLE_MESSAGES: Record<
  UnifiedArchiveUnresolvableKind,
  string
> = {
  multipleExisting: "取り込む1件が、このPCの複数の行と同じ値になります。",
  sharedExisting:
    "取り込む複数の行が、このPCの同じ1行に寄せられます（紐づけの選び方を見直してください）。",
  replacementCollides: "置き換えると、このPCの別の行と同じ値になります。",
  duplicateInArchive:
    "紐づけの結果、アーカイブの中の複数の行が同じ値になります（紐づけの選び方を見直してください）。",
  matchTargetMissing: "紐づけ先に選んだ行が、このPCにありません。",
  renameInSeparate:
    "「別で追加する」では、このPCの行をアーカイブの id に付け替えられません。",
}

/** 照合で当たった鍵の説明（`matchedBy`） */
export function matchedByLabel(
  table: string,
  matchedBy: string | null
): string {
  switch (matchedBy) {
    case "studentNumber":
      return "学籍番号が一致"
    case "name":
      return table === "Student" ? "姓名が一致" : "名前が一致"
    case "username":
      return "ユーザー名が一致"
    case null:
      return "このPCに同じものなし"
    default:
      return matchedBy
  }
}

/**
 * 一意キーの1列の値を見せる形にする。`…Id` の列は id そのものなので先頭だけ見せる
 * （同じ値かどうかが分かれば足りる）
 */
export function uniqueKeyValueText(
  row: Readonly<Record<string, unknown>>,
  column: string
): string {
  const text = rowText(row, column)
  if (text === "") return "（空）"
  return column.endsWith("Id") && text.length > 8
    ? `${text.slice(0, 8)}…`
    : text
}

/** manifest の時刻（ISO 8601）を見せる形にする */
export function formatArchiveDateTime(isoDateTime: string): string {
  const parsed = new Date(isoDateTime)
  return Number.isNaN(parsed.getTime())
    ? isoDateTime
    : parsed.toLocaleString("ja-JP")
}
