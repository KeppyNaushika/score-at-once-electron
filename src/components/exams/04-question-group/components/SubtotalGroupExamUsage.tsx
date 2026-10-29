"use client"

import type { Exam } from "@prisma/client"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { matchesSearchTerm } from "@/lib/searchText"

interface SubtotalGroupExamUsageProps {
  exams: Exam[]
  searchTerm: string
}

/** 試験日の新しい順。試験日の無い試験は後ろへ回し、その中では作成日の新しい順 */
function compareByReferenceDateDesc(left: Exam, right: Exam): number {
  if (left.referenceDate && right.referenceDate) {
    return right.referenceDate.getTime() - left.referenceDate.getTime()
  }
  if (left.referenceDate) return -1
  if (right.referenceDate) return 1
  return right.createdAt.getTime() - left.createdAt.getTime()
}

function formatReferenceDate(exam: Exam): string {
  return exam.referenceDate
    ? exam.referenceDate.toLocaleDateString("ja-JP")
    : "試験日なし"
}

/**
 * 小計点グループを使っている試験。件数が多いと名前を並べても読めないので、
 * 件数と最新の試験だけを出し、全件は開いたときに1行1試験で出す。
 * 検索語が試験名に当たったときは、最新の代わりに当たった試験を出す。
 */
export function SubtotalGroupExamUsage({
  exams,
  searchTerm,
}: SubtotalGroupExamUsageProps) {
  const [open, setOpen] = useState(false)

  if (exams.length === 0) return <>どの試験でも使っていません</>

  const sortedExams = exams.toSorted(compareByReferenceDateDesc)
  const latestExam = sortedExams[0]
  const matchedExams =
    searchTerm.trim() === ""
      ? []
      : sortedExams.filter((exam) =>
          matchesSearchTerm(searchTerm, [exam.examName])
        )

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex flex-wrap items-center gap-x-2">
        <span>
          使用中 {exams.length}試験（
          {matchedExams.length > 0
            ? `一致: ${matchedExams.map((exam) => exam.examName).join(", ")}`
            : `最新: ${formatReferenceDate(latestExam)} ${latestExam.examName}`}
          ）
        </span>
        {exams.length > 1 && (
          <CollapsibleTrigger className="inline-flex items-center text-primary hover:underline">
            {open ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {open ? "閉じる" : "すべて表示"}
          </CollapsibleTrigger>
        )}
      </div>
      <CollapsibleContent>
        <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto border-l pl-3">
          {sortedExams.map((exam) => (
            <li
              key={exam.id}
              className={
                matchedExams.includes(exam)
                  ? "font-medium text-foreground"
                  : undefined
              }
            >
              <span className="inline-block w-24 tabular-nums">
                {formatReferenceDate(exam)}
              </span>
              {exam.examName}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
