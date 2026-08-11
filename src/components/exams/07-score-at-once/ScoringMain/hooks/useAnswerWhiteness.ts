/**
 * @fileoverview 答案の白さ（空欄らしさ）算出フック
 * @description 一覧表示を開いた時点で、そのページの全答案×全採点領域の白さを先読みする。
 */

import { useEffect, useRef, useState } from "react"

import type {
  CropRegionWithExamPage,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"
import type {
  RegionWhiteness,
  WhitenessTargetRegion,
} from "@/types/answerWhiteness.types"

/** studentAnswerImage.id → cropRegion.id → 白さ */
export type WhitenessByAnswerId = Map<string, Map<string, RegionWhiteness>>

interface UseAnswerWhitenessProps {
  studentAnswerImages: StudentAnswerImageWithExamStudents[]
  cropRegions: CropRegionWithExamPage[]
  /** 一覧に表示しているページ */
  currentExamPageId: string | null
  /** 一覧表示中のみ算出する */
  enabled: boolean
}

/** 算出済みか判定するための、対象ページの答案画像の顔ぶれ */
function buildMeasurementSignature(
  answerImages: StudentAnswerImageWithExamStudents[]
): string {
  return answerImages
    .map((answerImage) => `${answerImage.id}:${answerImage.imagePath ?? ""}`)
    .sort()
    .join("|")
}

/**
 * 一覧表示中のページについて、答案ごとの採点領域の白さを算出して保持するフック。
 *
 * 算出はページ単位で1回だけ行い、そのページの全採点領域分をまとめて得る。設問を
 * 切り替えても再算出は発生しない（画像1枚のデコードコストに対し、領域を増やす
 * コストは無視できるため。詳細は electron-src/lib/scoring/regionWhiteness.ts）。
 */
export function useAnswerWhiteness({
  studentAnswerImages,
  cropRegions,
  currentExamPageId,
  enabled,
}: UseAnswerWhitenessProps) {
  const [whitenessByAnswerId, setWhitenessByAnswerId] =
    useState<WhitenessByAnswerId>(new Map())
  const [measuredExamPageIds, setMeasuredExamPageIds] = useState<Set<string>>(
    new Set()
  )

  /** ページごとの算出済みシグネチャ（答案が増減したら再算出する） */
  const measuredSignatureRef = useRef<Map<string, string>>(new Map())
  /** 算出中にページが切り替わった場合に古い結果を捨てるためのトークン */
  const measurementTokenRef = useRef(0)

  const pageAnswerImages = currentExamPageId
    ? studentAnswerImages.filter(
        (answerImage) =>
          answerImage.examPageId === currentExamPageId && answerImage.imagePath
      )
    : []
  const signature = buildMeasurementSignature(pageAnswerImages)

  // 毎レンダーで新しい配列になるため、effectの依存には入れずrefで最新値を渡す。
  // 再算出の要否はsignature（答案の顔ぶれ）で判定する。
  const pageAnswerImagesRef = useRef(pageAnswerImages)
  const cropRegionsRef = useRef(cropRegions)
  useEffect(() => {
    pageAnswerImagesRef.current = pageAnswerImages
    cropRegionsRef.current = cropRegions
  })

  useEffect(() => {
    if (!enabled) return
    if (!currentExamPageId) return

    const pageAnswerImages = pageAnswerImagesRef.current
    if (pageAnswerImages.length === 0) return
    if (measuredSignatureRef.current.get(currentExamPageId) === signature)
      return

    const pageRegions: WhitenessTargetRegion[] = cropRegionsRef.current
      .filter((cropRegion) => cropRegion.examPageId === currentExamPageId)
      .map((cropRegion) => ({
        cropRegionId: cropRegion.id,
        x: cropRegion.x,
        y: cropRegion.y,
        width: cropRegion.width,
        height: cropRegion.height,
      }))

    if (pageRegions.length === 0) return

    const examPageId = currentExamPageId
    measuredSignatureRef.current.set(examPageId, signature)
    measurementTokenRef.current += 1
    const token = measurementTokenRef.current

    const measure = async () => {
      try {
        const result = await window.electronAPI.measureAnswerWhiteness({
          answerImages: pageAnswerImages.map((answerImage) => ({
            studentAnswerImageId: answerImage.id,
            imagePath: answerImage.imagePath ?? "",
          })),
          regions: pageRegions,
        })

        // 算出中に別ページへ移った場合は破棄する
        if (token !== measurementTokenRef.current) return

        const answers = result.answers
        setWhitenessByAnswerId((prev) => {
          const next = new Map(prev)
          for (const answer of answers) {
            next.set(
              answer.studentAnswerImageId,
              new Map(
                answer.regions.map((region) => [region.cropRegionId, region])
              )
            )
          }
          return next
        })
        setMeasuredExamPageIds((prev) => new Set(prev).add(examPageId))
      } catch (error) {
        measuredSignatureRef.current.delete(examPageId)
        console.error("答案の白さ算出に失敗しました:", error)
      }
    }

    measure()
  }, [enabled, currentExamPageId, signature])

  return {
    whitenessByAnswerId,
    /** 表示中のページの白さが揃っているか（並び順の選択可否に使う） */
    isWhitenessReady: currentExamPageId
      ? measuredExamPageIds.has(currentExamPageId)
      : false,
  }
}
