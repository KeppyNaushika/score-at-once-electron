"use client"

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"

import {
  type ExportOutcome,
  ExportResultSummary,
} from "@/components/common/ExportResultSummary"
import { Button } from "@/components/ui/button"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import type { UnifiedArchiveExportPhase } from "@/electron-src/lib/export/unified-archive/unifiedArchiveCreator"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import {
  exportUnifiedArchiveMutation,
  selectUnifiedArchiveExportPath,
  subscribeUnifiedArchiveExportProgress,
  unifiedArchiveExportPreviewQuery,
} from "@/queries/unifiedArchive"

import {
  type ArchiveEntityCatalog,
  archiveEntityLabel,
} from "./archiveEntityCatalog"
import {
  archiveFileName,
  createExportSelectionState,
  hasPickedEntity,
  pickEntity,
  restoreForcedExclusions,
  setEntityExcluded,
  setOptionalItem,
  toArchiveSelection,
  unpickEntity,
} from "./archiveExportSelection"
import { ExcludedSummary } from "./ExcludedSummary"
import { ExportDialogFooter } from "./ExportDialogFooter"
import { ExportErrorBand } from "./ExportErrorBand"
import { missingFileDescription } from "./exportLabels"
import { ExportOptionsSection } from "./ExportOptionsSection"
import { ExportPreviewDetails } from "./ExportPreviewDetails"
import { ForcedExclusionAlert } from "./ForcedExclusionAlert"
import { PickedEntityList } from "./PickedEntityList"
import { RelatedEntitiesSection } from "./RelatedEntitiesSection"
import {
  ARCHIVE_SELECTABLE_KINDS,
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
  const [selection, setSelection] = useState(() =>
    createExportSelectionState(initialSelection)
  )
  const [isExporting, setIsExporting] = useState(false)
  const [exportPhase, setExportPhase] =
    useState<UnifiedArchiveExportPhase | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportOutcome, setExportOutcome] = useState<ExportOutcome | null>(null)
  const exportArchive = useMutation(exportUnifiedArchiveMutation())

  const archiveSelection = useMemo(
    () => toArchiveSelection(selection, currentUser.id),
    [selection, currentUser.id]
  )
  const debouncedSelection = useDebouncedValue(
    archiveSelection,
    PREVIEW_DEBOUNCE_MS
  )
  const canPreview = hasPickedEntity(selection)
  const preview = useQuery({
    ...unifiedArchiveExportPreviewQuery(debouncedSelection),
    enabled: canPreview,
    placeholderData: keepPreviousData,
  })
  const previewResult = canPreview ? preview.data : undefined
  const isPreviewCurrent =
    debouncedSelection === archiveSelection && !preview.isFetching

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
    canPreview &&
    isPreviewCurrent &&
    previewResult?.kind === "ok" &&
    !isExporting

  return (
    <>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-4">
        {exportError !== null && (
          <ExportErrorBand title="書き出せませんでした" message={exportError} />
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
              setSelection((prev) =>
                restoreForcedExclusions(prev, previewResult.violations)
              )
            }
          />
        )}

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">書き出すもの</h3>
          <div className="grid grid-cols-2 gap-2">
            {ARCHIVE_SELECTABLE_KINDS.map((kind) => (
              <PickedEntityList
                key={kind}
                kind={kind}
                pickedIds={selection.picked[kind]}
                catalog={catalog}
                onPick={(id) =>
                  setSelection((prev) => pickEntity(prev, kind, id))
                }
                onUnpick={(id) =>
                  setSelection((prev) => unpickEntity(prev, kind, id))
                }
              />
            ))}
          </div>
          {!canPreview && (
            <p className="text-sm text-muted-foreground">
              書き出すものを1つ以上選んでください
            </p>
          )}
        </section>

        {previewResult?.kind === "ok" && (
          <RelatedEntitiesSection
            entityIds={previewResult.entityIds}
            forcedBy={previewResult.forcedBy}
            selection={selection}
            catalog={catalog}
            onExcludedChange={(kind, id, isExcluded) =>
              setSelection((prev) =>
                setEntityExcluded(prev, kind, id, isExcluded)
              )
            }
          />
        )}

        <ExportOptionsSection
          selection={selection}
          currentUserName={currentUser.name}
          onScoringKindChange={(scoringKind) =>
            setSelection((prev) => ({ ...prev, scoringKind }))
          }
          onIncludeAnswersChange={(includeAnswers) =>
            setSelection((prev) => ({ ...prev, includeAnswers }))
          }
          onOptionalItemChange={(optionalItem, isIncluded) =>
            setSelection((prev) =>
              setOptionalItem(prev, optionalItem, isIncluded)
            )
          }
        />

        {previewResult?.kind === "ok" && (
          <ExportPreviewDetails
            rowCounts={previewResult.rowCounts}
            missingFiles={previewResult.missingFiles}
          />
        )}
      </div>

      <div className="border-t px-6 py-3">
        <ExcludedSummary
          selection={selection}
          excludedRowCounts={
            previewResult?.kind === "ok"
              ? previewResult.excludedRowCounts
              : null
          }
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
