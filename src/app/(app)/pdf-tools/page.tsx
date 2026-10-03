"use client"

import { useState } from "react"

import type { ToolbarAction } from "@/components/common/OverflowToolbar"
import PageHeader from "@/components/layout/PageHeader"
import PdfToolsMainView from "@/components/pdf-tools/PdfToolsMainView"
import PreviewSizeControl, {
  PREVIEW_COLUMNS_DEFAULT,
} from "@/components/pdf-tools/PreviewSizeControl"

export default function PdfToolsPage() {
  // ページプレビュー（インポート・エクスポート双方）の1行あたりの枚数
  const [previewColumns, setPreviewColumns] = useState(PREVIEW_COLUMNS_DEFAULT)

  const previewSizeControl = (
    <PreviewSizeControl
      columns={previewColumns}
      onColumnsChange={setPreviewColumns}
    />
  )
  const toolbarActions: ToolbarAction[] = [
    {
      id: "preview-size",
      priority: 80,
      node: previewSizeControl,
      collapsedNode: previewSizeControl,
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="PDF加工" actions={toolbarActions} />
      <div className="flex-1 overflow-hidden">
        <PdfToolsMainView previewColumns={previewColumns} />
      </div>
    </div>
  )
}
