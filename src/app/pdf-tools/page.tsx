"use client"

import PageHeader from "@/components/layout/PageHeader"
import PdfToolsMainView from "@/components/pdf-tools/PdfToolsMainView"

export default function PdfToolsPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="PDF加工" />
      <div className="flex-1 overflow-hidden">
        <PdfToolsMainView />
      </div>
    </div>
  )
}
