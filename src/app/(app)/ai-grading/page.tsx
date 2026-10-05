"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

import { ExperimentalBadge } from "@/components/common/ExperimentalBadge"
import PageHeader from "@/components/layout/PageHeader"

import { AiGradingTabs, parseAiGradingTab } from "./components/AiGradingTabs"

/**
 * URL のクエリ（`?tab=pricing` など）を最初のタブにする（07 の「単価を入れる」から来たとき）。
 * クエリが変わったら作り直す（`key`）。同じページのままクエリだけが変わっても切り替わる
 */
function AiGradingTabsFromQuery() {
  const tabQuery = useSearchParams().get("tab")
  return (
    <AiGradingTabs
      key={tabQuery ?? ""}
      initialTab={parseAiGradingTab(tabQuery)}
    />
  )
}

/** 「AI採点」（実験的機能）の画面（設定・料金・使用トークン。docs/vlm-grading-design.md §9） */
export default function AiGradingPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="AI採点"
        subtitle={<ExperimentalBadge label="実験的" />}
      />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="container mx-auto max-w-5xl p-6">
          {/* useSearchParams を使う部品は Suspense で包む（本番ビルドの事前描画で要る） */}
          <Suspense>
            <AiGradingTabsFromQuery />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
