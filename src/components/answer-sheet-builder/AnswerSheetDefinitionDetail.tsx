"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { FolderOutput } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import BaseModal from "@/components/common/BaseModal"
import type {
  EntityOverviewBasics,
  EntityOverviewStat,
} from "@/components/common/EntityOverviewPage"
import {
  EntityOverviewPage,
  toDateInputValue,
} from "@/components/common/EntityOverviewPage"
import {
  type ExportOutcome,
  ExportResultSummary,
} from "@/components/common/ExportResultSummary"
import { Button } from "@/components/ui/button"
import { getAnswerSheetCompletion } from "@/lib/answerSheetStatus"
import {
  answerSheetBuilderWorkflowPhases,
  answerSheetBuilderWorkflowTabs,
} from "@/lib/workflowTabs"
import {
  answerSheetDefinitionQuery,
  applyAnswerSheetEditMutation,
  exportAnswerSheetDefinitionMutation,
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
  const { data: definitionTags, isFetching: isReloadingTags } = useQuery(
    answerSheetDefinitionTagsQuery(definitionId)
  )
  const applyEdit = useMutation(applyAnswerSheetEditMutation(definitionId))
  const setDefinitionTags = useMutation(
    setAnswerSheetDefinitionTagsMutation(definitionId)
  )
  const { isOwner, ownerName } = useAsbOwner(definitionId)
  const { mutateAsync: exportDefinition } = useMutation(
    exportAnswerSheetDefinitionMutation()
  )
  const [exportOutcome, setExportOutcome] = useState<ExportOutcome | null>(null)

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
   *
   * **ここだけ他の3実体と違う。** 概要から来るのは触った欄だけなので、触っていない
   * 欄もいまの姿から埋める。埋める先は取り直しが着地した `definition` なので、
   * 続けざまに別の欄を触ると取り直し前の値を運びうる —— それは属性ひとそろいで
   * 運ぶ作りの帰結で、直すなら `asb:save-definition` の分割
   * （docs/asb-ipc-split-plan.md）の側になる。
   */
  const handleCommitBasics = async (changed: Partial<EntityOverviewBasics>) => {
    await applyEdit.mutateAsync({
      type: "UPDATE_DEFINITION",
      payload: {
        attributes: {
          name: changed.name ?? definition.name,
          description:
            changed.description === undefined
              ? definition.description
              : changed.description.trim() || null,
          referenceDate:
            changed.referenceDate === undefined
              ? definition.referenceDate
              : changed.referenceDate || null,
          labelPresets: definition.labelPresets,
          settings: definition.settings,
        },
      },
    })
  }

  const handleReplaceTags = async (tagIds: string[]) => {
    await setDefinitionTags.mutateAsync(tagIds)
  }

  /**
   * `.asb` の書き出し。
   *
   * **段ではなく概要に置く。** 2. 書き出しの段が出すのは用紙そのもの（印刷用の
   * PDF）で、こちらは**実体を丸ごと持ち出すアーカイブ**である。試験の
   * `.score 書き出し` が概要にあるのと同じ位置づけ。
   */
  const handleExportArchive = async () => {
    try {
      const exportResult = await exportDefinition(definitionId)
      // 保存先を選ばずに閉じたのは失敗ではないので、何も言わない
      if (exportResult.canceled) return
      // 結果はモーダルの中で見せる（欠けた画像はファイル名まで出す）
      setExportOutcome({
        archives: [
          {
            sourceId: definitionId,
            sourceName: definition.name,
            outputPath: exportResult.outputPath,
            missingFiles: exportResult.missingFiles ?? [],
          },
        ],
        failures: [],
      })
    } catch {
      // 失敗の通知は MutationCache が出す
    }
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
    <>
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
        isReloadingTags={isReloadingTags}
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
        actions={
          <Button variant="outline" size="sm" onClick={handleExportArchive}>
            <FolderOutput className="mr-2 h-4 w-4" />
            .asb 書き出し
          </Button>
        }
      />

      {exportOutcome && (
        <BaseModal
          open
          onOpenChange={(open) => !open && setExportOutcome(null)}
          title=".asb 書き出し"
          variant={
            exportOutcome.archives.some(
              (archive) => archive.missingFiles.length > 0
            )
              ? "warning"
              : "success"
          }
          size="lg"
          actions={{ cancel: { label: "閉じる" } }}
        >
          <ExportResultSummary outcome={exportOutcome} />
        </BaseModal>
      )}
    </>
  )
}
