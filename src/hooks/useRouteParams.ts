"use client"

import { usePathname } from "next/navigation"

import {
  isRouteSection,
  ROUTE_PARAM_NAMES,
  type RouteParamName,
} from "@/lib/routeShell"

type RouteParams = Partial<Record<RouteParamName, string>>

/**
 * `useParams` の代わり。URL のパスから動的ルートの param を読む。
 * 値は `useParams` と同じくデコード済み。
 *
 * `next/navigation` の `useParams` は使わない。動的ルートは仮の値 `"__"` の殻1枚に
 * 畳まれていて（`src/lib/routeShell.ts`）、`useParams()` は実際の URL ではなくその仮の
 * 値を返す。`usePathname()` は実際の URL を返すので、そこから読む。
 *
 * どの param が載るかは URL 次第なので、どれも省略され得る。動的ルートの外（一覧など）
 * では空。
 */
export function useRouteParams(): RouteParams {
  const pathname = usePathname()
  const [section, encodedParam] = pathname.split("/").filter(Boolean)
  if (section === undefined || encodedParam === undefined) return {}
  if (!isRouteSection(section)) return {}
  return { [ROUTE_PARAM_NAMES[section]]: decodeURIComponent(encodedParam) }
}
