"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Prisma } from "@prisma/client"
import { toast } from "sonner" // sonnerのtoastを直接使用
import MasterImageManager from "@/components/Project/MasterImageManager"
import PageHeader from "@/components/common/PageHeader"

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
  const [project, setProject] = useState<any>(null)

  const loadMasterImages = useCallback(async () => {
    if (!projectId) return
    setIsLoading(true)
    try {
      const fetchedProject = await window.electronAPI.fetchProjectById(projectId) // ProjectWithDetails 型
      if (fetchedProject && fetchedProject.masterImages) {
        setProject(fetchedProject)
        // pageNumber でソートしてセット
        const sortedImages = [...fetchedProject.masterImages].sort(
          (a, b) => a.pageNumber - b.pageNumber,
        )
        setMasterImages(sortedImages)
      } else {
        setProject(fetchedProject)
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
    if (!projectId) return
    const project = await window.electronAPI.fetchProjectById(projectId) // 最新のプロジェクト情報を取得

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
    // 次のステップは採点領域設定ページ
    router.push(`/projects/${projectId}/score/template`)
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
      <PageHeader
        title="模範解答の設定"
        description="PDFまたは画像ファイルをアップロードして模範解答を設定します"
        projectName={project?.examName}
      >
        {masterImages.length > 0 && (
          <Button onClick={goToNextStep} disabled={isLoading}>
            次へ: 採点領域作成
          </Button>
        )}
      </PageHeader>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-6">
        <MasterImageManager
          projectId={projectId}
          initialMasterImages={masterImages}
          onMasterImagesChange={handleImagesChange}
        />
      </div>
    </div>
  )
}
