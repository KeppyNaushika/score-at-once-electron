"use client"

import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { useCallback } from "react"
import { toast } from "sonner"

import { MasterAnswerManager } from "@/components/exams/01-upload/components/MasterAnswerManager"
import { sortImagesByPageNumber } from "@/components/exams/01-upload/utils/imageUtils"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import type { ExamPageWithContent } from "@/electron-src/lib/prisma/examPage"
import { queryKeys } from "@/lib/queryKeys"

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
  const paramsExamId = params.examId
  const examId =
    typeof paramsExamId === "string" ? paramsExamId : paramsExamId?.[0]

  const queryClient = useQueryClient()
  const queryKey = queryKeys.exam.masterAnswers(examId ?? "")
  // 模範解答ページはページそのもの。答案の件数も削除確認で使うので一緒に持つ
  const { data: masterAnswers = [], isPending: isLoading } = useQuery({
    queryKey,
    queryFn: examId
      ? async () =>
          sortImagesByPageNumber(
            await window.electronAPI.getExamPagesByExamId(examId)
          )
      : skipToken,
  })

  /**
   * 画像データ変更時のハンドラー
   *
   * MasterImageManagerからの画像データ更新を受け取り、
   * 状態を更新してユーザーに通知します。
   *
   * @param updatedImages - 更新された画像データリスト
   */
  const handleAnswersChange = useCallback(
    (updatedAnswers: ExamPageWithContent[]) => {
      // 追加・差し替え・削除の結果は MasterAnswerManager 側で DB を引き直して渡ってくる。
      // 引き直した結果をそのままキャッシュへ入れる（もう一度取りに行かない）
      queryClient.setQueryData(queryKey, updatedAnswers)
    },
    [queryClient, queryKey]
  )

  /**
   * 次のステップへ遷移する
   *
   * 模範解答が登録されているかチェックし、
   * 問題がなければ採点領域作成ページへ遷移します。
   * 画像がない場合は確認ダイアログを表示します。
   */
  const goToNextStep = async () => {
    if (!examId) return

    if (masterAnswers.length === 0) {
      toast("確認", {
        description: "模範解答が1枚も登録されていません。このまま進みますか？",
        action: {
          label: "はい",
          onClick: () => router.push(`/exams/${examId}/02-template`), // パスを新しい構造に修正
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

  if (!examId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>試験が見つかりません。</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="模範解答画像の管理" helpButton={helpButton}>
        {masterAnswers.length > 0 && (
          <Button onClick={goToNextStep} disabled={isLoading}>
            次へ: 答案の採点領域作成
          </Button>
        )}
      </PageHeader>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-6">
        <MasterAnswerManager
          examId={examId}
          initialMasterAnswers={masterAnswers}
          onMasterAnswersChange={handleAnswersChange}
        />
      </div>
    </div>
  )
}
