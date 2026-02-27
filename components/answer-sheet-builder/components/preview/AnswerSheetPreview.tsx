"use client"

import { useRef, useState } from "react"

import type {
  AnswerSheetAction,
  ComputedLayout,
  RenderMode,
} from "@/types/answerSheetBuilder.types"

import { usePreviewDragInteraction } from "../../hooks/usePreviewDragInteraction"
import { AnswerSheetSVGRenderer } from "./AnswerSheetSVGRenderer"
import { PreviewToolbar } from "./PreviewToolbar"

interface AnswerSheetPreviewProps {
  layout: ComputedLayout
  renderMode: RenderMode
  onRenderModeChange: (mode: RenderMode) => void
  dispatch: (action: AnswerSheetAction) => void
  baseRowHeight: number
}

export function AnswerSheetPreview({
  layout,
  renderMode,
  onRenderModeChange,
  dispatch,
  baseRowHeight,
}: AnswerSheetPreviewProps) {
  const [zoom, setZoom] = useState(100)
  const [interactive, setInteractive] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  const {
    hoveredDragInfo,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    cursor,
  } = usePreviewDragInteraction(layout, interactive, dispatch, baseRowHeight)

  const pageInfo = `${layout.pageWidthMm}×${layout.pageHeightMm}mm`

  return (
    <div className="flex h-full flex-col">
      <PreviewToolbar
        zoom={zoom}
        onZoomChange={setZoom}
        renderMode={renderMode}
        onRenderModeChange={onRenderModeChange}
        pageInfo={pageInfo}
        interactive={interactive}
        onInteractiveChange={setInteractive}
      />
      <div className="flex-1 overflow-auto bg-gray-100 p-4 dark:bg-gray-900">
        <div
          className="mx-auto shadow-lg"
          style={{
            width: `${(layout.pageWidthMm * zoom) / 100}mm`,
            aspectRatio: `${layout.pageWidthMm} / ${layout.pageHeightMm}`,
          }}
        >
          <svg
            ref={svgRef}
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`0 0 ${layout.pageWidthMm} ${layout.pageHeightMm}`}
            className="h-full w-full"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              cursor: interactive ? cursor : undefined,
            }}
            onMouseDown={interactive ? onMouseDown : undefined}
            onMouseMove={interactive ? onMouseMove : undefined}
            onMouseUp={interactive ? onMouseUp : undefined}
            onMouseLeave={interactive ? onMouseLeave : undefined}
          >
            <AnswerSheetSVGRenderer
              layout={layout}
              renderMode={renderMode}
              interactive={interactive}
              hoveredDragInfo={hoveredDragInfo}
            />
          </svg>
        </div>
      </div>
    </div>
  )
}
