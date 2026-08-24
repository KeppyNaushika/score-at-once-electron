"use client"

import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"

import { CropRegionAssigneeBadges } from "@/components/exams/08-finalize/CropRegionAssigneeBadges"
import { Badge } from "@/components/ui/badge"
import type {
  ScoreDecisionCell,
  ScoreDecisionQuestion,
} from "@/types/scoreDecision.types"

interface QuestionAssignmentRowProps {
  question: ScoreDecisionQuestion
  selectedCell: ScoreDecisionCell | null
  onSelectCell: (cell: ScoreDecisionCell) => void
}

/**
 * 設問1行（担当バッジ・進捗・裁定対象）。
 *
 * **担当は読むだけ。直すのは「3. 領域情報」の採点担当タブ。** この画面の役目は
 * 食い違いを裁くことに絞り、割当を直す場所を1つに保つ（同じ操作の口が2つあると、
 * どちらで直したかで結果が違うように見える）。
 */
export function QuestionAssignmentRow({
  question,
  selectedCell,
  onSelectCell,
}: QuestionAssignmentRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="border-b border-gray-100">
      <div className="flex items-start gap-2 px-3 py-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={question.cells.length === 0}
          className="mt-0.5 shrink-0 text-gray-400 disabled:opacity-30"
          title={
            question.cells.length > 0
              ? "裁定対象を表示"
              : "裁定対象はありません"
          }
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium">
              {question.questionLabel}
              <span className="ml-1 text-xs font-normal text-gray-500">
                {question.maxScore}点
              </span>
            </span>
            <span className="shrink-0 text-xs text-gray-500">
              {question.scoredCount}/{question.totalStudents}
            </span>
          </div>

          {/* 担当バッジ（担当0人は全員担当）。直す口はここには無い */}
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <CropRegionAssigneeBadges
              assignees={question.assignees}
              totalStudents={question.totalStudents}
            />

            {question.cells.length > 0 && (
              <Badge className="ml-auto shrink-0 bg-purple-600">
                要裁定 {question.cells.length}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* 裁定対象の生徒 */}
      {isExpanded &&
        question.cells.map((cell) => (
          <button
            key={`${cell.cropRegionId}:${cell.examStudentId}`}
            onClick={() => onSelectCell(cell)}
            className={`flex w-full items-center justify-between gap-2 py-1.5 pr-3 pl-9 text-left text-sm hover:bg-blue-50 ${
              selectedCell?.cropRegionId === cell.cropRegionId &&
              selectedCell?.examStudentId === cell.examStudentId
                ? "bg-blue-50 font-medium"
                : ""
            }`}
          >
            <span className="truncate">{cell.studentName}</span>
            {cell.reason === "conflict" ? (
              <Badge className="shrink-0 bg-purple-600">食い違い</Badge>
            ) : (
              <Badge className="shrink-0 bg-yellow-600">要再確認</Badge>
            )}
          </button>
        ))}
    </div>
  )
}
