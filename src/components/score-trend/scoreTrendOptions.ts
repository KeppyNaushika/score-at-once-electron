import type { StudentExamResult } from "@/electron-src/lib/prisma/student"

import type { SubtotalOption } from "./types"

/** 系列の色。追加した順に回して使う */
export const SERIES_COLORS = [
  "hsl(210, 70%, 50%)",
  "hsl(150, 60%, 45%)",
  "hsl(30, 80%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 65%, 55%)",
  "hsl(180, 55%, 45%)",
  "hsl(60, 65%, 45%)",
  "hsl(330, 60%, 55%)",
]

export const formatShortDate = (date: Date) =>
  new Date(date).toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
  })

/** X 軸（試験日の時刻値）の目盛り。`m/d` */
export const formatDateTick = (tickValue: number) => {
  const date = new Date(tickValue)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

/** Y 軸（得点率）の目盛り */
export const formatPercentTick = (tickValue: number) => `${tickValue}%`

/** 試験に付いているタグを、重複を除いて名前順に並べる */
export function collectTrendTags(examResults: StudentExamResult[]): string[] {
  const tagSet = new Set<string>()
  examResults.forEach((examResult) =>
    examResult.tags.forEach((tag) => tagSet.add(tag))
  )
  return Array.from(tagSet).sort()
}

/** 試験に現れる小計を、重複を除いてグループ名・小計名の順に並べる */
export function collectSubtotalOptions(
  examResults: StudentExamResult[]
): SubtotalOption[] {
  const map = new Map<string, SubtotalOption>()
  examResults.forEach((examResult) => {
    examResult.subtotalScores.forEach((subtotalScore) => {
      if (!map.has(subtotalScore.subtotalId)) {
        map.set(subtotalScore.subtotalId, {
          id: subtotalScore.subtotalId,
          label: subtotalScore.subtotalName,
          groupName: subtotalScore.subtotalGroupName,
        })
      }
    })
  })
  return Array.from(map.values()).sort((optionA, optionB) => {
    const groupComparison = optionA.groupName.localeCompare(optionB.groupName)
    if (groupComparison !== 0) return groupComparison
    return optionA.label.localeCompare(optionB.label)
  })
}

/** グループ名でまとめた小計一覧（並びは {@link collectSubtotalOptions} のまま） */
export function groupSubtotalOptions(
  subtotalOptions: SubtotalOption[]
): [string, SubtotalOption[]][] {
  const groups = new Map<string, SubtotalOption[]>()
  for (const option of subtotalOptions) {
    const list = groups.get(option.groupName) || []
    list.push(option)
    groups.set(option.groupName, list)
  }
  return Array.from(groups.entries())
}
