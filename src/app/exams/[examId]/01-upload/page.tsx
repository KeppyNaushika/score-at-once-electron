"use client"

import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { MasterAnswerManager } from "@/components/exams/01-upload/components/MasterAnswerManager"
import type { MasterAnswer } from "@/components/exams/01-upload/types"
import { convertExamPagesToMasterAnswers } from "@/components/exams/01-upload/utils/imageUtils"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"

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

  const [masterAnswers, setMasterAnswers] = useState<MasterAnswer[]>([])
  const [isLoading, setIsLoading] = useState(true)

  /**
   * 模範解答画像データを読み込む
   *
   * 試験IDから模範解答画像のリストを取得し、
   * ページ番号順にソートして状態を更新します。
   */
  const loadMasterAnswers = useCallback(async () => {
    if (!examId) return
    setIsLoading(true)
    try {
      // masterImages を含む examPages のみ必要な軽量クエリ
      const fetchedPages = await window.electronAPI.getExamPagesByExamId(examId)
      if (fetchedPages && fetchedPages.length > 0) {
        // examPages から master answers を抽出してソート
        const masterAnswers = convertExamPagesToMasterAnswers(
          fetchedPages
        ).sort((pageA, pageB) => pageA.pageNumber - pageB.pageNumber)
        setMasterAnswers(masterAnswers)
      } else {
        setMasterAnswers([])
      }
    } catch (error) {
      console.error("Failed to load master answers:", error)
      toast.error("模範解答画像の読み込みに失敗しました。")
      setMasterAnswers([]) // エラー時は空にする
    } finally {
      setIsLoading(false)
    }
  }, [examId])

  useEffect(() => {
    loadMasterAnswers()
  }, [loadMasterAnswers])

  /**
   * 画像データ変更時のハンドラー
   *
   * MasterImageManagerからの画像データ更新を受け取り、
   * 状態を更新してユーザーに通知します。
   *
   * @param updatedImages - 更新された画像データリスト
   */
  const handleAnswersChange = useCallback((updatedAnswers: MasterAnswer[]) => {
    // MasterImageManager内でAPI呼び出しと状態更新が行われるため、
    // ここでは基本的に何もしないか、追加のUIフィードバックを行う程度。
    // 必要であれば、このコールバックで再度 exam を fetch して整合性を確認することも可能。
    // ただし、MasterImageManager が自身の変更を onMasterImagesChange で通知するなら、
    // その通知されたリストをそのまま使うのがシンプル。
    setMasterAnswers(updatedAnswers) // MasterAnswerManagerからの最新のリストで状態を更新
    toast("模範解答更新", {
      description: "模範解答リストが更新されました。",
    })
  }, [])

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
