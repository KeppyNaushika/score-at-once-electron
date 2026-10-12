import { FileArchive, Plus } from "lucide-react"

import {
  type ToolbarAction,
  toolbarButtonAction,
} from "@/components/common/OverflowToolbar"
import type { UnifiedArchiveExportInitialSelection } from "@/components/unified-archive/export/types"
import type { ArchiveRootTable } from "@/electron-src/lib/export/unified-archive/archiveTableRegistry"

/** ヘッダー右の「新規作成」の並びの中での優先度。4画面とも 80（読み込みの 70 より後まで残す） */
export const ENTITY_LIST_CREATE_PRIORITY = 80

/**
 * ヘッダー右の「新規作成」。押すと既定値の1件を作って概要へ進む画面（試験・資料・成績）の形。
 * 解答用紙は作成のボタンが自分で書き込みを持つので、これを使わずに組む
 *
 * `disabled` には作成の mutation の `isPending` を渡す。書き込み中に押し直すと、
 * 押すたびに新しい id で同じ既定値の1件が作られてしまう
 */
export function entityListCreateAction({
  label,
  onClick,
  disabled = false,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}): ToolbarAction {
  return toolbarButtonAction({
    id: "create",
    priority: ENTITY_LIST_CREATE_PRIORITY,
    icon: Plus,
    label,
    onClick,
    disabled,
  })
}

/**
 * ヘッダー右の「.sao 書き出し（n件）」。選んだ行をまとめて統合アーカイブの書き出しへ渡す。
 *
 * 行の「…」の「.sao 書き出し」と同じ書き出しの入口（`openUnifiedExport`）を、1件ではなく
 * 選んだ全部から始める。4画面とも根になる実体（`rootTable`）が違うだけで組み立ては同じ。
 *
 * `selectedIds` は `useEntityListControls` の選択（消えた行と選べない行は落ちている）を渡す。
 * 選べない行（解答用紙の担当者以外）はそもそも選択に入らないので、書き出しにも入らない。
 */
export function entityListBulkUnifiedExportAction({
  rootTable,
  selectedIds,
  openUnifiedExport,
}: {
  rootTable: ArchiveRootTable
  selectedIds: Set<string>
  /** `useEntityListArchive` の `openUnifiedExport` */
  openUnifiedExport: (selection: UnifiedArchiveExportInitialSelection) => void
}): ToolbarAction {
  return toolbarButtonAction({
    id: "bulk-unified-export",
    priority: 50,
    icon: FileArchive,
    label: `.sao 書き出し（${selectedIds.size}件）`,
    onClick: () => {
      const roots: Partial<Record<ArchiveRootTable, string[]>> = {}
      roots[rootTable] = [...selectedIds]
      openUnifiedExport({ roots })
    },
  })
}

/**
 * 一覧4画面のヘッダー右の並び。**左から 新規作成 → 読み込み → 絞り込み → (選択中だけ) タグ追加 → 一括操作。**
 *
 * 並び順はここ1か所で決め、画面ごとの違いは差し込む枠で受ける:
 *
 * - `filters`: 解答用紙の「全員の解答用紙を表示」のような、ヘッダーに置く絞り込み
 * - `bulk`: 「.sao 書き出し（n件）」（`entityListBulkUnifiedExportAction`）のような、
 *   タグ追加の後ろに並べる一括操作
 *
 * 選択中だけ現れる操作は `bulkTag` が null（何も選んでいない）のとき `bulk` ごと出さない。
 */
export function entityListToolbarActions({
  create,
  archiveImport,
  filters = [],
  bulkTag,
  bulk = [],
}: {
  create: ToolbarAction
  archiveImport: ToolbarAction
  filters?: ToolbarAction[]
  /** `useEntityListControls` の `bulkTagAction`（何も選んでいないときは null） */
  bulkTag: ToolbarAction | null
  bulk?: ToolbarAction[]
}): ToolbarAction[] {
  return [
    create,
    archiveImport,
    ...filters,
    ...(bulkTag ? [bulkTag, ...bulk] : []),
  ]
}
