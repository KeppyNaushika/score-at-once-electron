"use client"

import { useState } from "react"

import PageHeader from "@/components/layout/PageHeader"
import PdfToolsMainView from "@/components/pdf-tools/PdfToolsMainView"
import PreviewSizeControl, {
  PREVIEW_COLUMNS_DEFAULT,
} from "@/components/pdf-tools/PreviewSizeControl"

export default function PdfToolsPage() {
  // ページプレビュー（インポート・エクスポート双方）の1行あたりの枚数
  const [previewColumns, setPreviewColumns] = useState(PREVIEW_COLUMNS_DEFAULT)

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="PDF加工">
        <PreviewSizeControl
          columns={previewColumns}
          onColumnsChange={setPreviewColumns}
        />
      </PageHeader>
      <div className="flex-1 overflow-hidden">
        <PdfToolsMainView previewColumns={previewColumns} />
      </div>
    </div>
  )
}
