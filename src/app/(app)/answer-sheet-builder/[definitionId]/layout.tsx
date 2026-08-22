"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React from "react"

import type { WorkflowTab } from "@/components/common/WorkflowTabHeader"
import { WorkflowTabHeader } from "@/components/common/WorkflowTabHeader"
import { answerSheetDefinitionQuery } from "@/queries/answerSheetBuilder"

const workflowTabs: readonly WorkflowTab[] = [
  { id: "detail", label: "概要", path: "" },
  { id: "01-edit", label: "1. 作成", path: "/01-edit" },
  { id: "02-export", label: "2. 書き出し", path: "/02-export" },
]

/**
 * 解答用紙作成の個別定義レイアウト。
 * 概要 / 1. 作成 / 2. 書き出し の3ページをタブで束ねる。
 */
/** パンくずに出すのは定義名だけ（select の同一性を保つため外に置く） */
const selectDefinitionName = (definition: { name: string }) => definition.name

export default function AnswerSheetBuilderDefinitionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams<{ definitionId: string }>()
  const definitionId = params.definitionId
  // パンくずが要るのは定義名だけ。定義そのもののキャッシュを各ページと共有する
  const { data: definitionName = "" } = useQuery({
    ...answerSheetDefinitionQuery(definitionId),
    select: selectDefinitionName,
  })

  return (
    <div className="flex h-screen flex-col">
      <WorkflowTabHeader
        listHref="/answer-sheet-builder"
        listLabel="解答用紙作成"
        entityName={definitionName || "解答用紙"}
        entityHref={`/answer-sheet-builder/${definitionId}`}
        tabs={workflowTabs}
      />
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </div>
  )
}
