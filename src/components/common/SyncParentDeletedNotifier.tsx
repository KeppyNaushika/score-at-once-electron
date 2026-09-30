"use client"

import { useEffect } from "react"
import { toast } from "sonner"

import { BETA_ORIGIN_PREFIX } from "@/components/common/BetaBadge"
import type {
  SyncParentDeleted,
  SyncParentDeletedReport,
} from "@/electron-src/lib/sync/types"
import { syncTableLabel } from "@/lib/shared/syncTableLabels"
import { subscribeSyncParentDeletedChanged } from "@/queries/sync"

/**
 * 同期で、**他のPCで消されたものにぶら下がっていたデータが表示から外れた**こと、
 * それが**表示に戻った**ことを、起きた瞬間に知らせる。
 *
 * 他のPCで試験なり生徒なりを消したのと同じころに、こちらでその中身を足していると起きる。
 * 足した側から見れば、書いたはずのものが黙って消えたように見えるので、**黙ってやらない**
 * のがこの窓の役目。外れたデータは消えてはおらず、消された側が同じものとして作り直されれば
 * 元のまま戻る。
 *
 * **既読は持たない**（`SyncFoldNotifier` と同じ）。取りこぼしても中身は失われず、
 * 外れたままのデータが次の同期でもう一度知らされないだけ。
 *
 * 描くものは無い。窓が開いている間ずっと聞いていられるよう AppShell に置く。
 */
export function SyncParentDeletedNotifier() {
  useEffect(() => subscribeSyncParentDeletedChanged(showToasts), [])

  return null
}

/**
 * 外れたデータと戻ったデータを、それぞれ1つのトーストにまとめて出す。
 *
 * 1回の同期で複数の行が外れることがあり（親1つに子は何十行もぶら下がる）、行ごとに
 * 出すと窓が埋まるので、数え上げはここで行う。自動で消えると見落とすため、閉じるまで残す。
 *
 * **消えていないことを必ず書く。** 版は残っていて、消された側が作り直されれば元のまま
 * 戻る。「削除しました」と書くと、取り返せないと読まれる。
 */
function showToasts(report: SyncParentDeletedReport): void {
  if (report.parentDeleted.length > 0) {
    toast.warning(
      `${BETA_ORIGIN_PREFIX}他のPCでの削除にともない、一部のデータを表示から外しました`,
      {
        description: `${breakdown(report.parentDeleted)}\nもとになるものが他のPCで削除されたため、それにぶら下がっていたものを表示から外しています。中身は残してあるので、削除されたものが同じものとして作り直されれば、そのまま表示に戻ります。`,
        duration: Infinity,
        closeButton: true,
      }
    )
  }

  if (report.parentReturned.length > 0) {
    toast.info(
      `${BETA_ORIGIN_PREFIX}表示から外していたデータを表示に戻しました`,
      {
        description: `${breakdown(report.parentReturned)}\nもとになるものが他のPCで作り直されたので、外していたものをふたたび表示しています。`,
        duration: Infinity,
        closeButton: true,
      }
    )
  }
}

/**
 * 「試験 が削除されたため 試験の受験生徒 3件、答案画像 2件」のように、
 * 消されたものごとに、ぶら下がっていたものの件数を並べる。
 */
function breakdown(records: SyncParentDeleted[]): string {
  const countByCauseAndTable = new Map<string, Map<string, number>>()
  for (const record of records) {
    const countByTable =
      countByCauseAndTable.get(record.causeTable) ?? new Map<string, number>()
    countByTable.set(
      record.tableName,
      (countByTable.get(record.tableName) ?? 0) + 1
    )
    countByCauseAndTable.set(record.causeTable, countByTable)
  }
  return [...countByCauseAndTable]
    .map(([causeTable, countByTable]) => {
      const tables = [...countByTable]
        .map(([tableName, count]) => `${syncTableLabel(tableName)} ${count}件`)
        .join("、")
      return `${syncTableLabel(causeTable)}の削除にともない ${tables}`
    })
    .join("\n")
}
