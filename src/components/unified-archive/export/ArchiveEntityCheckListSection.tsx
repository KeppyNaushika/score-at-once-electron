"use client"

import { useMemo } from "react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { isOneOf } from "@/types/stringUnion"

import {
  type ArchiveEntityCatalog,
  archiveEntityLabel,
} from "./archiveEntityCatalog"
import { ArchiveEntityCheckList } from "./ArchiveEntityCheckList"
import {
  type ArchiveEntityRow,
  type ArchiveExportPreviewOk,
  buildArchiveEntityRows,
} from "./archiveEntityRows"
import type { useRemovalImpact } from "./hooks/useRemovalImpact"
import {
  ARCHIVE_SELECTABLE_KINDS,
  type ArchiveSelectableKind,
  CLASSROOM_STUDENT_SCOPES,
  type ClassroomStudentScope,
  type ExportSelectionState,
} from "./types"

/** 赤枠で囲むものが無いとき（毎回作り直して一覧の描き直しを招かないよう、1つを使い回す） */
const NO_LOST_ENTITIES: ReadonlySet<string> = new Set()

/** 学級から生徒を選ぶ範囲の切り替え */
const CLASSROOM_STUDENT_SCOPE_LABELS: Record<ClassroomStudentScope, string> = {
  none: "生徒は選ばない",
  current: "在籍中の生徒",
  all: "過去在籍も含む",
}

interface ArchiveEntityCheckListSectionProps {
  /** 学級から入った生徒を足した選択 */
  selection: ExportSelectionState
  /** 学級から入った生徒 → どの学級から入ったか */
  classroomSourcesByStudent: ReadonlyMap<string, readonly string[]>
  classroomStudentScope: ClassroomStudentScope
  /** 下見（ok のときだけ）。関連で入るか・外せないかはここから決まる */
  preview: ArchiveExportPreviewOk | null
  catalog: ArchiveEntityCatalog
  /** 今いる行を外したときの影響。当てていない・引いている間は null */
  removalImpact: ReturnType<typeof useRemovalImpact>
  onToggle: (kind: ArchiveSelectableKind, row: ArchiveEntityRow) => void
  onToggleMany: (
    kind: ArchiveSelectableKind,
    rows: ArchiveEntityRow[],
    isChecked: boolean
  ) => void
  onClassroomStudentScopeChange: (
    classroomStudentScope: ClassroomStudentScope
  ) => void
  onActiveEntityChange: (kind: ArchiveSelectableKind, id: string | null) => void
}

/**
 * 書き出すもの。種ごとのチェック一覧と、含まれる利用者（外せない。名前だけ並べる）。
 * 学級の見出しには、選んだ学級の生徒を生徒の一覧で選んだ状態にする範囲の切り替えを置く。
 */
export function ArchiveEntityCheckListSection({
  selection,
  classroomSourcesByStudent,
  classroomStudentScope,
  preview,
  catalog,
  removalImpact,
  onToggle,
  onToggleMany,
  onClassroomStudentScopeChange,
  onActiveEntityChange,
}: ArchiveEntityCheckListSectionProps) {
  const lostEntityKeys =
    removalImpact?.kind === "lost"
      ? removalImpact.lostEntityKeys
      : NO_LOST_ENTITIES
  const rowsByKind = useMemo(
    () =>
      ARCHIVE_SELECTABLE_KINDS.map((kind) => ({
        kind,
        rows: buildArchiveEntityRows(
          kind,
          catalog,
          selection,
          preview,
          classroomSourcesByStudent
        ),
      })),
    [catalog, selection, preview, classroomSourcesByStudent]
  )
  const userIds = preview?.entityIds.User ?? []

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">書き出すもの</h3>
      <p className="text-xs text-muted-foreground">
        行を選ぶとチェックが入れ替わります（↑↓ で移り、Enter
        で入れ替え）。関連で入るものを外すと「含めない」として残ります。
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {rowsByKind.map(({ kind, rows }) => (
          <ArchiveEntityCheckList
            key={kind}
            kind={kind}
            rows={rows}
            catalog={catalog}
            lostEntityKeys={lostEntityKeys}
            removalImpact={
              removalImpact?.activeEntity.kind === kind ? removalImpact : null
            }
            onToggle={(row) => onToggle(kind, row)}
            onToggleMany={(rows, isChecked) =>
              onToggleMany(kind, rows, isChecked)
            }
            headerControls={
              kind === "Classroom" && (
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  className="h-5"
                  aria-label="選んだ学級から選ぶ生徒"
                  value={classroomStudentScope}
                  onValueChange={(value) => {
                    // もう一度押して何も選ばない状態にはしない
                    if (isOneOf(CLASSROOM_STUDENT_SCOPES, value)) {
                      onClassroomStudentScopeChange(value)
                    }
                  }}
                >
                  {CLASSROOM_STUDENT_SCOPES.map((scope) => (
                    <ToggleGroupItem
                      key={scope}
                      value={scope}
                      className="h-5 px-2 text-xs"
                    >
                      {CLASSROOM_STUDENT_SCOPE_LABELS[scope]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )
            }
            onActiveIdChange={(id) => onActiveEntityChange(kind, id)}
          />
        ))}
      </div>
      {userIds.length > 0 && (
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            含まれる利用者（{userIds.length}人）。パスコードは書き出しません。
          </p>
          <ul aria-label="含まれる利用者" className="flex flex-wrap gap-1">
            {userIds.map((userId) => {
              const isLost = lostEntityKeys.has(`User:${userId}`)
              return (
                <li
                  key={userId}
                  className={cn(
                    "rounded-md bg-muted px-2 py-0.5 text-xs",
                    isLost && "ring-1 ring-destructive ring-inset"
                  )}
                >
                  {archiveEntityLabel(catalog, "User", userId)}
                  {isLost && (
                    <span className="sr-only">外すと一緒に外れます</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
