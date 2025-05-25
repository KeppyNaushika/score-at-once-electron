"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Prisma } from "@prisma/client"
import { toast } from "sonner" // sonnerのtoastを直接使用
import MasterImageManager from "@/components/Project/MasterImageManager" // このパスが正しいか確認

export default function MasterImageStepPage() {
  const params = useParams()
  const router = useRouter()
  const paramsProjectId = params.projectId
  const projectId =
    typeof paramsProjectId === "string" ? paramsProjectId : paramsProjectId?.[0]

  const [masterImages, setMasterImages] = useState<
    Prisma.MasterImageGetPayload<{}>[]
  >([])
  const [isLoading, setIsLoading] = useState(true)

  const loadMasterImages = useCallback(async () => {
    if (!projectId) return
    setIsLoading(true)
    try {
      // APIから試験情報を取得し、そこに含まれる模範解答画像を取得
      const project = await window.electronAPI.fetchProjectById(projectId)
      if (project && project.masterImages) {
        // pageNumber でソートしてセット
        const sortedImages = [...project.masterImages].sort(
          (a, b) => a.pageNumber - b.pageNumber,
        )
        setMasterImages(sortedImages)
      } else {
        setMasterImages([])
      }
    } catch (error) {
      console.error("Failed to load master images:", error)
      toast.error("模範解答画像の読み込みに失敗しました。")
      setMasterImages([]) // エラー時は空にする
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadMasterImages()
  }, [loadMasterImages])

  const handleImagesChange = useCallback(
    (updatedImages: Prisma.MasterImageGetPayload<{}>[]) => {
      // MasterImageManager内でAPI呼び出しと状態更新が行われるため、
      // ここでは基本的に何もしないか、追加のUIフィードバックを行う程度。
      // 必要であれば、このコールバックで再度 project を fetch して整合性を確認することも可能。
      // ただし、MasterImageManager が自身の変更を onMasterImagesChange で通知するなら、
      // その通知されたリストをそのまま使うのがシンプル。
      setMasterImages(updatedImages) // MasterImageManagerからの最新のリストで状態を更新
      toast("模範解答更新", {
        description: "模範解答リストが更新されました。",
      })
    },
    [],
  )

  const goToNextStep = async () => {
    // ここで現在のステップが完了したことを示すフラグをDBに保存するなどの処理を検討
    // 例: await window.electronAPI.updateExamStepProgress(projectId, 'master-image', 'completed');
    if (masterImages.length === 0) {
      toast("確認", {
        description: "模範解答が1枚も登録されていません。このまま進みますか？",
        action: {
          label: "はい",
          onClick: () => router.push(`/projects/${projectId}/score/template`), // パスを /projects/ に修正
        },
      })
      return
    }
    router.push(`/projects/${projectId}/score/template`) // パスを /projects/ に修正
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
    <div>
      <h2 className="mb-4 text-xl font-semibold">ステップ1: 模範解答の設定</h2>
      <MasterImageManager
        projectId={projectId}
        initialMasterImages={masterImages}
        onMasterImagesChange={handleImagesChange}
      />
      <div className="mt-6 flex justify-end">
        <Button onClick={goToNextStep} disabled={isLoading}>
          次へ: 採点テンプレート作成
        </Button>
      </div>
    </div>
  )
}
