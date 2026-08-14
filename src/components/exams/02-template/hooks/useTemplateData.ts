import { useQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useState } from "react"

import type {
  CropRegionArea,
  ImageDimensions,
} from "@/components/exams/02-template/types"
import { cropRegionsQuery } from "@/queries/cropRegion"
import { examPagesQuery } from "@/queries/exam"
import { fileProtocolPathQuery } from "@/queries/misc"
import { toCropRegionAreaType } from "@/types/cropRegionAreaType.types"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_AREAS: CropRegionArea[] = []

/**
 * 画像の寸法は、その URL を実際に読み込むまで分からない。
 * DOM の Image に読ませるので取得（`useQuery`）ではなく effect で扱う。
 */
function useImageDimensions(imageUrl: string | null) {
  // どの URL を測った結果かを一緒に持つ。読み込みが終わるまでの間、前の画像の
  // 寸法を返さないようにするため（state を effect の中で同期に消さずに済む）
  const [measured, setMeasured] = useState<{
    imageUrl: string
    dimensions: ImageDimensions
  } | null>(null)

  useEffect(() => {
    if (!imageUrl) return
    let alive = true
    const image = new Image()
    image.onload = () => {
      if (!alive) return
      setMeasured({
        imageUrl,
        dimensions: { width: image.naturalWidth, height: image.naturalHeight },
      })
    }
    image.src = imageUrl
    return () => {
      alive = false
    }
  }, [imageUrl])

  return measured?.imageUrl === imageUrl ? measured.dimensions : null
}

/**
 * 採点領域エディタが読むデータ。
 *
 * 模範解答ページ・採点領域はどちらも DB のもので、写しは持たない。選んでいる
 * ページ（`selectedExamPageId`）だけが画面の状態である。
 */
export function useTemplateData(examId: string) {
  const [selectedExamPageId, setSelectedExamPageId] = useState<string | null>(
    null
  )

  const { data: examPages, isPending: examPagesPending } = useQuery(
    examPagesQuery(examId)
  )
  const { data: cropRegions, isPending: cropRegionsPending } = useQuery(
    cropRegionsQuery(examId)
  )

  // 模範解答画像を持つページだけを対象にする（画像の無いページには領域を引けない）
  const masterImages = useMemo(
    () =>
      (examPages ?? [])
        .filter((examPage) => examPage.imagePath)
        .sort((pageA, pageB) => pageA.pageNumber - pageB.pageNumber),
    [examPages]
  )

  // 全ページが模範解答なし（旧バージョンで消されたまま移行した試験）なら選べる
  // 背景が無い。[0] を素通しすると undefined 参照で画面ごと落ちる
  const selectedMasterImage =
    masterImages.find((examPage) => examPage.id === selectedExamPageId) ??
    masterImages[0] ??
    null

  const { data: backgroundImageUrl = null } = useQuery({
    ...fileProtocolPathQuery(selectedMasterImage?.imagePath ?? ""),
    enabled: Boolean(selectedMasterImage?.imagePath),
  })
  const imageDimensions = useImageDimensions(backgroundImageUrl)

  // 選んでいるページの領域だけをエディタへ渡す
  const areas = useMemo(() => {
    if (!selectedMasterImage) return EMPTY_AREAS
    return (cropRegions ?? [])
      .filter((cropRegion) => cropRegion.examPageId === selectedMasterImage.id)
      .map((cropRegion) => ({
        id: cropRegion.id,
        type: toCropRegionAreaType(cropRegion.type),
        x: cropRegion.x,
        y: cropRegion.y,
        width: cropRegion.width,
        height: cropRegion.height,
        label: cropRegion.label || "",
        points: cropRegion.points,
        orderIndex: cropRegion.orderIndex,
        examPageId: cropRegion.examPageId,
      }))
  }, [cropRegions, selectedMasterImage])

  const selectMasterImage = useCallback((examPageId: string) => {
    setSelectedExamPageId(examPageId)
  }, [])

  return {
    isLoading: examPagesPending || cropRegionsPending,
    masterImages,
    selectedMasterImage,
    backgroundImageUrl,
    imageDimensions,
    areas,
    selectMasterImage,
  }
}
