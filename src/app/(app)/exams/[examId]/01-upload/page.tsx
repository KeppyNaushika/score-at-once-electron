"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"

import { MasterAnswerManager } from "@/components/exams/01-upload/components/MasterAnswerManager"
import { examPagesQuery } from "@/queries/exam"

/**
 * MasterImageStepPage - 模範解答アップロードページ
 *
 * 機能:
 * - 試験の模範解答画像の管理
 * - ファイルアップロード（PDF・画像対応）
 * - 画像の削除・順序変更
 *
 * URL: /exams/[examId]/01-upload
 *
 * 段の題・「使い方」・「次へ」は `WorkflowTabHeader`（layout）が出す。
 *
 * @returns 模範解答アップロードページコンポーネント
 */
export default function MasterAnswerStepPage() {
  const params = useParams()
  const examId = typeof params.examId === "string" ? params.examId : ""

  // 読み込み中の表示だけがここの仕事。一覧そのものは MasterAnswerManager が同じキーで読む
  const { isPending: isLoading } = useQuery(examPagesQuery(examId))

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>模範解答を読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-hidden p-6">
        <MasterAnswerManager examId={examId} />
      </div>
    </div>
  )
}
