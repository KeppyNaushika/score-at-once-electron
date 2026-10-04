/**
 * 書き出しダイアログのチェック一覧の行
 *
 * 種ごとに、その種の全件（既存の一覧 query）を「選んだもの → 関連で入るもの → 含めないもの →
 * 入らないもの」の順に並べ、行ごとにチェックの意味（選ぶ・外す・含めない・戻す）を決める。
 */

import type { ComboboxOption } from "@/components/common/Combobox"
import type { UnifiedArchiveExportPreview } from "@/electron-src/lib/export/unified-archive/archiveExportPreview"

import {
  type ArchiveEntityCatalog,
  archiveEntityLabel,
} from "./archiveEntityCatalog"
import {
  pickEntity,
  setEntityExcluded,
  unpickEntity,
} from "./archiveExportSelection"
import type { ArchiveSelectableKind, ExportSelectionState } from "./types"

/** 下見が ok のときの中身 */
export type ArchiveExportPreviewOk = Extract<
  UnifiedArchiveExportPreview,
  { kind: "ok" }
>

/**
 * 行の状態。
 * - picked: 利用者が選んだ（roots / shared に入っている）
 * - forced: 成績算出が使うため外せない
 * - related: 選んだものに関連して入る
 * - excluded: 関連して入るのを利用者が外した（exclusions に入っている）
 * - notIncluded: 入らない
 */
export type ArchiveEntityRowState =
  "picked" | "forced" | "related" | "excluded" | "notIncluded"

/** 並べる順（状態ごと） */
const ROW_STATE_ORDER: readonly ArchiveEntityRowState[] = [
  "picked",
  "forced",
  "related",
  "excluded",
  "notIncluded",
]

/** チェック一覧の1行 */
export interface ArchiveEntityRow {
  id: string
  option: ComboboxOption
  state: ArchiveEntityRowState
  /** forced のとき、それを使う成績算出の id */
  forcedGradeIds: readonly string[]
}

/**
 * 1つの種について、id → 行の状態 を引く関数を作る（生徒は数百人になるので、集合を1回だけ作る）。
 * 下見がまだ無い（引いている・外せないものを外している）ときは、関連で入るかが分からないので、
 * 選んだ・含めない・入らない のどれかになる
 */
export function createArchiveEntityRowStateLookup(
  selection: ExportSelectionState,
  preview: ArchiveExportPreviewOk | null,
  kind: ArchiveSelectableKind
): (id: string) => ArchiveEntityRowState {
  const pickedIds = new Set(selection.picked[kind])
  const excludedIds = new Set(selection.excluded[kind])
  const includedIds = new Set(preview?.entityIds[kind] ?? [])
  return (id) => {
    if (pickedIds.has(id)) return "picked"
    if (excludedIds.has(id)) return "excluded"
    if (!includedIds.has(id)) return "notIncluded"
    return (preview?.forcedBy[`${kind}:${id}`] ?? []).length > 0
      ? "forced"
      : "related"
  }
}

/**
 * 1つの種の行。全件に、一覧 query に無いが選択・下見に出てくる id（自分が見られない試験
 * など）を足し、状態の順に並べる（同じ状態の中は、選んだものは選んだ順、ほかは一覧の順）
 */
export function buildArchiveEntityRows(
  kind: ArchiveSelectableKind,
  catalog: ArchiveEntityCatalog,
  selection: ExportSelectionState,
  preview: ArchiveExportPreviewOk | null
): ArchiveEntityRow[] {
  const ids = new Set([
    ...selection.picked[kind],
    ...catalog[kind].keys(),
    ...(preview?.entityIds[kind] ?? []),
    ...selection.excluded[kind],
  ])
  const rowStateOf = createArchiveEntityRowStateLookup(selection, preview, kind)
  const rows = [...ids].map((id) => {
    const state = rowStateOf(id)
    return {
      id,
      option: catalog[kind].get(id) ?? {
        value: id,
        label: archiveEntityLabel(catalog, kind, id),
      },
      state,
      forcedGradeIds:
        state === "forced" ? (preview?.forcedBy[`${kind}:${id}`] ?? []) : [],
    }
  })
  // sort は安定なので、同じ状態の中は上の並び（選んだ順 → 一覧の順）のまま
  return rows.sort(
    (left, right) =>
      ROW_STATE_ORDER.indexOf(left.state) - ROW_STATE_ORDER.indexOf(right.state)
  )
}

/** チェックが入っているか（書き出しに入る行か） */
export const isArchiveEntityRowChecked = (
  state: ArchiveEntityRowState
): boolean => state === "picked" || state === "forced" || state === "related"

/**
 * 行を選んだときの選択。外せない行は変えない。
 * - 入らない行 → 選ぶ（roots / shared に足す）
 * - 選んだ行 → 選ぶのをやめる
 * - 関連で入る行 → 含めない（exclusions に足す）
 * - 含めない行 → 戻す（exclusions から外す）
 */
export function toggleArchiveEntityRow(
  selection: ExportSelectionState,
  kind: ArchiveSelectableKind,
  id: string,
  state: ArchiveEntityRowState
): ExportSelectionState {
  switch (state) {
    case "notIncluded":
      return pickEntity(selection, kind, id)
    case "picked":
      return unpickEntity(selection, kind, id)
    case "related":
      return setEntityExcluded(selection, kind, id, true)
    case "excluded":
      return setEntityExcluded(selection, kind, id, false)
    case "forced":
      return selection
  }
}

/**
 * チェックの入った行を1つ外した選択（外すと何が一緒に外れるかを下見するため）。
 * 外せない行・チェックの無い行は null
 */
export function selectionWithoutRow(
  selection: ExportSelectionState,
  kind: ArchiveSelectableKind,
  id: string,
  state: ArchiveEntityRowState
): ExportSelectionState | null {
  if (state !== "picked" && state !== "related") return null
  return toggleArchiveEntityRow(selection, kind, id, state)
}

/** 成績算出が使うため外せない理由（例: 成績算出『期末成績』が使うため） */
export function forcedReasonText(
  catalog: ArchiveEntityCatalog,
  gradeIds: readonly string[]
): string {
  const gradeNames = gradeIds
    .map((gradeId) => `『${archiveEntityLabel(catalog, "Grade", gradeId)}』`)
    .join("")
  return `成績算出${gradeNames}が使うため`
}
