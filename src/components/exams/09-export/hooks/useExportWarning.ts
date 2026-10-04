"use client"

import { useCallback, useRef, useState } from "react"

import type {
  ConflictWarning,
  ScoringValidationResult,
  ScoringValidationWarnings,
} from "@/types/exportValidation.types"

/** 出力前に採点データを検証する出力の種類 */
export type ValidatedExportType =
  "scored-answers" | "grading-data" | "individual-reports"

/** 「このまま出力」で承知した食い違い */
interface AcknowledgedConflicts {
  conflicts: ConflictWarning[]
  scoreImpact: number
}

/**
 * 出力前警告モーダルの状態。
 *
 * 検証（IPC）と監査ログの記録は呼び出し側が持つ。ここが持つのは「どの警告を
 * 出しているか」「どの出力を保留しているか」「何を承知したか」だけ。
 */
export function useExportWarning() {
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [warningData, setWarningData] = useState<ScoringValidationWarnings>({
    noScoringData: [],
    ungraded: [],
    missingPartialScore: [],
    conflicted: [],
  })
  const [conflictScoreImpact, setConflictScoreImpact] = useState(0)
  const [conflictCheckError, setConflictCheckError] = useState<
    string | undefined
  >(undefined)
  const [pendingExportType, setPendingExportType] =
    useState<ValidatedExportType | null>(null)

  /**
   * 「このまま出力」で承知した食い違い。
   * 出力が実際に完了した時点で監査ログへ書く（保存ダイアログのキャンセルや
   * 失敗で「配った」という嘘の記録が残らないように、記録は完了後に限る）。
   */
  const acknowledgedConflictsRef = useRef<AcknowledgedConflicts | null>(null)

  /** 検証で警告が出た。モーダルを開き、出力を保留する */
  const openWarning = (
    result: ScoringValidationResult,
    exportType: ValidatedExportType
  ) => {
    setWarningData(result.warnings)
    setConflictScoreImpact(result.conflictScoreImpact)
    setConflictCheckError(result.conflictCheckError)
    setPendingExportType(exportType)
    setShowWarningModal(true)
  }

  const closeWarning = () => setShowWarningModal(false)

  /** 出力をやめて別の段へ行く。保留していた出力も捨てる */
  const abandonWarning = () => {
    setShowWarningModal(false)
    setPendingExportType(null)
  }

  /**
   * 「このまま出力」。モーダルを閉じ、未解決の食い違いを承知したことを控えて、
   * 保留していた出力の種類を返す。記録は出力の完了後（{@link takeAcknowledgedConflicts}）。
   */
  const acceptWarning = (): ValidatedExportType | null => {
    setShowWarningModal(false)
    const exportType = pendingExportType
    setPendingExportType(null)

    acknowledgedConflictsRef.current =
      warningData.conflicted.length > 0
        ? {
            conflicts: warningData.conflicted,
            scoreImpact: conflictScoreImpact,
          }
        : null

    return exportType
  }

  /** 控えた食い違いを1度だけ取り出す（二重に記録しない） */
  const takeAcknowledgedConflicts =
    useCallback((): AcknowledgedConflicts | null => {
      const acknowledged = acknowledgedConflictsRef.current
      acknowledgedConflictsRef.current = null
      return acknowledged
    }, [])

  return {
    showWarningModal,
    warningData,
    conflictScoreImpact,
    conflictCheckError,
    openWarning,
    closeWarning,
    abandonWarning,
    acceptWarning,
    takeAcknowledgedConflicts,
  }
}
