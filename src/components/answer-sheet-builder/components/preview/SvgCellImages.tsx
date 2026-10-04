"use client"

import type { RenderMode } from "@/types/answerSheetDefinition.types"
import type { ComputedCell } from "@/types/answerSheetLayout.types"

interface SvgCellImagesProps {
  cells: ComputedCell[]
  renderMode: RenderMode
  /** 印刷用モード: appimg→data URI 変換 */
  forPrint?: boolean
  /** 印刷用: 画像パス → data URI のマップ */
  imageDataUris?: Map<string, string>
}

/** セル内の画像要素を描く（表示モードの制限に従う） */
export function SvgCellImages({
  cells,
  renderMode,
  forPrint,
  imageDataUris,
}: SvgCellImagesProps) {
  return (
    <>
      {cells
        .filter(
          (cell) => cell.cellType === "answer" && cell.imageElements?.length
        )
        .flatMap((cell, cellIdx) =>
          cell
            .imageElements!.filter((imageElement) => {
              const visibility = imageElement.visibility ?? "both"
              if (visibility === "both") return true
              if (visibility === "answer-sheet-only")
                return renderMode === "answer-sheet"
              if (visibility === "model-answer-only")
                return renderMode === "model-answer"
              return true
            })
            .map((imageElement, ii) => {
              const pad = 1
              const ix = cell.x + pad
              const iy = cell.y + pad
              const iw = cell.width - pad * 2
              const ih = cell.height - pad * 2
              const par =
                imageElement.objectFit === "contain"
                  ? "xMidYMid meet"
                  : imageElement.objectFit === "cover"
                    ? "xMidYMid slice"
                    : "none"
              const href =
                forPrint && imageDataUris?.has(imageElement.imagePath)
                  ? imageDataUris.get(imageElement.imagePath)!
                  : `appimg:///${imageElement.imagePath}`
              return (
                <image
                  key={`img-${cellIdx}-${cell.label}-${ii}`}
                  href={href}
                  x={ix}
                  y={iy}
                  width={iw}
                  height={ih}
                  preserveAspectRatio={par}
                  opacity={imageElement.opacity}
                />
              )
            })
        )}
    </>
  )
}
