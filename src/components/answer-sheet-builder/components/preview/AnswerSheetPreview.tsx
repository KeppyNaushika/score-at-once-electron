"use client"

import { useRef, useState } from "react"

import type {
  AnswerSheetAction,
  BorderConfig,
  RenderMode,
} from "@/types/answerSheetDefinition.types"
import type {
  ComputedLayout,
  ComputedMultiPageLayout,
} from "@/types/answerSheetLayout.types"

import { usePreviewDragInteraction } from "../../hooks/usePreviewDragInteraction"
import { AnswerSheetSVGRenderer } from "./AnswerSheetSVGRenderer"
import { PreviewToolbar } from "./PreviewToolbar"

interface AnswerSheetPreviewProps {
  layout: ComputedLayout
  multiPageLayout: ComputedMultiPageLayout
  renderMode: RenderMode
  onRenderModeChange: (mode: RenderMode) => void
  dispatch: (action: AnswerSheetAction) => void
  baseRowHeight: number
  /** 罫線種別ごとの破線ダッシュ長/間隔の解決に使う */
  borderConfig: BorderConfig
}

/**
 * 解答用紙のSVGプレビューコンポーネント。
 * 単一ページ/複数ページ表示の切替・ドラッグによるレイアウト微調整に対応する。
 */
export function AnswerSheetPreview({
  layout,
  multiPageLayout,
  renderMode,
  onRenderModeChange,
  dispatch,
  baseRowHeight,
  borderConfig,
}: AnswerSheetPreviewProps) {
  const [zoom, setZoom] = useState(100)
  const [interactive, setInteractive] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const svgRef = useRef<SVGSVGElement>(null)

  const {
    hoveredDragInfo,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    cursor,
  } = usePreviewDragInteraction(layout, interactive, dispatch, baseRowHeight)

  const { totalPages } = multiPageLayout
  const currentPageLayout =
    totalPages > 1 ? multiPageLayout.pages[currentPage] : undefined

  const pageInfo = `${layout.pageWidthMm}×${layout.pageHeightMm}mm`

  const handlePageChange = (page: number) => {
    if (page >= 0 && page < totalPages) {
      setCurrentPage(page)
    }
  }

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
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
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
              pageLayout={currentPageLayout}
              renderMode={renderMode}
              interactive={interactive}
              hoveredDragInfo={hoveredDragInfo}
              borderConfig={borderConfig}
            />
          </svg>
        </div>
      </div>
    </div>
  )
}
