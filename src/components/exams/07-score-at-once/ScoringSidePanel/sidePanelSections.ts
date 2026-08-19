/**
 * サイドパネルの折りたたみ状態。
 *
 * 節ごとに1行（`UserSidePanelSection`）で持つ。**行が無い節は開いている**ので、
 * 畳んでいる節の集合へ倒す。1キーの JSON に配列で持っていた頃は、続けて2つ畳むと
 * 先の1つが開いたままになった（塊で読み書きするため）。
 */

import type { UserSidePanelSection } from "@prisma/client"

export function toCollapsedSections(
  rows: UserSidePanelSection[]
): ReadonlySet<string> {
  return new Set(
    rows.filter((row) => row.collapsed).map((row) => row.sectionId)
  )
}
