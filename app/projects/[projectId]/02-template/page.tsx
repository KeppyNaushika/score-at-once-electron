"use client"

import { usePageHelp } from "@/components/help/usePageHelp"
import LayoutRegionEditor from "@/components/projects/02-template/LayoutRegionEditor"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

// Refactored imports
import { TemplateHeader } from "@/components/projects/02-template/components/template-header"
import { PageNavigation } from "@/components/projects/02-template/components/page-navigation"
import { TemplateStatus } from "@/components/projects/02-template/components/template-status"
import { useTemplateData } from "@/components/projects/02-template/hooks/use-template-data"
import { useRegionSave } from "@/components/projects/02-template/hooks/use-region-save"
import { saveTemplate, detectLayoutRegions, canProceedToNextStep } from "@/components/projects/02-template/utils/template-actions"
import { AreaType, RegionCoordinates } from "@/components/projects/02-template/types"
import { LayoutRegionArea } from "@/types/common.types"

export default function TemplateStepPage() {
  const params = useParams()
  const router = useRouter()
  const { helpButton } = usePageHelp()

  const paramsProjectId = params.projectId
  const projectId =
    typeof paramsProjectId === "string" ? paramsProjectId : paramsProjectId?.[0]

  // カスタムフックの使用
  const {
    initialData,
    isLoading,
    loadInitialData,
    handleMasterImageChange,
    updateLayoutRegions,
    updateLayoutId,
  } = useTemplateData(projectId)

  const {
    saveRegion,
    autoSaveRegions,
    createRegion,
    updateRegion,
  } = useRegionSave(projectId, initialData.currentUser)

  const [isSaving, setIsSaving] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)

  // 初期データの読み込み初期化
  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // 保存時のページ変更処理
  const handleMasterImageChangeWithSave = useCallback(async (imageId: string) => {
    // 現在の領域を保存
    if (initialData.layoutRegions.length > 0 && initialData.selectedMasterImage) {
      await autoSaveRegions(initialData.layoutRegions)
    }

    // 新しいページに変更
    await handleMasterImageChange(imageId)
  }, [initialData.layoutRegions, initialData.selectedMasterImage, autoSaveRegions, handleMasterImageChange])

  // 領域変更処理の効率化
  const handleRegionsChange = useCallback(
    async (newRegions: LayoutRegionArea[] | ((prev: LayoutRegionArea[]) => LayoutRegionArea[])) => {
      const finalRegions =
        typeof newRegions === "function"
          ? newRegions(initialData.layoutRegions)
          : newRegions

      // React状態を即座に更新
      updateLayoutRegions(finalRegions)

      // 互換性のためのautoSaveRegions
      await autoSaveRegions(finalRegions)
    },
    [initialData.layoutRegions, updateLayoutRegions, autoSaveRegions],
  )

  // 新規領域作成ハンドラー
  const handleCreateRegion = useCallback(
    async (type: AreaType, coords: RegionCoordinates) => {
      if (!initialData.selectedMasterImage) {
        console.warn("No master image selected for region creation")
        return
      }

      const newRegion = await createRegion(
        type, 
        coords, 
        initialData.selectedMasterImage.id, 
        initialData.layoutRegions
      )
      
      if (newRegion) {
        updateLayoutRegions([...initialData.layoutRegions, newRegion])
        updateLayoutId("saved")
      }
    },
    [initialData.selectedMasterImage, initialData.layoutRegions, createRegion, updateLayoutRegions, updateLayoutId],
  )

  // 領域更新ハンドラー
  const handleUpdateRegion = useCallback(
    async (index: number, coords: RegionCoordinates) => {
      const regionToUpdate = initialData.layoutRegions[index]
      if (!regionToUpdate) return

      // React状態を即座に更新
      const updatedRegions = [...initialData.layoutRegions]
      updatedRegions[index] = { ...regionToUpdate, ...coords }
      updateLayoutRegions(updatedRegions)

      // データベースに保存
      if (regionToUpdate.id) {
        const updatedRegion = await updateRegion(regionToUpdate, coords)
        if (!updatedRegion) {
          // エラー時は元の状態に戻す
          updateLayoutRegions(initialData.layoutRegions)
        }
      }
    },
    [initialData.layoutRegions, updateRegion, updateLayoutRegions],
  )

  // テンプレート保存処理
  const handleSaveTemplate = useCallback(async () => {
    if (!projectId || !initialData.currentUser || !initialData.selectedMasterImage) {
      return
    }

    setIsSaving(true)
    try {
      const result = await saveTemplate(
        projectId,
        initialData.currentUser,
        initialData.selectedMasterImage.id,
        initialData.layoutRegions
      )

      if (result.success && result.savedRegions) {
        updateLayoutRegions(result.savedRegions)
        updateLayoutId("saved")
      }
    } finally {
      setIsSaving(false)
    }
  }, [projectId, initialData.currentUser, initialData.selectedMasterImage, initialData.layoutRegions, updateLayoutRegions, updateLayoutId])

  // 自動検出処理
  const handleDetectLayoutRegions = useCallback(async () => {
    setIsDetecting(true)
    try {
      await detectLayoutRegions(initialData.selectedMasterImage)
    } finally {
      setIsDetecting(false)
    }
  }, [initialData.selectedMasterImage])

  // 次のステップへの遷移
  const goToNextStep = useCallback(() => {
    if (canProceedToNextStep(initialData.layoutId)) {
      router.push(`/projects/${projectId}/03-region-info`)
    }
  }, [initialData.layoutId, projectId, router])

  // 前のステップへの遷移
  const goToPreviousStep = useCallback(() => {
    router.push(`/projects/${projectId}/01-upload`)
  }, [projectId, router])

  // ローディング・エラー状態の表示
  if (isLoading || !projectId) {
    return (
      <TemplateStatus 
        isLoading={isLoading} 
        hasProjectId={!!projectId} 
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* ヘッダー */}
      <TemplateHeader
        helpButton={helpButton}
        projectId={projectId}
        selectedMasterImage={initialData.selectedMasterImage}
        layoutRegions={initialData.layoutRegions}
        onNextStep={goToNextStep}
      />

      {/* メインコンテンツ */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* ページナビゲーション */}
        <PageNavigation
          masterImages={initialData.masterImages}
          selectedMasterImage={initialData.selectedMasterImage}
          onImageChange={handleMasterImageChangeWithSave}
          isLoading={isLoading}
          isSaving={isSaving}
        />

        {/* レイアウトエディター */}
        <div className="min-h-0 flex-1">
          <LayoutRegionEditor
            areas={initialData.layoutRegions}
            setAreas={handleRegionsChange}
            onCreateRegion={handleCreateRegion}
            onUpdateRegion={handleUpdateRegion}
            disabled={isSaving}
            backgroundImageUrl={initialData.backgroundImageUrl}
            imageDimensions={initialData.imageDimensions}
            masterImageId={initialData.selectedMasterImage?.id || null}
          />
        </div>
      </div>
    </div>
  )
}