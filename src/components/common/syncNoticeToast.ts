import { toast } from "sonner"

import { BETA_ORIGIN_PREFIX } from "@/components/common/BetaBadge"
import { syncTableLabel } from "@/lib/shared/syncTableLabels"

/**
 * 同期から届いた出来事を知らせるトースト（注意・隠した行・外した行の3つの窓が使う）。
 *
 * どれも同じトーストの並びに他の操作の結果も出るので、同期由来だと分かる印を付ける。
 * 自動で消えると見落とすため、閉じるまで残す。
 */
export function showSyncToast(
  severity: "warning" | "info",
  title: string,
  description: string
): void {
  toast[severity](`${BETA_ORIGIN_PREFIX}${title}`, {
    description,
    duration: Infinity,
    closeButton: true,
  })
}

/** 「試験の受験生徒 2件、タグ 1件」のように、表ごとの件数を出てきた順に並べる */
export function countByTableLabel(tableNames: string[]): string {
  const countByTable = new Map<string, number>()
  for (const tableName of tableNames) {
    countByTable.set(tableName, (countByTable.get(tableName) ?? 0) + 1)
  }
  return [...countByTable]
    .map(([tableName, count]) => `${syncTableLabel(tableName)} ${count}件`)
    .join("、")
}
