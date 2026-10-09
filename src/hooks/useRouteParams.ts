"use client"

import { usePathname } from "next/navigation"

/**
 * 動的ルートの param 名を、URL の第1セグメント（`src/app/(app)/<section>/[param]/`）
 * から引く表。**動的ルートの定義はここ1か所だけ。** `src/app` に動的セグメントを
 * 足したら、ここにも足す（入れ子の動的セグメント・catch-all は今は無い）。
 *
 * `next/navigation` の `useParams` は使わない。静的書き出し（`output: "export"`）
 * では動的ルートが仮の値 `"__"` の殻1枚に畳まれ、`useParams()` は実際の URL では
 * なくその仮の値を返す。`usePathname()` は実際の URL を返すので、そこから読む。
 */
const ROUTE_PARAM_NAMES = {
  exams: "examId",
  grades: "gradeId",
  coursework: "courseworkId",
  students: "studentId",
  classrooms: "classroomId",
  "answer-sheet-builder": "definitionId",
} as const

type RouteSection = keyof typeof ROUTE_PARAM_NAMES

/** 動的ルートの param 名 */
type RouteParamName = (typeof ROUTE_PARAM_NAMES)[RouteSection]

/**
 * 今の URL の params。動的ルートの外（一覧など）では空。
 * どの param が載るかは URL 次第なので、どれも省略され得る。
 */
type RouteParams = Partial<Record<RouteParamName, string>>

function isRouteSection(section: string): section is RouteSection {
  return Object.hasOwn(ROUTE_PARAM_NAMES, section)
}

/**
 * `useParams` の代わり。URL のパスから動的ルートの param を読む。
 * 値は `useParams` と同じくデコード済み。
 */
export function useRouteParams(): RouteParams {
  const pathname = usePathname()
  const [section, encodedParam] = pathname.split("/").filter(Boolean)
  if (section === undefined || encodedParam === undefined) return {}
  if (!isRouteSection(section)) return {}
  return { [ROUTE_PARAM_NAMES[section]]: decodeURIComponent(encodedParam) }
}
