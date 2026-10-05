"use client"

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"

import {
  type ExportOutcome,
  ExportResultSummary,
} from "@/components/common/ExportResultSummary"
import { Button } from "@/components/ui/button"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import type { UnifiedArchiveExportPhase } from "@/electron-src/lib/export/unified-archive/unifiedArchiveCreator"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { studentListQuery } from "@/queries/student"
import {
  exportUnifiedArchiveMutation,
  selectUnifiedArchiveExportPath,
  subscribeUnifiedArchiveExportProgress,
  unifiedArchiveExportPreviewKey,
  unifiedArchiveExportPreviewQuery,
} from "@/queries/unifiedArchive"

import {
  type ArchiveEntityCatalog,
  archiveEntityLabel,
} from "./archiveEntityCatalog"
import { ArchiveEntityCheckListSection } from "./ArchiveEntityCheckListSection"
import {
  setArchiveEntityRowsChecked,
  toggleArchiveEntityRow,
} from "./archiveEntityRows"
import {
  archiveFileName,
  createExportSelectionState,
  hasPickedEntity,
  restoreForcedExclusions,
  setOptionalItem,
  toArchiveSelection,
} from "./archiveExportSelection"
import {
  buildClassroomStudentIndex,
  classroomSourcesOfStudents,
  withClassroomStudents,
} from "./classroomStudents"
import { ExcludedSummary } from "./ExcludedSummary"
import { ExportDialogFooter } from "./ExportDialogFooter"
import { ExportErrorBand } from "./ExportErrorBand"
import { missingFileDescription } from "./exportLabels"
import { ExportOptionsSection } from "./ExportOptionsSection"
import { ExportPreviewDetails } from "./ExportPreviewDetails"
import { ForcedExclusionAlert } from "./ForcedExclusionAlert"
import { useRemovalImpact } from "./hooks/useRemovalImpact"
import {
  type ActiveArchiveEntity,
  ARCHIVE_SELECTABLE_KINDS,
  type ArchiveSelectableKind,
  type ExportSelectionState,
  type UnifiedArchiveExportInitialSelection,
} from "./types"

/** 選択を変えてから下見を引くまでの待ち時間（ms） */
const PREVIEW_DEBOUNCE_MS = 300

interface ExportDialogBodyProps {
  /** 実体の名前と、一覧に足すときの選択肢 */
  catalog: ArchiveEntityCatalog
  initialSelection: UnifiedArchiveExportInitialSelection
  /** 書き出しの最中は閉じさせない。始めと終わりに知らせる */
  onExportingChange: (isExporting: boolean) => void
  onClose: () => void
}

/**
 * 書き出しダイアログの中身。ダイアログを開くたびにマウントし直されるので、選択は
 * 押した画面の実体から始まる。
 */
export function ExportDialogBody({
  catalog,
  initialSelection,
  onExportingChange,
  onClose,
}: ExportDialogBodyProps) {
  const currentUser = useCurrentUser()
  const queryClient = useQueryClient()
  const [selection, setSelection] = useState(() =>
    createExportSelectionState(initialSelection)
  )
  /** チェック一覧で今いる行（赤枠を出す元） */
  const [activeEntity, setActiveEntity] = useState<ActiveArchiveEntity | null>(
    null
  )
  const [isExporting, setIsExporting] = useState(false)
  const [exportPhase, setExportPhase] =
    useState<UnifiedArchiveExportPhase | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportOutcome, setExportOutcome] = useState<ExportOutcome | null>(null)
  const exportArchive = useMutation(exportUnifiedArchiveMutation())

  // 学級から生徒を選ぶための名簿と在籍（生徒一覧は在籍を同梱している。一覧は親も引いて
  // いるのでキャッシュから返る）
  const { data: students } = useQuery(studentListQuery())
  const classroomStudentIndex = useMemo(
    () =>
      buildClassroomStudentIndex(
        students ?? [],
        selection.classroomStudentPhases
      ),
    [students, selection.classroomStudentPhases]
  )
  /** 学級から入った生徒 → どの学級から入ったか（行の「選択中（1年1組）」に使う） */
  const classroomSourcesByStudent = useMemo(
    () => classroomSourcesOfStudents(selection, classroomStudentIndex),
    [selection, classroomStudentIndex]
  )
  /** 学級から入った生徒を足した選択（下見・書き出し・行の状態はこちらで決める） */
  const effectiveSelection = useMemo(
    () => withClassroomStudents(selection, classroomStudentIndex),
    [selection, classroomStudentIndex]
  )
  const archiveSelection = useMemo(
    () => toArchiveSelection(effectiveSelection, currentUser.id),
    [effectiveSelection, currentUser.id]
  )
  const debouncedSelection = useDebouncedValue(
    archiveSelection,
    PREVIEW_DEBOUNCE_MS
  )
  const canPreview = hasPickedEntity(effectiveSelection)
  const preview = useQuery({
    ...unifiedArchiveExportPreviewQuery(debouncedSelection),
    enabled: canPreview,
    placeholderData: keepPreviousData,
  })
  const previewResult = canPreview ? preview.data : undefined
  const isPreviewCurrent =
    debouncedSelection === archiveSelection && !preview.isFetching
  const previewOk = previewResult?.kind === "ok" ? previewResult : null
  const removalImpact = useRemovalImpact({
    selection,
    classroomStudentIndex,
    currentUserId: currentUser.id,
    activeEntity,
    currentPreview: isPreviewCurrent ? previewOk : null,
  })

  /**
   * 選択を変える。覚えておいた下見（行を外した選択のもの）は、今の選択との比較にしか
   * 使わないので、ここでまとめて捨てる（今見ている下見は残る）
   */
  const updateSelection = (
    update: (prev: ExportSelectionState) => ExportSelectionState
  ) => {
    setSelection(update)
    queryClient.removeQueries({
      queryKey: unifiedArchiveExportPreviewKey,
      type: "inactive",
    })
  }

  const handleActiveEntityChange = (
    kind: ArchiveSelectableKind,
    id: string | null
  ) =>
    setActiveEntity((prev) => {
      // 別の一覧から離れた知らせで、今いる行を消さない
      if (id === null) return prev?.kind === kind ? null : prev
      return prev?.kind === kind && prev.entityId === id
        ? prev
        : { kind, entityId: id }
    })

  // 書き出しの段は main から押し出される（購読のコールバックで受ける）
  useEffect(
    () =>
      subscribeUnifiedArchiveExportProgress((phase) => setExportPhase(phase)),
    []
  )

  /** 既定のファイル名に使う名前（最初に選んだ根。根が無ければ最初に選んだ共通の実体） */
  const archiveBaseName = (() => {
    for (const kind of ARCHIVE_SELECTABLE_KINDS) {
      const firstId = selection.picked[kind][0]
      if (firstId) return archiveEntityLabel(catalog, kind, firstId)
    }
    return "統合アーカイブ"
  })()

  const handleExport = async () => {
    setExportError(null)
    try {
      const outputPath = await selectUnifiedArchiveExportPath(
        archiveFileName(archiveBaseName)
      )
      if (outputPath === null) return
      setIsExporting(true)
      setExportPhase(null)
      onExportingChange(true)
      const exported = await exportArchive.mutateAsync({
        selection: archiveSelection,
        outputPath,
      })
      setExportOutcome({
        archives: [
          {
            sourceId: exported.outputPath,
            sourceName: archiveBaseName,
            outputPath: exported.outputPath,
            missingFiles: exported.manifest.files.missing.map(
              missingFileDescription
            ),
          },
        ],
        failures: [],
      })
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "予期しないエラーが発生しました"
      )
    } finally {
      setIsExporting(false)
      onExportingChange(false)
    }
  }

  if (exportOutcome) {
    return (
      <>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <ExportResultSummary outcome={exportOutcome} />
        </div>
        <div className="flex justify-end border-t bg-muted/30 px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </>
    )
  }

  const canExport =
    canPreview && isPreviewCurrent && previewOk !== null && !isExporting
  const hasAlert =
    exportError !== null ||
    Boolean(preview.error) ||
    previewResult?.kind === "forcedExcluded"

  return (
    <>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-4">
        <ArchiveEntityCheckListSection
          selection={effectiveSelection}
          classroomSourcesByStudent={classroomSourcesByStudent}
          classroomStudentPhases={selection.classroomStudentPhases}
          preview={previewOk}
          catalog={catalog}
          removalImpact={removalImpact}
          onToggle={(kind, row) =>
            updateSelection((prev) =>
              toggleArchiveEntityRow(
                prev,
                classroomStudentIndex,
                kind,
                row.id,
                row.state
              )
            )
          }
          onToggleMany={(kind, rows, isChecked) =>
            updateSelection((prev) =>
              setArchiveEntityRowsChecked(
                prev,
                classroomStudentIndex,
                kind,
                rows,
                isChecked
              )
            )
          }
          onClassroomStudentPhasesChange={(classroomStudentPhases) =>
            updateSelection((prev) => ({ ...prev, classroomStudentPhases }))
          }
          onActiveEntityChange={handleActiveEntityChange}
        />
        {!canPreview && (
          <p className="text-sm text-muted-foreground">
            書き出すものを1つ以上選んでください
          </p>
        )}

        <ExportOptionsSection
          selection={selection}
          currentUserName={currentUser.name}
          onScoringKindChange={(scoringKind) =>
            updateSelection((prev) => ({ ...prev, scoringKind }))
          }
          onIncludeAnswersChange={(includeAnswers) =>
            updateSelection((prev) => ({ ...prev, includeAnswers }))
          }
          onOptionalItemChange={(optionalItem, isIncluded) =>
            updateSelection((prev) =>
              setOptionalItem(prev, optionalItem, isIncluded)
            )
          }
        />

        {previewOk && (
          <ExportPreviewDetails
            rowCounts={previewOk.rowCounts}
            missingFiles={previewOk.missingFiles}
          />
        )}
      </div>

      {/* 失敗の知らせは下端に出す。上に出すと、押した直後に一覧が下へずれる */}
      <div className="space-y-3 border-t px-6 py-3">
        {hasAlert && (
          <div className="max-h-48 space-y-3 overflow-y-auto">
            {exportError !== null && (
              <ExportErrorBand
                title="書き出せませんでした"
                message={exportError}
              />
            )}
            {preview.error && (
              <ExportErrorBand
                title="書き出す範囲を確かめられませんでした"
                message={preview.error.message}
              />
            )}
            {previewResult?.kind === "forcedExcluded" && (
              <ForcedExclusionAlert
                violations={previewResult.violations}
                catalog={catalog}
                onRestore={() =>
                  updateSelection((prev) =>
                    restoreForcedExclusions(prev, previewResult.violations)
                  )
                }
              />
            )}
          </div>
        )}
        <ExcludedSummary
          selection={selection}
          excludedRowCounts={previewOk ? previewOk.excludedRowCounts : null}
          catalog={catalog}
        />
      </div>

      <ExportDialogFooter
        isExporting={isExporting}
        exportPhase={exportPhase}
        isCheckingScope={canPreview && !isPreviewCurrent}
        canExport={canExport}
        onCancel={onClose}
        onExport={() => void handleExport()}
      />
    </>
  )
}
