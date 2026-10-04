import { useMutation } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"

import type {
  ArchiveIdChoice,
  ArchiveMatchDecision,
  UnifiedArchiveImportDecisions,
} from "@/electron-src/lib/import/unified-archive/types"
import {
  analyzeUnifiedArchiveImport,
  closeUnifiedArchive,
  importUnifiedArchiveMutation,
  openUnifiedArchive,
  selectUnifiedArchiveImportFile,
} from "@/queries/unifiedArchive"
import type { ImportAction } from "@/types/importAction.types"

import type {
  ArchiveAnalyzeOutcome,
  ArchiveImportOutcome,
  ArchiveImportStep,
  OpenedUnifiedArchive,
  RejectedUnifiedArchive,
} from "../types"

const errorMessageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * 「別で追加する」では既存の行に触らないので、照合で「アーカイブの id に合わせる」は
 * 選べない（core が止める）。画面でも出さず、送る決定でも取り込み先の id に倒す
 */
const decisionForAction = (
  decision: ArchiveMatchDecision,
  action: ImportAction
): ArchiveMatchDecision =>
  action === "separate" && decision.kind === "same"
    ? { ...decision, adoptId: "existing" }
    : decision

/**
 * 統合アーカイブの取り込みウィザードの状態と操作。
 *
 * ウィザードを開いている間だけマウントされる部品から呼ぶ（閉じれば状態ごと消える）。
 * 開いたアーカイブは main が持つので、閉じる・別のファイルを開き直すときに main の作業も
 * 閉じる（下の effect）。
 *
 * 決定（方針・紐づけ・衝突の id）が変わったら、段を進めるときに試し取り込みをやり直す。
 * 試し取り込みの結果は「どの決定に対するものか」を同梱して持ち、表示時に引き直す。
 */
export function useUnifiedArchiveImportWizard({
  onComplete,
}: {
  onComplete?: () => void
}) {
  const [step, setStep] = useState<ArchiveImportStep>("fileSelect")
  const [opened, setOpened] = useState<OpenedUnifiedArchive | null>(null)
  const [rejection, setRejection] = useState<RejectedUnifiedArchive | null>(
    null
  )
  // 同じ試験の続きを取り込むのが普通なので、今の試験の取り込みと同じく「統合する」が既定
  const [action, setAction] = useState<ImportAction>("merge")
  const [matchDecisions, setMatchDecisions] = useState<
    Record<string, ArchiveMatchDecision>
  >({})
  const [conflictIdChoice, setConflictIdChoiceState] =
    useState<ArchiveIdChoice>("existing")
  const [conflictIdOverrides, setConflictIdOverrides] = useState<
    Record<string, ArchiveIdChoice>
  >({})
  const [analysis, setAnalysis] = useState<{
    requestKey: string
    outcome: ArchiveAnalyzeOutcome
  } | null>(null)
  const [importOutcome, setImportOutcome] =
    useState<ArchiveImportOutcome | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const importArchive = useMutation(importUnifiedArchiveMutation())

  const sessionId = opened?.sessionId ?? null
  const isImported = importOutcome?.kind === "ok"

  // 開いたアーカイブの作業を、ウィザードを閉じたとき・別のファイルに替えたときに閉じる。
  // 取り込みに成功したら main が閉じているが、閉じ直しても害は無い
  useEffect(() => {
    if (sessionId === null || isImported) return
    return () => {
      void closeUnifiedArchive(sessionId).catch(() => {
        // 閉じられなくても main の終了時に消える
      })
    }
  }, [sessionId, isImported])

  const decisions = useMemo<UnifiedArchiveImportDecisions>(
    () => ({
      conflictIdChoice,
      conflictIdOverrides,
      matches: Object.fromEntries(
        Object.entries(matchDecisions).map(([rowKey, decision]) => [
          rowKey,
          decisionForAction(decision, action),
        ])
      ),
    }),
    [action, conflictIdChoice, conflictIdOverrides, matchDecisions]
  )
  const requestKey = JSON.stringify({ sessionId, action, decisions })
  const isAnalysisCurrent = analysis?.requestKey === requestKey

  const selectFile = async () => {
    setError(null)
    let archivePath: string | null
    try {
      archivePath = await selectUnifiedArchiveImportFile()
    } catch (selectError) {
      setError(errorMessageOf(selectError))
      return
    }
    if (archivePath === null) return

    setIsProcessing(true)
    try {
      const openResult = await openUnifiedArchive(archivePath)
      if (openResult.kind === "rejected") {
        setOpened(null)
        setRejection(openResult)
        return
      }
      setRejection(null)
      setOpened(openResult)
      setMatchDecisions({ ...openResult.suggestedDecisions })
      setConflictIdChoiceState("existing")
      setConflictIdOverrides({})
      setAnalysis(null)
      setStep("overview")
    } catch (openError) {
      setError(errorMessageOf(openError))
    } finally {
      setIsProcessing(false)
    }
  }

  /** 今の決定で試し取り込みをする（同じ決定の結果があればやり直さない）。成否を返す */
  const analyze = async (): Promise<boolean> => {
    if (opened === null) return false
    if (isAnalysisCurrent) return true
    setIsProcessing(true)
    setError(null)
    try {
      const outcome = await analyzeUnifiedArchiveImport({
        sessionId: opened.sessionId,
        action,
        decisions,
      })
      setAnalysis({ requestKey, outcome })
      return true
    } catch (analyzeError) {
      setError(errorMessageOf(analyzeError))
      return false
    } finally {
      setIsProcessing(false)
    }
  }

  const runImport = async () => {
    if (opened === null) return
    setStep("execute")
    setIsProcessing(true)
    setError(null)
    try {
      const outcome = await importArchive.mutateAsync({
        sessionId: opened.sessionId,
        action,
        decisions,
      })
      if (outcome.kind === "unresolvable") {
        // 試し取り込みの後に取り込み先が変わった。確認の段へ戻して理由を見せる
        setAnalysis({ requestKey, outcome })
        setStep("confirm")
        return
      }
      setImportOutcome(outcome)
      onComplete?.()
    } catch (importError) {
      setError(errorMessageOf(importError))
    } finally {
      setIsProcessing(false)
    }
  }

  const goNext = async () => {
    switch (step) {
      case "fileSelect":
        if (opened !== null) setStep("overview")
        return
      case "overview":
        setStep("match")
        return
      case "match":
        if (await analyze()) setStep("conflict")
        return
      case "conflict":
        if (await analyze()) setStep("confirm")
        return
      case "confirm":
        await runImport()
        return
      case "execute":
        return
    }
  }

  const goBack = () => {
    setError(null)
    switch (step) {
      case "overview":
        setStep("fileSelect")
        return
      case "match":
        setStep("overview")
        return
      case "conflict":
        setStep("match")
        return
      case "confirm":
        setStep("conflict")
        return
      default:
        return
    }
  }

  const setMatchDecision = (rowKey: string, decision: ArchiveMatchDecision) =>
    setMatchDecisions((prev) => ({ ...prev, [rowKey]: decision }))

  /** 一括の id を選ぶ。1件ずつの切り替えは捨てて、全件をこの選択に揃える */
  const setConflictIdChoice = (choice: ArchiveIdChoice) => {
    setConflictIdChoiceState(choice)
    setConflictIdOverrides({})
  }

  const setConflictIdOverride = (rowKey: string, choice: ArchiveIdChoice) =>
    setConflictIdOverrides((prev) => ({ ...prev, [rowKey]: choice }))

  return {
    step,
    opened,
    rejection,
    action,
    setAction,
    matchDecisions,
    setMatchDecision,
    conflictIdChoice,
    setConflictIdChoice,
    conflictIdOverrides,
    setConflictIdOverride,
    /** 最後の試し取り込み（決定を変えた後は古いことがある） */
    lastAnalysis: analysis?.outcome ?? null,
    isAnalysisCurrent,
    importOutcome,
    isProcessing,
    error,
    clearError: () => setError(null),
    selectFile,
    goNext,
    goBack,
  }
}

export type UnifiedArchiveImportWizardState = ReturnType<
  typeof useUnifiedArchiveImportWizard
>
