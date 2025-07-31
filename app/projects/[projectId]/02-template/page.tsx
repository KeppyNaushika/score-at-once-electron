"use client"

import { usePageHelp } from "@/components/help/usePageHelp"
import { LayoutRegionEditor } from "@/components/projects/02-template"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect } from "react"

// Refactored imports
import {
  AreaType,
  canProceedToNextStep,
  PageNavigation,
  RegionCoordinates,
  TemplateHeader,
  TemplateStatus,
  useCropRegionSave,
  useTemplateData,
} from "@/components/projects/02-template"
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

  const { autoSaveRegions, createRegion, updateRegion } = useCropRegionSave(
    projectId,
    initialData.currentUser,
  )

  // 初期データの読み込み初期化
  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // 保存時のページ変更処理
  const handleMasterImageChangeWithSave = useCallback(
    async (imageId: string) => {
      // 現在の領域を保存
      if (
        initialData.layoutRegions.length > 0 &&
        initialData.selectedMasterImage
      ) {
        await autoSaveRegions(initialData.layoutRegions)
      }

      // 新しいページに変更
      await handleMasterImageChange(imageId)
    },
    [
      initialData.layoutRegions,
      initialData.selectedMasterImage,
      autoSaveRegions,
      handleMasterImageChange,
    ],
  )

  // 領域変更処理の効率化
  const handleRegionsChange = useCallback(
    async (
      newRegions:
        | LayoutRegionArea[]
        | ((prev: LayoutRegionArea[]) => LayoutRegionArea[]),
    ) => {
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
        initialData.layoutRegions,
      )

      if (newRegion) {
        updateLayoutRegions([...initialData.layoutRegions, newRegion])
        updateLayoutId("saved")
      }
    },
    [
      initialData.selectedMasterImage,
      initialData.layoutRegions,
      createRegion,
      updateLayoutRegions,
      updateLayoutId,
    ],
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

  // 次のステップへの遷移
  const goToNextStep = useCallback(() => {
    if (canProceedToNextStep(initialData.layoutId)) {
      router.push(`/projects/${projectId}/03-region-info`)
    }
  }, [initialData.layoutId, projectId, router])

  // ローディング・エラー状態の表示
  if (isLoading || !projectId) {
    return <TemplateStatus isLoading={isLoading} hasProjectId={!!projectId} />
  }

  return (
    <div className="flex h-full flex-col">
      {/* ヘッダー */}
      <TemplateHeader
        helpButton={helpButton}
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
          isSaving={false}
        />

        {/* レイアウトエディター */}
        <div className="min-h-0 flex-1">
          <LayoutRegionEditor
            areas={initialData.layoutRegions}
            setAreas={handleRegionsChange}
            onCreateRegion={handleCreateRegion}
            onUpdateRegion={handleUpdateRegion}
            disabled={false}
            backgroundImageUrl={initialData.backgroundImageUrl}
            imageDimensions={initialData.imageDimensions}
            projectPageId={initialData.selectedMasterImage?.id || null}
          />
        </div>
      </div>
    </div>
  )
}
