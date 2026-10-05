"use client"

import { ScanSearch } from "lucide-react"
import type { ComponentProps } from "react"

import { SidePanelSection } from "@/components/exams/07-score-at-once/ScoringSidePanel/SidePanelSection"

import { AiAnswerDetailPanel } from "./AiAnswerDetailPanel"
import type { AiGridItem } from "./types"

type AiSelectedAnswerSectionProps = Omit<
  ComponentProps<typeof AiAnswerDetailPanel>,
  "gridItem"
> & {
  /** 1つだけ選んでいる答案。0件・複数なら null */
  singleSelectedItem: AiGridItem | null
}

/**
 * 「選んだ答案」の節（左パネルのアノテーション反映のタブに置く）。
 * 答案を1つだけ選んでいるとき、朱書きを直したり AI の判定を見比べたりする
 */
export function AiSelectedAnswerSection({
  singleSelectedItem,
  ...detailPanelProps
}: AiSelectedAnswerSectionProps) {
  return (
    <SidePanelSection icon={ScanSearch} title="選んだ答案">
      {singleSelectedItem ? (
        <AiAnswerDetailPanel
          key={singleSelectedItem.id}
          gridItem={singleSelectedItem}
          {...detailPanelProps}
        />
      ) : (
        <p className="py-2 text-xs text-muted-foreground">
          答案を1つだけ選ぶと、朱書きを直したり、AI の判定を見比べたりできます
        </p>
      )}
    </SidePanelSection>
  )
}
