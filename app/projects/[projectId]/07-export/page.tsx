"use client"

import PageHeader from "@/components/layout/PageHeader"

export default function ExportPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="結果"
        description=""
      />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">結果出力機能</h2>
          <p className="text-muted-foreground">
            この機能は現在開発中です。
          </p>
        </div>
      </div>
    </div>
  )
}