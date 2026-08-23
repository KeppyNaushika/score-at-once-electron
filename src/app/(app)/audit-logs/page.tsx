"use client"

import PageHeader from "@/components/layout/PageHeader"

import { AuditLogList } from "./components/AuditLogList"

export default function AuditLogsPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="監査ログ" />
      <div className="flex-1 overflow-hidden">
        <AuditLogList />
      </div>
    </div>
  )
}
