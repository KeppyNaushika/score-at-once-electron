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
 */
function showFoldToast(folds: SyncRecordFold[]): void {
  if (folds.length === 0) return

  const countByTable = new Map<string, number>()
  for (const fold of folds) {
    countByTable.set(
      fold.tableName,
      (countByTable.get(fold.tableName) ?? 0) + 1
    )
  }
  const breakdown = [...countByTable]
    .map(([tableName, count]) => `${syncFoldTableLabel(tableName)} ${count}件`)
    .join("、")

  toast.warning("同期で重複していたデータを1つにまとめました", {
    description: `${breakdown}\n他のPCと同じものが二重にできていたため、片方を残してもう片方を取り込みました。詳しくは設定の監査ログに残しています。`,
    duration: Infinity,
    closeButton: true,
  })
}
