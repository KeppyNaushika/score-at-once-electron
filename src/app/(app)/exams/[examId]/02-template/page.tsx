"use client"

import { useMutation } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useCallback, useState } from "react"

import CropRegionEditor from "@/components/exams/02-template/components/CropRegionEditor"
import { PageNavigation } from "@/components/exams/02-template/components/PageNavigation"
import { TemplateStatus } from "@/components/exams/02-template/components/TemplateStatus"
import { useTemplateData } from "@/components/exams/02-template/hooks/useTemplateData"
import type { RegionCoordinates } from "@/components/exams/02-template/types"
import { buildNewCropRegionLabel } from "@/components/exams/02-template/utils/templateActions"
import {
  createCropRegionMutation,
  updateCropRegionMutation,
} from "@/queries/cropRegion"
import type { CropRegionAreaType } from "@/types/cropRegionAreaType.types"

export default function TemplateStepPage() {
  const params = useParams()
  const examId = typeof params.examId === "string" ? params.examId : ""

  const [defaultPoints, setDefaultPoints] = useState(10)

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

  /** 掴み終えたときに1回だけ呼ばれる（途中の姿はキャンバスが持つ） */
  const handleUpdateRegion = useCallback(
    async (cropRegionId: string, coords: RegionCoordinates) => {
      await updateCropRegion.mutateAsync({ id: cropRegionId, data: coords })
    },
    [updateCropRegion]
  )

  if (isLoading || !examId) {
    return <TemplateStatus isLoading={isLoading} hasExamId={Boolean(examId)} />
  }

  return (
    <div className="flex h-full flex-col">
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
