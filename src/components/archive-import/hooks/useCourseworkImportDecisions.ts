import { useMemo, useState } from "react"

import type {
  CourseworkArchiveMatch,
  CourseworkImportDecision,
} from "@/types/courseworkArchive.types"

/** 既存の資料に取り込むとき、id をどちらに合わせるか */
type CourseworkAdoptId = "existing" | "archive"

/** 人が明示的に選んだ分（archiveId → 選択値・id の合わせ先） */
interface ManualSelections {
  values: Record<string, string>
  adoptIds: Record<string, CourseworkAdoptId>
}

/** 選択値 → 決定。"new" または "reuse:<existingId>" */
function valueToDecision(
  value: string,
  adoptId: CourseworkAdoptId
): CourseworkImportDecision {
  if (value === "new") return { action: "new" }
  return {
    action: "reuse",
    existingId: value.slice("reuse:".length),
    adoptId,
  }
}

/**
 * 旧形式（.coursework / .grade）の取り込みで、資料ごとに「既存に取り込む」か「新規作成」かを
 * 選ばせる状態。
 *
 * **id が一致する資料は選ばせない**（同じ資料として取り込む。取り込み側も判断を見ない）。
 * id が一致しない資料は、名前の候補へ取り込むか新規作成かを選び、取り込むときは id を
 * このPC／ファイルのどちらに合わせるかも選ぶ。初期選択は新規作成。
 *
 * `courseworkMatches` は照合の結果（preview）から渡す。配列が切り替わったら前回の選択は無効になる
 */
export function useCourseworkImportDecisions(
  courseworkMatches: CourseworkArchiveMatch[]
) {
  // archiveId → 選択値（"new" | "reuse:<id>"）と id の合わせ先。ユーザーが明示的に変更した分のみ
  // 保持する。どの照合結果に対する選択かを一緒に持ち、照合結果が切り替わったら前回分は無効になる
  const [manualSelections, setManualSelections] = useState<
    {
      courseworkMatches: CourseworkArchiveMatch[] | null
    } & ManualSelections
  >({ courseworkMatches: null, values: {}, adoptIds: {} })
  const current = useMemo(
    (): ManualSelections =>
      manualSelections.courseworkMatches === courseworkMatches
        ? manualSelections
        : { values: {}, adoptIds: {} },
    [manualSelections, courseworkMatches]
  )

  const selectArchive = (archiveId: string, value: string) => {
    setManualSelections({
      courseworkMatches,
      values: { ...current.values, [archiveId]: value },
      adoptIds: current.adoptIds,
    })
  }

  const selectAdoptId = (archiveId: string, adoptId: CourseworkAdoptId) => {
    setManualSelections({
      courseworkMatches,
      values: current.values,
      adoptIds: { ...current.adoptIds, [archiveId]: adoptId },
    })
  }

  const effectiveSelections = useMemo(
    () =>
      Object.fromEntries(
        courseworkMatches.map((courseworkMatch) => [
          courseworkMatch.archiveId,
          courseworkMatch.uuidMatch
            ? `reuse:${courseworkMatch.uuidMatch.id}`
            : (current.values[courseworkMatch.archiveId] ?? "new"),
        ])
      ),
    [courseworkMatches, current]
  )

  const adoptIdOf = (archiveId: string): CourseworkAdoptId =>
    current.adoptIds[archiveId] ?? "existing"

  /** 取り込みに渡す、資料ごとの決定（archiveId → 決定）。id が一致する資料は渡さない */
  const buildDecisions = () => {
    const decisions: Record<string, CourseworkImportDecision> = {}
    for (const courseworkMatch of courseworkMatches) {
      if (courseworkMatch.uuidMatch) continue
      decisions[courseworkMatch.archiveId] = valueToDecision(
        effectiveSelections[courseworkMatch.archiveId] ?? "new",
        adoptIdOf(courseworkMatch.archiveId)
      )
    }
    return decisions
  }

  return {
    effectiveSelections,
    selectArchive,
    adoptIdOf,
    selectAdoptId,
    buildDecisions,
  }
}
