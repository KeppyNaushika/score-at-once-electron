"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { MasterAnswerManager } from "@/components/exams/01-upload/components/MasterAnswerManager"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { examPagesQuery } from "@/queries/exam"

/**
 * MasterImageStepPage - 模範解答アップロードページ
 *
 * 機能:
 * - 試験の模範解答画像の管理
 * - ファイルアップロード（PDF・画像対応）
 * - 画像の削除・順序変更
 * - 次ステップへの遷移
 *
 * URL: /exams/[examId]/01-upload
 *
 * @returns 模範解答アップロードページコンポーネント
 */
export default function MasterAnswerStepPage() {
  const params = useParams()
  const router = useRouter()
  const { helpButton } = usePageHelp()
  const examId = typeof params.examId === "string" ? params.examId : ""

  // 「次へ」の可否だけが要る。一覧そのものは MasterAnswerManager が同じキーで読む
  const { data: masterAnswers = [], isPending: isLoading } = useQuery(
    examPagesQuery(examId)
  )

  /**
   * 次のステップへ遷移する
   *
   * 模範解答が登録されているかチェックし、
   * 問題がなければ採点領域作成ページへ遷移します。
   * 画像がない場合は確認ダイアログを表示します。
   */
  const goToNextStep = () => {
    if (masterAnswers.length === 0) {
      toast("確認", {
        description: "模範解答が1枚も登録されていません。このまま進みますか？",
        action: {
          label: "はい",
          onClick: () => router.push(`/exams/${examId}/02-template`),
        },
      })
      return
    }
    // 次のステップは採点領域設定ページ
    router.push(`/exams/${examId}/02-template`)
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>模範解答を読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="模範解答画像の管理" helpButton={helpButton}>
        {masterAnswers.length > 0 && (
          <Button onClick={goToNextStep}>次へ: 答案の採点領域作成</Button>
        )}
      </PageHeader>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-6">
        <MasterAnswerManager examId={examId} />
      </div>
    </div>
  )
}
