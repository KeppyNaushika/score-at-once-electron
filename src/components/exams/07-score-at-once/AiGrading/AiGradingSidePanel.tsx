"use client"

import { type ComponentProps, type ReactNode } from "react"

import { AiGridDisplaySection } from "./AiGridDisplaySection"

interface AiGradingSidePanelProps {
  /** 先頭に置く設問ナビゲーター */
  questionNavigator: ReactNode
  /** 「表示」節に渡すもの */
  displaySection: ComponentProps<typeof AiGridDisplaySection>
}

/**
 * AI採点モードの右パネル（一覧表示の右パネルと同じく右端に固定）。
 * 設問 → 表示（絞り込み・件数・並べ方）。
 *
 * 選んだ答案の詳細は左パネルのアノテーション反映のタブに、`<` `>` と I のキーは
 * 作業場（`useAiAttemptNavigation`）にある
 */
export function AiGradingSidePanel({
  questionNavigator,
  displaySection,
}: AiGradingSidePanelProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto border-l border-gray-200 bg-white px-3">
      {questionNavigator}
      <AiGridDisplaySection {...displaySection} />
    </div>
  )
}
