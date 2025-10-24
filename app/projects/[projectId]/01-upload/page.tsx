"use client"

import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { MasterAnswerManager } from "@/components/projects/01-upload/components/MasterAnswerManager"
import { convertProjectPagesToMasterAnswers } from "@/components/projects/01-upload/utils/image-utils"
import { Button } from "@/components/ui/button"
import type { MasterAnswerData } from "@/types/common.types"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

/**
 * MasterImageStepPage - 模範解答アップロードページ
 *
 * 機能:
 * - プロジェクトの模範解答画像の管理
 * - ファイルアップロード（PDF・画像対応）
 * - 画像の削除・順序変更
 * - 次ステップへの遷移
 *
 * URL: /projects/[projectId]/01-upload
 *
 * @returns 模範解答アップロードページコンポーネント
 */
export default function MasterAnswerStepPage() {
  const params = useParams()
  const router = useRouter()
  const { helpButton } = usePageHelp()
  const paramsProjectId = params.projectId
  const projectId =
    typeof paramsProjectId === "string" ? paramsProjectId : paramsProjectId?.[0]

  const [masterAnswers, setMasterAnswers] = useState<MasterAnswerData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  /**
   * 模範解答画像データを読み込む
   *
   * プロジェクトIDから模範解答画像のリストを取得し、
   * ページ番号順にソートして状態を更新します。
   */
  const loadMasterAnswers = useCallback(async () => {
    if (!projectId) return
    setIsLoading(true)
    try {
      const fetchedProject =
        await window.electronAPI.fetchProjectById(projectId) // ProjectWithDetails 型
      if (fetchedProject && fetchedProject.projectPages) {
        // projectPages から master answers を抽出してソート
        const masterAnswers = convertProjectPagesToMasterAnswers(
          fetchedProject.projectPages,
        ).sort((a, b) => a.pageNumber - b.pageNumber)
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
  }, [projectId])

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
  const handleAnswersChange = useCallback(
    (updatedAnswers: MasterAnswerData[]) => {
      // MasterImageManager内でAPI呼び出しと状態更新が行われるため、
      // ここでは基本的に何もしないか、追加のUIフィードバックを行う程度。
      // 必要であれば、このコールバックで再度 project を fetch して整合性を確認することも可能。
      // ただし、MasterImageManager が自身の変更を onMasterImagesChange で通知するなら、
      // その通知されたリストをそのまま使うのがシンプル。
      setMasterAnswers(updatedAnswers) // MasterAnswerManagerからの最新のリストで状態を更新
      toast("模範解答更新", {
        description: "模範解答リストが更新されました。",
      })
    },
    [],
  )

  /**
   * 次のステップへ遷移する
   *
   * 模範解答が登録されているかチェックし、
   * 問題がなければ採点領域作成ページへ遷移します。
   * 画像がない場合は確認ダイアログを表示します。
   */
  const goToNextStep = async () => {
    if (!projectId) return

    if (masterAnswers.length === 0) {
      toast("確認", {
        description: "模範解答が1枚も登録されていません。このまま進みますか？",
        action: {
          label: "はい",
          onClick: () => router.push(`/projects/${projectId}/02-template`), // パスを新しい構造に修正
        },
      })
      return
    }
    // 次のステップは採点領域設定ページ
    router.push(`/projects/${projectId}/02-template`)
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>模範解答を読み込み中...</p>
      </div>
    )
  }

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>プロジェクトが見つかりません。</p>
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
          projectId={projectId}
          initialMasterAnswers={masterAnswers}
          onMasterAnswersChange={handleAnswersChange}
        />
      </div>
    </div>
  )
}
