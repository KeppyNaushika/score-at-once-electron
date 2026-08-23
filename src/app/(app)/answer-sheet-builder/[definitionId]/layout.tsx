"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React from "react"

import { WorkflowTabHeader } from "@/components/common/WorkflowTabHeader"
import { answerSheetBuilderWorkflowTabs } from "@/lib/workflowTabs"
import { answerSheetDefinitionQuery } from "@/queries/answerSheetBuilder"

/**
 * 解答用紙作成の個別定義レイアウト。
 * 概要 / 1. 作成 / 2. 書き出し の3ページをタブで束ねる。
 */
/** ヘッダーに出すのは定義名だけ（select の同一性を保つため外に置く） */
const selectDefinitionName = (definition: { name: string }) => definition.name

export default function AnswerSheetBuilderDefinitionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams<{ definitionId: string }>()
  const definitionId = params.definitionId
  // ヘッダーが要るのは定義名だけ。定義そのもののキャッシュを各ページと共有する
  const { data: definitionName = "" } = useQuery({
    ...answerSheetDefinitionQuery(definitionId),
    select: selectDefinitionName,
  })

  return (
    <div className="flex h-screen flex-col">
      <WorkflowTabHeader
        listHref="/answer-sheet-builder"
        entityName={definitionName || "解答用紙"}
        entityHref={`/answer-sheet-builder/${definitionId}`}
        tabs={answerSheetBuilderWorkflowTabs}
      />
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </div>
  )
}
