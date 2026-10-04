/**
 * 書き出しダイアログの選択を組み替える純粋関数
 *
 * ダイアログは「選んだもの」「外したもの」「採点の範囲」などを `ExportSelectionState` に持ち、
 * 下見と書き出しに渡す `ArchiveSelection` はここで組み立てる。
 */

import type { ArchiveSelection } from "@/electron-src/lib/export/unified-archive/archiveScopeResolver"
import {
  type ArchiveOptionalItem,
  UNIFIED_ARCHIVE_EXTENSION,
} from "@/types/unifiedArchive.types"

import {
  ARCHIVE_ROOT_KINDS,
  ARCHIVE_SELECTABLE_KINDS,
  ARCHIVE_SHARED_KINDS,
  type ArchiveSelectableKind,
  type ExportSelectionState,
  type UnifiedArchiveExportInitialSelection,
} from "./types"

const emptyKindRecord = (): Record<ArchiveSelectableKind, string[]> => ({
  Exam: [],
  Coursework: [],
  Grade: [],
  AsbDefinition: [],
  Student: [],
  Classroom: [],
  SubtotalGroup: [],
  Tag: [],
})

/** 押した画面の実体だけが入った、既定（全員分・答案を含める・選べる項目なし）の選択 */
export function createExportSelectionState(
  initialSelection: UnifiedArchiveExportInitialSelection
): ExportSelectionState {
  const picked = emptyKindRecord()
  for (const kind of ARCHIVE_ROOT_KINDS) {
    picked[kind] = [...new Set(initialSelection.roots?.[kind] ?? [])]
  }
  picked.Student = [...new Set(initialSelection.shared?.Student ?? [])]
  return {
    picked,
    excluded: emptyKindRecord(),
    scoringKind: "all",
    includeAnswers: true,
    optionalItems: [],
    classroomStudentScope: "current",
    removedClassroomStudentIds: [],
  }
}

/** 空の種を載せない「種 → id」（下見のキーが選択の並べ方で揺れないよう、id は並べ替える） */
const nonEmptyIdLists = <TKind extends string>(
  kinds: readonly TKind[],
  idsByKind: Readonly<Record<TKind, readonly string[]>>
): Partial<Record<TKind, string[]>> => {
  const idLists: Partial<Record<TKind, string[]>> = {}
  for (const kind of kinds) {
    if (idsByKind[kind].length > 0) idLists[kind] = [...idsByKind[kind]].sort()
  }
  return idLists
}

/** 下見と書き出しに渡す選択 */
export function toArchiveSelection(
  state: ExportSelectionState,
  currentUserId: string
): ArchiveSelection {
  return {
    roots: nonEmptyIdLists(ARCHIVE_ROOT_KINDS, state.picked),
    shared: nonEmptyIdLists(ARCHIVE_SHARED_KINDS, state.picked),
    exclusions: nonEmptyIdLists(ARCHIVE_SELECTABLE_KINDS, state.excluded),
    scoring:
      state.scoringKind === "self"
        ? { kind: "self", userId: currentUserId }
        : { kind: "all" },
    includeAnswers: state.includeAnswers,
    optionalItems: [...state.optionalItems].sort(),
  }
}

/** 何か1つでも選んでいるか（何も無ければ書き出せない） */
export const hasPickedEntity = (state: ExportSelectionState): boolean =>
  ARCHIVE_SELECTABLE_KINDS.some((kind) => state.picked[kind].length > 0)

/** 一覧から1件足す。外していたものなら、外したことは取り消す */
export function pickEntity(
  state: ExportSelectionState,
  kind: ArchiveSelectableKind,
  id: string
): ExportSelectionState {
  if (state.picked[kind].includes(id)) return state
  return {
    ...state,
    picked: { ...state.picked, [kind]: [...state.picked[kind], id] },
    excluded: {
      ...state.excluded,
      [kind]: state.excluded[kind].filter((excludedId) => excludedId !== id),
    },
  }
}

/** 選んだ一覧から外す（関連して入るなら、関連の側に並び直す） */
export function unpickEntity(
  state: ExportSelectionState,
  kind: ArchiveSelectableKind,
  id: string
): ExportSelectionState {
  return {
    ...state,
    picked: {
      ...state.picked,
      [kind]: state.picked[kind].filter((pickedId) => pickedId !== id),
    },
  }
}

/** 関連して入るものを外す・戻す */
export function setEntityExcluded(
  state: ExportSelectionState,
  kind: ArchiveSelectableKind,
  id: string,
  isExcluded: boolean
): ExportSelectionState {
  const remaining = state.excluded[kind].filter(
    (excludedId) => excludedId !== id
  )
  return {
    ...state,
    excluded: {
      ...state.excluded,
      [kind]: isExcluded ? [...remaining, id] : remaining,
    },
  }
}

/** 選べる項目を入れる・外す */
export function setOptionalItem(
  state: ExportSelectionState,
  optionalItem: ArchiveOptionalItem,
  isIncluded: boolean
): ExportSelectionState {
  const remaining = state.optionalItems.filter(
    (includedItem) => includedItem !== optionalItem
  )
  return {
    ...state,
    optionalItems: isIncluded ? [...remaining, optionalItem] : remaining,
  }
}

/** 外せない参照先の `表(id)` を表と id に分ける。読めなければ null */
export function parseScopeViolationTarget(
  target: string
): { table: string; id: string } | null {
  const match = /^([A-Za-z]+)\((.+)\)$/.exec(target)
  if (!match) return null
  return { table: match[1], id: match[2] }
}

/** 一覧から選べる種か（外せない参照先を戻すときに、表名から種へ絞る） */
const isArchiveSelectableKind = (
  table: string
): table is ArchiveSelectableKind =>
  ARCHIVE_SELECTABLE_KINDS.some((kind) => kind === table)

/**
 * 下見が返した「外せない参照先を外していた」行を、画面で名前を出せるものと出せないものに分ける。
 *
 * 参照先は試験・資料のほか、その中の採点枠・小計・資料の項目のこともある（外した試験に従って
 * 外れた行）。中の行は名前を引けないので件数だけ返す。
 */
export function describeScopeViolations(
  violations: readonly { target: string }[]
): {
  targets: { kind: ArchiveSelectableKind; id: string }[]
  unnamedCount: number
} {
  const targetsByKey = new Map<
    string,
    { kind: ArchiveSelectableKind; id: string }
  >()
  const unnamedTargets = new Set<string>()
  for (const violation of violations) {
    const target = parseScopeViolationTarget(violation.target)
    if (target && isArchiveSelectableKind(target.table)) {
      targetsByKey.set(violation.target, { kind: target.table, id: target.id })
    } else {
      unnamedTargets.add(violation.target)
    }
  }
  return {
    targets: [...targetsByKey.values()],
    unnamedCount: unnamedTargets.size,
  }
}

/**
 * 外せない参照先を外していたのを戻す。名前の出せる参照先はそれだけを戻し、中の行（採点枠など）が
 * 含まれていれば、どの試験・資料・小計グループのものか画面では分からないので、その3種の
 * 「含めない」を全て戻す
 */
export function restoreForcedExclusions(
  state: ExportSelectionState,
  violations: readonly { target: string }[]
): ExportSelectionState {
  const { targets, unnamedCount } = describeScopeViolations(violations)
  const restored = targets.reduce(
    (acc, target) => setEntityExcluded(acc, target.kind, target.id, false),
    state
  )
  if (unnamedCount === 0) return restored
  return {
    ...restored,
    // 成績算出が外せなくするものの種（docs §5.2）
    excluded: {
      ...restored.excluded,
      Exam: [],
      Coursework: [],
      SubtotalGroup: [],
    },
  }
}

/** ファイル名に使えない文字を置き換え、`.sao` を付ける */
export function archiveFileName(baseName: string): string {
  const safeName = baseName.replace(/[\\/:*?"<>|]/g, "_").trim()
  return `${safeName || "統合アーカイブ"}${UNIFIED_ARCHIVE_EXTENSION}`
}
