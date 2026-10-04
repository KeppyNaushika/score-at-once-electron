"use client"

import { useQuery } from "@tanstack/react-query"
import { FileInput } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Combobox } from "@/components/common/Combobox"
import { Button } from "@/components/ui/button"
import { asbModelAnswerSourceQuery } from "@/queries/aiGrading"
import { answerSheetDefinitionListQuery } from "@/queries/answerSheetBuilder"

import { draftModelAnswerFromAsb } from "./utils/asbModelAnswerDraft"

interface AsbModelAnswerDraftPickerProps {
  /** 設問のラベル（解答用紙の小問・枝問のラベルと突き合わせる） */
  cropRegionLabel: string
  /** 下書きを入れる（教員はそのあと直せる） */
  onDraft: (modelAnswerText: string) => void
}

/**
 * 解答用紙（ASB）の `||…||` から模範解答の下書きを入れる（設計 §2）。
 * 試験と解答用紙のつながりはラベルだけなので、どの解答用紙から取るかは教員が選ぶ
 */
export function AsbModelAnswerDraftPicker({
  cropRegionLabel,
  onDraft,
}: AsbModelAnswerDraftPickerProps) {
  const [definitionId, setDefinitionId] = useState("")
  const { data: definitions } = useQuery(answerSheetDefinitionListQuery())
  const sourceQuery = useQuery({
    ...asbModelAnswerSourceQuery(definitionId),
    enabled: definitionId !== "",
  })

  const handleDraft = () => {
    if (!sourceQuery.data) return
    const draft = draftModelAnswerFromAsb(sourceQuery.data, cropRegionLabel)
    if (!draft) {
      toast.error(
        `解答用紙に「${cropRegionLabel}」と同じラベルの解答欄がありません`
      )
      return
    }
    if (draft.modelAnswerText === "") {
      toast.error(
        `解答欄「${draft.matchedLabel}」に模範解答（||…||）がありません`
      )
      return
    }
    onDraft(draft.modelAnswerText)
    toast.success(`解答欄「${draft.matchedLabel}」から下書きを入れました`)
  }

  return (
    <div className="flex items-center gap-1">
      <Combobox
        options={(definitions ?? []).map((definition) => ({
          value: definition.id,
          label: definition.name,
          keywords: [definition.ownerName, definition.referenceDate ?? ""],
        }))}
        value={definitionId}
        onValueChange={setDefinitionId}
        placeholder="解答用紙を選ぶ"
        searchPlaceholder="解答用紙の名前"
        emptyText="解答用紙がありません"
        className="h-7 w-48 text-xs"
        aria-label="下書きに使う解答用紙"
      />
      <Button
        variant="outline"
        size="sm"
        className="h-7"
        onClick={handleDraft}
        disabled={!sourceQuery.data}
      >
        <FileInput className="h-3 w-3" />
        ASBから下書き
      </Button>
    </div>
  )
}
