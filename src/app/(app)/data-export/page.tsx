"use client"

import { useState } from "react"

import PageHeader from "@/components/layout/PageHeader"
import { UnifiedArchiveExportPanel } from "@/components/unified-archive/export/UnifiedArchiveExportPanel"

/** 何も選ばずに開く（一覧・詳細の「.sao 書き出し」と違い、押した画面の実体が無い） */
const EMPTY_SELECTION = { roots: {} }

/**
 * データ書き出し。統合アーカイブ（.sao）の書き出しを、ダイアログでなく独立したページで
 * 行う。中身は一覧・詳細から開く書き出しダイアログと同じ部品。
 */
export default function DataExportPage() {
  // キャンセル・書き出し後の「閉じる」で、選び直せるよう最初の状態へ戻す
  const [panelKey, setPanelKey] = useState(0)

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="データ書き出し"
        subtitle="選んだものと、それに関連するデータをまとめて1つのファイル（.sao）に書き出します。"
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <UnifiedArchiveExportPanel
          key={panelKey}
          initialSelection={EMPTY_SELECTION}
          onExportingChange={() => {}}
          onClose={() => setPanelKey((prev) => prev + 1)}
        />
      </div>
    </div>
  )
}
