"use client"

import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import CropRegionEditor from "@/components/projects/02-template/components/CropRegionEditor"
import { Button } from "@/components/ui/button"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect } from "react"

// Refactored imports
import { AreaType, RegionCoordinates } from "@/components/projects/02-template/types"
import { canProceedToNextStep } from "@/components/projects/02-template/utils/template-actions"
import { PageNavigation } from "@/components/projects/02-template/components/PageNavigation"
import { TemplateStatus } from "@/components/projects/02-template/components/TemplateStatus"
import { useCropRegionSave } from "@/components/projects/02-template/hooks/useCropRegionSave"
import { useTemplateData } from "@/components/projects/02-template/hooks/useTemplateData"
import { CropRegionArea } from "@/types/common.types"

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
    updateCropRegions,
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
        initialData.cropRegions.length > 0 &&
        initialData.selectedMasterImage
      ) {
        await autoSaveRegions(initialData.cropRegions)
      }

      // 新しいページに変更
      await handleMasterImageChange(imageId)
    },
    [
      initialData.cropRegions,
      initialData.selectedMasterImage,
      autoSaveRegions,
      handleMasterImageChange,
    ],
  )

  // 領域変更処理の効率化
  const handleRegionsChange = useCallback(
    async (
      newRegions:
        | CropRegionArea[]
        | ((prev: CropRegionArea[]) => CropRegionArea[]),
    ) => {
      const finalRegions =
        typeof newRegions === "function"
          ? newRegions(initialData.cropRegions)
          : newRegions

      // React状態を即座に更新
      updateCropRegions(finalRegions)

      // 互換性のためのautoSaveRegions
      await autoSaveRegions(finalRegions)
    },
    [initialData.cropRegions, updateCropRegions, autoSaveRegions],
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
        initialData.cropRegions,
      )

      if (newRegion) {
        updateCropRegions([...initialData.cropRegions, newRegion])
        updateLayoutId("saved")
      }
    },
    [
      initialData.selectedMasterImage,
      initialData.cropRegions,
      createRegion,
      updateCropRegions,
      updateLayoutId,
    ],
  )

  // 領域更新ハンドラー
  const handleUpdateRegion = useCallback(
    async (index: number, coords: RegionCoordinates) => {
      const regionToUpdate = initialData.cropRegions[index]
      if (!regionToUpdate) return

      // React状態を即座に更新
      const updatedRegions = [...initialData.cropRegions]
      updatedRegions[index] = { ...regionToUpdate, ...coords }
      updateCropRegions(updatedRegions)

      // データベースに保存
      if (regionToUpdate.id) {
        const updatedRegion = await updateRegion(regionToUpdate, coords)
        if (!updatedRegion) {
          // エラー時は元の状態に戻す
          updateCropRegions(initialData.cropRegions)
        }
      }
    },
    [initialData.cropRegions, updateRegion, updateCropRegions],
  )

  // 次のステップへの遷移
  const goToNextStep = useCallback(() => {
    if (canProceedToNextStep(initialData.layoutId)) {
      router.push(`/projects/${projectId}/03-region-info`)
    }
  }, [initialData.layoutId, projectId, router])

  // 現在選択中の画像に対応する領域があるかチェック
  const hasRegionsForCurrentImage =
    initialData.selectedMasterImage &&
    initialData.cropRegions.filter((r) => r.projectPageId === initialData.selectedMasterImage?.id)
      .length > 0

  // ローディング・エラー状態の表示
  if (isLoading || !projectId) {
    return <TemplateStatus isLoading={isLoading} hasProjectId={!!projectId} />
  }

  return (
    <div className="flex h-full flex-col">
      {/* ヘッダー */}
      <PageHeader
        title="答案の採点領域作成"
        helpButton={helpButton}
      >
        {hasRegionsForCurrentImage && (
          <Button onClick={goToNextStep}>次へ: 3. 領域情報</Button>
        )}
      </PageHeader>

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
          <CropRegionEditor
            areas={initialData.cropRegions}
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
