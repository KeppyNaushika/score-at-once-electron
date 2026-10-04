"use client"

import { Badge } from "@/components/ui/badge"
import type { ASBDefinitionListItem } from "@/types/answerSheetBuilder.types"

interface DefinitionSummaryProps {
  definition: ASBDefinitionListItem
  currentUserId: string
}

/** 解答用紙一覧の行の要約（タグ・用紙・設問数・合計配点・担当） */
export function DefinitionSummary({
  definition,
  currentUserId,
}: DefinitionSummaryProps) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {(definition.tags ?? []).map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className="text-xs font-normal"
          style={
            tag.color ? { borderColor: tag.color, color: tag.color } : undefined
          }
        >
          {tag.name}
        </Badge>
      ))}
      <span>
        {definition.paperSize ?? "-"}{" "}
        {definition.orientation === "landscape" ? "横" : "縦"}
        {" / 設問数: "}
        {definition.questionCount ?? 0}
        {" / 合計配点: "}
        {definition.totalPoints ?? 0}点 / 担当:{" "}
        {definition.ownerId === currentUserId ? "自分" : definition.ownerName}
      </span>
    </span>
  )
}
