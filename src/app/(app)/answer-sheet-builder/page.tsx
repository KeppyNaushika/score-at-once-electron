"use client"

import { AnswerSheetDefinitionList } from "@/components/answer-sheet-builder/AnswerSheetDefinitionList"

/**
 * ヘッダー（題・戻る／進む・操作）は `EntityListPage` が持つので、ページは
 * 一覧を全面に置くだけ。4つのトップページで同じ形にしてある。
 */
export default function AnswerSheetBuilderPage() {
  return (
    <div className="h-full overflow-hidden">
      <AnswerSheetDefinitionList />
    </div>
  )
}
