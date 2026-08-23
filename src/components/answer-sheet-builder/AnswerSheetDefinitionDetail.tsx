"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { toast } from "sonner"

import type {
  EntityOverviewBasics,
  EntityOverviewStat,
} from "@/components/common/EntityOverviewPage"
import {
  EntityOverviewPage,
  toDateInputValue,
} from "@/components/common/EntityOverviewPage"
import { getAnswerSheetCompletion } from "@/lib/answerSheetStatus"
import {
  answerSheetBuilderWorkflowPhases,
  answerSheetBuilderWorkflowTabs,
} from "@/lib/workflowTabs"
import {
  answerSheetDefinitionQuery,
  applyAnswerSheetEditMutation,
} from "@/queries/answerSheetBuilder"
import {
  answerSheetDefinitionTagsQuery,
  setAnswerSheetDefinitionTagsMutation,
} from "@/queries/tag"

import { countAsbQuestions } from "./answerSheetStats"
import { useAsbOwner } from "./hooks/useAsbOwner"

interface AnswerSheetDefinitionDetailProps {
  definitionId: string
}

const ORIENTATION_LABELS: Record<string, string> = {
  portrait: "縦",
  landscape: "横",
}

/**
 * 解答用紙の概要ページ。
 * 名前・使用日・説明・タグをその場で書き換え、段の進み具合をカードで見せる。
 */
export function AnswerSheetDefinitionDetail({
  definitionId,
}: AnswerSheetDefinitionDetailProps) {
  const {
    data: definition = null,
    isPending,
    error: loadError,
  } = useQuery(answerSheetDefinitionQuery(definitionId))
  const { data: definitionTags } = useQuery(
    answerSheetDefinitionTagsQuery(definitionId)
  )
  const applyEdit = useMutation(applyAnswerSheetEditMutation(definitionId))
  const setDefinitionTags = useMutation(
    setAnswerSheetDefinitionTagsMutation(definitionId)
  )
  const { isOwner, ownerName } = useAsbOwner(definitionId)

  // 読み込みの失敗は通知する（取得ではないので effect でよい）
  useEffect(() => {
    if (loadError) toast.error(loadError.message)
  }, [loadError])

  if (isPending) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (!definition) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          解答用紙が見つかりませんでした
        </p>
      </div>
    )
  }

  const { questionCount, totalPoints } = countAsbQuestions(
    definition.majorQuestions
  )
  const completion = getAnswerSheetCompletion({
    id: definitionId,
    questionCount,
  })

  /**
   * 更新は**属性ひとそろい**を運ぶ（一部だけ運ぶと「載っていない」と「空にする」を
   * 区別できない）。概要が触るのは3つだけなので、残りはいまの姿から埋める。
   */
  const handleCommitBasics = async (basics: EntityOverviewBasics) => {
    await applyEdit.mutateAsync({
      type: "UPDATE_DEFINITION",
      payload: {
        attributes: {
          name: basics.name,
          description: basics.description.trim() || null,
          referenceDate: basics.referenceDate || null,
          labelPresets: definition.labelPresets,
          settings: definition.settings,
        },
      },
    })
  }

  const handleReplaceTags = async (tagIds: string[]) => {
    await setDefinitionTags.mutateAsync(tagIds)
  }

  const stats: EntityOverviewStat[] = [
    { label: "用紙", value: definition.settings.paperSize, tone: "teal" },
    {
      label: "向き",
      value:
        ORIENTATION_LABELS[definition.settings.orientation] ??
        definition.settings.orientation,
      tone: "rose",
    },
    { label: "設問", value: `${questionCount}問`, tone: "purple" },
    { label: "合計配点", value: `${totalPoints}点`, tone: "orange" },
    {
      label: "担当",
      value: isOwner ? "自分" : (ownerName ?? "-"),
      tone: "blue",
    },
  ]

  return (
    <EntityOverviewPage
      nameLabel="解答用紙名"
      dateLabel="使用日"
      basics={{
        name: definition.name,
        referenceDate: toDateInputValue(definition.referenceDate),
        description: definition.description ?? "",
      }}
      onCommitBasics={handleCommitBasics}
      tags={(definitionTags ?? []).map((definitionTag) => definitionTag.tag)}
      onReplaceTags={handleReplaceTags}
      canEdit={isOwner}
      editDisabledReason={`編集できるのは担当の${ownerName ?? "利用者"}さんだけです。`}
      stats={stats}
      tabs={answerSheetBuilderWorkflowTabs}
      entityHref={`/answer-sheet-builder/${definitionId}`}
      phases={answerSheetBuilderWorkflowPhases}
      stepCompletion={{
        "01-edit": completion.hasQuestions,
        // 書き出しは何度でもできるので済みという状態を持たない
        "02-export": null,
      }}
    />
  )
}
