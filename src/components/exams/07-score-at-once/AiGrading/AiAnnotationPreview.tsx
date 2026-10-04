"use client"

import CroppedAnswerImage from "@/components/exams/07-score-at-once/ScoringMain/CroppedAnswerImage"
import {
  type AnnotationPlacement,
  LINE_PITCH_RATIO,
} from "@/lib/shared/aiGrading/annotationPlacement"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

interface AiAnnotationPreviewProps {
  imageUrl: string
  alt: string
  cropRegion: QuestionAnswerRegionRow
  /** 採用したときの注釈の置き場所。注釈が無ければ null */
  placement: AnnotationPlacement | null
  /** 用紙の幅（mm。文字の大きさを枠に対する割合へ直す） */
  paperWidthMm: number
}

/**
 * 答案の拡大と、採用したときに書く朱書きの見本（設計 §8）。
 *
 * 枠の切り出しの上に、置き場所（用紙比）を枠に対する割合へ直した赤い文字を重ねる。
 * 文字の大きさは枠の幅に対する割合（`cqw`）で決めるので、表示の大きさに追随する
 */
export function AiAnnotationPreview({
  imageUrl,
  alt,
  cropRegion,
  placement,
  paperWidthMm,
}: AiAnnotationPreviewProps) {
  const fontSizePercentOfWidth = placement
    ? (placement.fontSize / paperWidthMm / cropRegion.width) * 100
    : 0
  return (
    <div className="relative w-full" style={{ containerType: "inline-size" }}>
      <CroppedAnswerImage
        imageUrl={imageUrl}
        cropRegion={cropRegion}
        alt={alt}
      />
      {placement && (
        <div
          data-testid="ai-annotation-preview"
          className={`pointer-events-none absolute border border-dashed whitespace-pre text-red-500 ${
            placement.overlapsInk ? "border-amber-500" : "border-red-300"
          }`}
          style={{
            left: `${((placement.x - cropRegion.x) / cropRegion.width) * 100}%`,
            top: `${((placement.y - cropRegion.y) / cropRegion.height) * 100}%`,
            fontSize: `${fontSizePercentOfWidth}cqw`,
            lineHeight: LINE_PITCH_RATIO,
          }}
        >
          {placement.text}
        </div>
      )}
    </div>
  )
}
