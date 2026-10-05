"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

import { parseAuditFilterQuery } from "@/lib/auditLogFilterQuery"

import { AuditLogList } from "./components/AuditLogList"

/**
 * URL のクエリを最初の絞り込みにする（詳細ページの「操作履歴」から来たとき）。
 *
 * クエリが変わったら一覧を作り直す（`key`）。サイドバーから来直したときなど、
 * 同じページのままクエリだけが変わっても、前の絞り込みを持ち越さない。
 */
function AuditLogListFromQuery() {
  const query = useSearchParams().toString()
  return (
    <AuditLogList key={query} initialFilter={parseAuditFilterQuery(query)} />
  )
}

export default function AuditLogsPage() {
  // useSearchParams を使う部品は Suspense で包む（本番ビルドの事前描画で要る）
  return (
    <Suspense>
      <AuditLogListFromQuery />
    </Suspense>
  )
}
