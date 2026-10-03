"use client"

import { AlertCircle, ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { describeSyncWarnings } from "@/lib/shared/syncWarningMessages"

/**
 * 直近の同期が出した注意を、**消えない形で**並べる。
 *
 * 同じ注意は原因が続くかぎり毎回出るので、トーストだけだと流れて消えたあと
 * 確かめる場所が無くなる。ここが確かめる場所。履歴ではなく直近1回ぶんだけを出す
 * （溜めると、直っていないのか昔の話なのかが読めなくなる）。
 *
 * 言い換えられなかった注意は原文のまま出す。知らない注意を黙って捨てない。
 */
export function SyncWarningList({ warnings }: { warnings: string[] }) {
  const [showsOriginals, setShowsOriginals] = useState(false)
  const notices = describeSyncWarnings(warnings)
  if (notices.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-900">
        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
        直近の同期で出た注意
      </h3>
      <ul className="space-y-2 text-sm text-amber-800">
        {notices.map((notice) => (
          <li key={notice.key}>
            {notice.message}
            {notice.count > 1 && (
              <span className="text-amber-700">（{notice.count}件）</span>
            )}
            {!notice.translated && (
              <span className="ml-1 text-xs text-amber-700">
                （このPCでは言い換えられない知らせです。そのまま表示しています）
              </span>
            )}
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2 h-auto px-2 py-1 text-amber-900"
        onClick={() => setShowsOriginals(!showsOriginals)}
      >
        {showsOriginals ? (
          <ChevronDown className="mr-1 h-4 w-4" />
        ) : (
          <ChevronRight className="mr-1 h-4 w-4" />
        )}
        {showsOriginals ? "詳しい内容を畳む" : "詳しい内容を見る"}
      </Button>
      {showsOriginals && (
        <pre className="mt-2 max-h-60 overflow-auto rounded bg-amber-100 p-2 text-xs whitespace-pre-wrap text-amber-900">
          {warnings.join("\n")}
        </pre>
      )}
    </div>
  )
}
