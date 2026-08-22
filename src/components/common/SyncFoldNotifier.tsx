"use client"

import { useEffect } from "react"
import { toast } from "sonner"

import type { SyncRecordFold } from "@/electron-src/lib/sync/types"
import { syncFoldTableLabel } from "@/lib/shared/syncFoldLabels"
import { subscribeSyncRecordFolds } from "@/queries/sync"

/**
 * 同期が別id・同一ユニークキーの行を1つへ「畳んだ」ことを、起きた瞬間に知らせる。
 *
 * 畳みはユニーク制約が強制する操作で、利用者は止められないし、黙って行が1つ消える。
 * 他の分散DBがやらない割り切りなので、**黙ってやらない**のがこの窓の役目。
 *
 * **既読は持たない。** 同期はアプリが動いている間しか走らないので、畳みの瞬間には
 * 必ず窓が開いていて、取りこぼさない。あとから見返すのは監査ログ（設定 › 監査ログ）で、
 * 見る場所を2つに割らないために専用の履歴画面は作らない。
 *
 * 描くものは無い。窓が開いている間ずっと聞いていられるよう AppShell に置く。
 */
export function SyncFoldNotifier() {
  useEffect(() => subscribeSyncRecordFolds(showFoldToast), [])

  return null
}

/**
 * 畳みの一覧を1つのトーストにまとめて出す。
 *
 * main は畳みをそのまま押し出してくるだけなので、テーブルごとの数え上げはここで行う
 * （1件の取り込みが連鎖して複数の行を畳むことがあり、行ごとに出すと窓が埋まる）。
 * 自動で消えると見落とすため、閉じるまで残す。
 *
 * **子が失われたぶんは別のトーストへ分ける。** 畳みは「行が1つ減った」だけだが、
 * こちらは「その先のデータが消えた」で重さが違う。同じ文の中に数字を並べると、
 * ふつうの畳みの内訳に紛れる。
 */
function showFoldToast(folds: SyncRecordFold[]): void {
  if (folds.length === 0) return

  const breakdown = [...countByTable(folds, () => 1)]
    .map(([tableName, count]) => `${syncFoldTableLabel(tableName)} ${count}件`)
    .join("、")
  const movedChildren = folds.reduce(
    (total, fold) => total + fold.movedChildren,
    0
  )
  const movedNote =
    movedChildren > 0
      ? `\nぶら下がっていた ${movedChildren}件 は残した方へ移しました。`
      : ""

  toast.warning("同期で重複していたデータを1つにまとめました", {
    description: `${breakdown}${movedNote}\n他のPCと同じものが二重にできていたため、片方を残してもう片方を取り込みました。詳しくは設定の監査ログに残しています。`,
    duration: Infinity,
    closeButton: true,
  })

  showLostChildrenToast(folds)
}

/**
 * まとめる際に**引き継げず消えた**ぶらさがりを、別のトーストで知らせる。
 *
 * ふつうは起きない（起きるのは、子が親を主キー以外の値で握っていて、その列を一時的に
 * 外せない形のときだけ）。起きたときは行が減っただけでは済まないので、**取り消せない
 * 消失として、畳みそのものとは別に伝える**。
 *
 * **数えているのは子で、名前が付いているのは親。** `lostChildren` は畳まれた行に
 * ぶら下がっていた件数なので、ライブラリから来る表名は親のものである（消えた子の表名は
 * 渡ってこない）。「学級 3件」と並べると学級が3つ消えたように読めるので、
 * 「〜にぶら下がっていた 3件」と書く。
 */
function showLostChildrenToast(folds: SyncRecordFold[]): void {
  const lostByTable = countByTable(
    folds.filter((fold) => fold.lostChildren > 0),
    (fold) => fold.lostChildren
  )
  if (lostByTable.size === 0) return

  const breakdown = [...lostByTable]
    .map(
      ([tableName, count]) =>
        `${syncFoldTableLabel(tableName)}にぶら下がっていた ${count}件`
    )
    .join("、")

  toast.error("まとめる際に、ぶら下がっていたデータを引き継げませんでした", {
    description: `${breakdown}\n消えたデータは元に戻せません。設定の監査ログに、何がどれへまとまったかを残しています。`,
    duration: Infinity,
    closeButton: true,
  })
}

/** テーブル名ごとに数を足し上げる（1件と数えるか、子の件数で数えるかは呼ぶ側が決める） */
function countByTable(
  folds: SyncRecordFold[],
  weightOf: (fold: SyncRecordFold) => number
): Map<string, number> {
  const totals = new Map<string, number>()
  for (const fold of folds) {
    totals.set(
      fold.tableName,
      (totals.get(fold.tableName) ?? 0) + weightOf(fold)
    )
  }
  return totals
}
