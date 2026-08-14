"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useState } from "react"

import CropRegionEditor from "@/components/exams/02-template/components/CropRegionEditor"
import { PageNavigation } from "@/components/exams/02-template/components/PageNavigation"
import { TemplateStatus } from "@/components/exams/02-template/components/TemplateStatus"
import { useTemplateData } from "@/components/exams/02-template/hooks/useTemplateData"
import type { RegionCoordinates } from "@/components/exams/02-template/types"
import { buildNewCropRegionLabel } from "@/components/exams/02-template/utils/templateActions"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import {
  createCropRegionMutation,
  cropRegionsQuery,
  updateCropRegionMutation,
} from "@/queries/cropRegion"
import type { CropRegionAreaType } from "@/types/cropRegionAreaType.types"

export default function TemplateStepPage() {
  const params = useParams()
  const router = useRouter()
  const { helpButton } = usePageHelp()
  const examId = typeof params.examId === "string" ? params.examId : ""

  const [defaultPoints, setDefaultPoints] = useState(10)

  const queryClient = useQueryClient()
  const {
    isLoading,
    masterImages,
    selectedMasterImage,
    backgroundImageUrl,
    imageDimensions,
    areas,
    selectMasterImage,
  } = useTemplateData(examId)

  const createCropRegion = useMutation(createCropRegionMutation(examId))
  const updateCropRegion = useMutation(updateCropRegionMutation(examId))

  // 新規領域作成ハンドラー
  const handleCreateRegion = useCallback(
    async (type: CropRegionAreaType, coords: RegionCoordinates) => {
      if (!selectedMasterImage) return

      await createCropRegion.mutateAsync({
        examPageId: selectedMasterImage.id,
        type,
        x: coords.x,
        y: coords.y,
        width: coords.width,
        height: coords.height,
        label: buildNewCropRegionLabel(type, areas),
        points: type === "QUESTION_ANSWER" ? defaultPoints : null,
      })
    },
    [areas, createCropRegion, defaultPoints, selectedMasterImage]
  )

  /**
   * ドラッグ中の座標を書き込む。
   *
   * 先にキャッシュを差し替えないと、取り直しが終わるまで枠が元の位置へ戻る。
   * 掴んでいる間ずっと呼ばれるので、取り直しは `scope` でまとめられる。
   */
  const handleUpdateRegion = useCallback(
    async (index: number, coords: RegionCoordinates) => {
      const area = areas[index]
      if (!area?.id) return
      const cropRegionId = area.id

      queryClient.setQueryData(cropRegionsQuery(examId).queryKey, (cached) =>
        cached?.map((cropRegion) =>
          cropRegion.id === cropRegionId
            ? { ...cropRegion, ...coords }
            : cropRegion
        )
      )
      await updateCropRegion.mutateAsync({ id: cropRegionId, data: coords })
    },
    [areas, examId, queryClient, updateCropRegion]
  )

  const goToNextStep = useCallback(() => {
    router.push(`/exams/${examId}/03-region-info`)
  }, [examId, router])

  // 現在選択中の画像に領域があるときだけ次へ進める
  const hasRegionsForCurrentImage = areas.length > 0

  if (isLoading || !examId) {
    return <TemplateStatus isLoading={isLoading} hasExamId={Boolean(examId)} />
  }

  return (
    <div className="flex h-full flex-col">
      {/* ヘッダー */}
      <PageHeader title="答案の採点領域作成" helpButton={helpButton}>
        {hasRegionsForCurrentImage && (
          <Button onClick={goToNextStep}>次へ: 採点領域の詳細情報設定</Button>
        )}
      </PageHeader>

      {/* メインコンテンツ */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* ページナビゲーション */}
        <PageNavigation
          masterImages={masterImages}
          selectedMasterImage={selectedMasterImage}
          onImageChange={selectMasterImage}
          isLoading={isLoading}
          isSaving={false}
        />

        {/* レイアウトエディター */}
        <div className="min-h-0 flex-1">
          <CropRegionEditor
            examId={examId}
            areas={areas}
            onCreateRegion={handleCreateRegion}
            onUpdateRegion={handleUpdateRegion}
            disabled={false}
            backgroundImageUrl={backgroundImageUrl}
            imageDimensions={imageDimensions}
            examPageId={selectedMasterImage?.id ?? null}
            defaultPoints={defaultPoints}
            onDefaultPointsChange={setDefaultPoints}
          />
        </div>
      </div>
    </div>
  )
}
