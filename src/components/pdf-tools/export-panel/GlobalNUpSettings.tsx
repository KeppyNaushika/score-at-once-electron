"use client"

import type { NUpConfig } from "@/types/pdfTools.types"

import NUpSelects from "../NUpSelects"

interface GlobalNUpSettingsProps {
  globalNUp: NUpConfig
  onGlobalNUpChange: (globalNUp: NUpConfig) => void
  disabled: boolean
}

/**
 * 全体の N-up（1面の数・並べ方）を選ぶ欄。ファイルごとの N-up で組んだ並び（面、
 * または単独ページ）を、さらに並び順で隣り合う N 個ずつ1面にまとめる。
 *
 * ファイルごとの設定と同じ Select（NUpSelects）を、短い見出し「全体」だけ添えて置く。
 * 何の設定かは aria-label で読める
 */
export default function GlobalNUpSettings({
  globalNUp,
  onGlobalNUpChange,
  disabled,
}: GlobalNUpSettingsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium whitespace-nowrap">全体</span>
      <NUpSelects
        nUp={globalNUp}
        onNUpChange={onGlobalNUpChange}
        disabled={disabled}
        accessibleNames={{
          pagesPerSheet: "全体の1面にまとめる数",
          slotOrder: "全体の面の中の並べ方",
        }}
      />
    </div>
  )
}
