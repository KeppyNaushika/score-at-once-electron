import { useMemo, useState } from "react"

import type {
  CourseworkArchiveMatch,
  CourseworkImportDecision,
} from "@/types/courseworkArchive.types"

/** 選択値 → 決定。"new" または "reuse:<existingId>" */
function valueToDecision(value: string): CourseworkImportDecision {
  if (value === "new") return { action: "new" }
  return { action: "reuse", existingId: value.slice("reuse:".length) }
}

/**
 * 旧形式（.coursework / .grade）の取り込みで、資料ごとに「既存に取り込む」か「新規作成」かを
 * 選ばせる状態。uuid一致があれば既定で統合、無ければ新規作成を初期選択にする。
 *
 * `courseworkMatches` は照合の結果（preview）から渡す。配列が切り替わったら前回の選択は無効になる
 */
export function useCourseworkImportDecisions(
  courseworkMatches: CourseworkArchiveMatch[]
) {
  // archiveId → 選択値（"new" | "reuse:<id>"）。ユーザーが明示的に変更した分のみ保持。
  // どの照合結果に対する選択かを一緒に持ち、照合結果が切り替わったら前回分は無効になる
  const [manualSelections, setManualSelections] = useState<{
    courseworkMatches: CourseworkArchiveMatch[] | null
    values: Record<string, string>
  }>({ courseworkMatches: null, values: {} })
  const selections = useMemo(
    () =>
      manualSelections.courseworkMatches === courseworkMatches
        ? manualSelections.values
        : {},
    [manualSelections, courseworkMatches]
  )

  const selectArchive = (archiveId: string, value: string) => {
    setManualSelections({
      courseworkMatches,
      values: { ...selections, [archiveId]: value },
    })
  }

  // 照合結果が変わったら初期選択を計算（uuid一致→統合、無ければ新規）
  const initialSelections = useMemo(() => {
    const init: Record<string, string> = {}
    for (const courseworkMatch of courseworkMatches) {
      init[courseworkMatch.archiveId] = courseworkMatch.uuidMatch
        ? `reuse:${courseworkMatch.uuidMatch.id}`
        : "new"
    }
    return init
  }, [courseworkMatches])

  const effectiveSelections = useMemo(
    () => ({ ...initialSelections, ...selections }),
    [initialSelections, selections]
  )

  /** 取り込みに渡す、資料ごとの決定（archiveId → 決定） */
  const buildDecisions = () => {
    const decisions: Record<string, CourseworkImportDecision> = {}
    for (const courseworkMatch of courseworkMatches) {
      decisions[courseworkMatch.archiveId] = valueToDecision(
        effectiveSelections[courseworkMatch.archiveId] ?? "new"
      )
    }
    return decisions
  }

  return { effectiveSelections, selectArchive, buildDecisions }
}
