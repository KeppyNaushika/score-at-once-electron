"use client"

import { Button } from "@/components/ui/button"

/** 担当の範囲（自分の担当の数と全体の数） */
interface AssignmentCount {
  assigned: number
  total: number
}

/** 採点担当による絞り込みの状態（`useScoringScreen` が作る） */
export interface AssignmentScope {
  /** 「すべて表示」中か */
  showAll: boolean
  onShowAllChange: (showAll: boolean) => void
  questions: AssignmentCount
  students: AssignmentCount
}

interface AssignmentScopeNoticeProps {
  assignmentScope: AssignmentScope
}

/**
 * 採点担当で答案が絞られていることと、「すべて表示」の切り替え。
 *
 * 絞り込みは役割ではなく自分の割り当てで決まる（OWNER も絞られる）。全体を見たいとき
 * （裁定のために全設問を見る、など）は自動で素通りさせず、ここで明示的に切り替える。
 * 担当が自分の範囲を狭めていなければ何も出さない。
 */
export function AssignmentScopeNotice({
  assignmentScope,
}: AssignmentScopeNoticeProps) {
  const { showAll, onShowAllChange, questions, students } = assignmentScope
  const isQuestionNarrowed = questions.assigned < questions.total
  const isStudentNarrowed = students.assigned < students.total
  if (!isQuestionNarrowed && !isStudentNarrowed) return null

  const ranges = [
    isQuestionNarrowed && `設問 ${questions.assigned}/${questions.total}`,
    isStudentNarrowed && `生徒 ${students.assigned}/${students.total}人`,
  ].filter(Boolean)

  return (
    <div className="mb-2 flex items-center gap-2 rounded bg-blue-50 px-2 py-1 text-[10px] text-blue-700">
      <span className="flex-1">
        {showAll
          ? `すべての設問・生徒を表示しています（自分の担当は${ranges.join("・")}）`
          : `自分の担当だけ表示しています（${ranges.join("・")}）`}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-5 shrink-0 px-2 text-[10px]"
        onClick={() => onShowAllChange(!showAll)}
      >
        {showAll ? "担当だけに戻す" : "すべて表示"}
      </Button>
    </div>
  )
}
