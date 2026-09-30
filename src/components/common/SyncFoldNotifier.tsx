"use client"

import { useEffect } from "react"
import { toast } from "sonner"

import { BETA_ORIGIN_PREFIX } from "@/components/common/BetaBadge"
import type {
  SyncRecordFold,
  SyncRecordFoldReport,
} from "@/electron-src/lib/sync/types"
import { syncTableLabel } from "@/lib/shared/syncTableLabels"
import { subscribeSyncRecordFoldsChanged } from "@/queries/sync"

/**
 * 同期で、別id・同一ユニークキーでかぶった行の片方が**隠れた**こと、隠れていた行が
 * **表示に戻った**ことを、起きた瞬間に知らせる。
 *
 * ユニーク制約がある以上、かぶった2行は同時に表示できない。利用者は止められないし、
 * 画面の上では黙って行が1つ消えたように見える（戻るときは、消したはずのものが
 * 現れたように見える）。他の分散DBがやらない割り切りなので、**黙ってやらない**のが
 * この窓の役目。
 *
 * **既読は持たない。** 同期はアプリが動いている間しか走らないので、変わった瞬間には
 * 必ず窓が開いていて、取りこぼさない。あとから見返すのは監査ログ（サイドバーの「監査ログ」）で、
 * 見る場所を2つに割らないために専用の履歴画面は作らない。
 *
 * 描くものは無い。窓が開いている間ずっと聞いていられるよう AppShell に置く。
 */
export function SyncFoldNotifier() {
  useEffect(() => subscribeSyncRecordFoldsChanged(showFoldToasts), [])

  return null
}

/**
 * 隠れた行と戻った行を、それぞれ1つのトーストにまとめて出す。
 *
 * main は出来事をそのまま押し出してくるだけなので、テーブルごとの数え上げはここで行う
 * （1回の同期で複数の行が隠れることがあり、行ごとに出すと窓が埋まる）。
 * 自動で消えると見落とすため、閉じるまで残す。
 *
 * **何も消えていないことを必ず書く。** v0.19.0 までは片方を本当に消して1つにまとめて
 * いたが、今は隠すだけで、重なりが解ければ隠した方が自動で戻る。
 * 「まとめました」と書くと、消えたと読まれる。
 *
 * **「表示している方を消せば戻る」とは書かない。** v0.21.0 から、かぶっている行は
 * 利用者から見れば1行として扱われ、表示している方を削除すると隠れている方にも削除が
 * 書かれる（＝戻らない）。戻るのは、名前を変えるなどして重なりが解けたときである。
 */
function showFoldToasts(report: SyncRecordFoldReport): void {
  if (report.folds.length > 0) {
    toast.warning(`${BETA_ORIGIN_PREFIX}重複していたデータの片方を隠しました`, {
      description: `${breakdownByTable(report.folds)}\n他のPCと同じものが二重にできていたため、片方だけを表示しています。隠した方も消してはいないので、名前を変えるなどして重なりが解ければ自動で表示に戻ります。詳しくは監査ログに残しています。`,
      duration: Infinity,
      closeButton: true,
    })
  }

  if (report.restores.length > 0) {
    toast.info(`${BETA_ORIGIN_PREFIX}隠していたデータを表示に戻しました`, {
      description: `${breakdownByTable(report.restores)}\n他のPCと重複していたため隠していたものです。表示していた方が他のPCで直されて重なりが解けたので、ふたたび表示しています。詳しくは監査ログに残しています。`,
      duration: Infinity,
      closeButton: true,
    })
  }
}

/** 「試験の受験生徒 2件、タグ 1件」のように、テーブルごとの件数を並べる */
function breakdownByTable(folds: SyncRecordFold[]): string {
  const countByTable = new Map<string, number>()
  for (const fold of folds) {
    countByTable.set(
      fold.tableName,
      (countByTable.get(fold.tableName) ?? 0) + 1
    )
  }
  return [...countByTable]
    .map(([tableName, count]) => `${syncTableLabel(tableName)} ${count}件`)
    .join("、")
}
