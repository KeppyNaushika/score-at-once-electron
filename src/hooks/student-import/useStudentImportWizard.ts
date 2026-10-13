"use client"

import { useMutation } from "@tanstack/react-query"
import { useCallback, useRef, useState } from "react"

import {
  analyzeStudentArchive,
  importStudentArchiveMutation,
  preMatchStudentArchive,
  selectStudentArchiveFile,
} from "@/queries/archive"
import type {
  CategoryIdIntegrationConfig,
  IdChoice,
  IdIntegrationDecision,
} from "@/types/examArchive.types"
import type { ImportAction } from "@/types/importAction.types"
import type {
  StudentArchiveImportResult,
  StudentImportWizardState,
} from "@/types/studentArchive.types"
import { INITIAL_STUDENT_IMPORT_WIZARD_STATE } from "@/types/studentArchive.types"

export const STUDENT_IMPORT_STEP_ORDER = [
  "file_select",
  "file_overview",
  "id_integration",
  "final_confirm",
  "execute",
] as const

/**
 * 実行の段の結果。失敗はここに持ち、ウィザード全体のエラー（`state.error`。上部の帯）には
 * 載せない（帯の ✕ で消すと結果も消え、実行中の表示に戻って止まっていた）
 */
type StudentImportOutcome =
  | { kind: "ok"; result: StudentArchiveImportResult }
  | { kind: "failed"; error: string }

/** .students を読み、「内容確認」に要るもの（manifest と事前照合）を揃える */
const loadStudentArchive = async (archivePath: string) => {
  const manifest = await analyzeStudentArchive(archivePath)
  const fileOverviewData = await preMatchStudentArchive(archivePath)
  return { archivePath, manifest, fileOverviewData }
}

/**
 * 一覧の「読み込み」で選んだファイルを読み、ウィザードを「内容確認」から始める状態を作る
 * （ファイル選択の段を飛ばす）。読めなければ例外（ウィザードは開かない）
 */
export async function openStudentImportFile(
  archivePath: string
): Promise<StudentImportWizardState> {
  return {
    ...INITIAL_STUDENT_IMPORT_WIZARD_STATE,
    ...(await loadStudentArchive(archivePath)),
    currentStep: "file_overview",
  }
}

/**
 * 生徒インポートウィザードの状態管理フック
 *
 * 一覧の「読み込み」から開くときは、`openStudentImportFile` で作った状態から始める。
 * ファイル選択の段は、戻って選び直すときに使う。
 */
export function useStudentImportWizard(
  startState: StudentImportWizardState = INITIAL_STUDENT_IMPORT_WIZARD_STATE
) {
  const { mutateAsync: runImport } = useMutation(importStudentArchiveMutation())
  const [state, setState] = useState<StudentImportWizardState>(startState)
  const [importOutcome, setImportOutcome] =
    useState<StudentImportOutcome | null>(null)
  // 取り込みは1つのウィザードで1回だけ。実行の段を作り直しても（StrictMode の再実行でも）
  // 同じアーカイブを二度取り込まない
  const hasExecutedRef = useRef(false)

  // ファイル選択
  const selectFile = useCallback(async () => {
    setState((prev) => ({ ...prev, isProcessing: true, error: null }))

    try {
      const result = await selectStudentArchiveFile()

      if (result.canceled) {
        setState((prev) => ({ ...prev, isProcessing: false }))
        return false
      }

      // アーカイブ解析と事前照合
      const loaded = await loadStudentArchive(result.filePath)

      setState((prev) => ({
        ...prev,
        ...loaded,
        isProcessing: false,
        currentStep: "file_overview",
      }))

      return true
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : "エラーが発生しました",
      }))
      return false
    }
  }, [])

  // ID統合設定を更新
  const updateIdIntegrationConfig = useCallback(
    (
      category: "student" | "classroom",
      config: Partial<CategoryIdIntegrationConfig>
    ) => {
      setState((prev) => ({
        ...prev,
        idIntegrationConfig: {
          ...prev.idIntegrationConfig,
          [category]: {
            ...prev.idIntegrationConfig[category],
            ...config,
          },
        },
      }))
    },
    []
  )

  // 個別のID統合決定を更新
  const updateIdIntegrationDecision = useCallback(
    (
      category: "student" | "classroom",
      importId: string,
      decision: Partial<IdIntegrationDecision>
    ) => {
      setState((prev) => {
        const currentConfig = prev.idIntegrationConfig[category]
        const existingIndex = currentConfig.decisions.findIndex(
          (d) => d.importId === importId
        )
        const newDecisions = [...currentConfig.decisions]

        if (existingIndex >= 0) {
          newDecisions[existingIndex] = {
            ...newDecisions[existingIndex],
            ...decision,
          }
        } else {
          newDecisions.push({
            importId,
            decisionType: "same_person",
            ...decision,
          } as IdIntegrationDecision)
        }

        return {
          ...prev,
          idIntegrationConfig: {
            ...prev.idIntegrationConfig,
            [category]: {
              ...currentConfig,
              decisions: newDecisions,
            },
          },
        }
      })
    },
    []
  )

  // 一括ID選択更新
  const batchUpdateIdIntegrationDecisions = useCallback(
    (category: "student" | "classroom", idChoice: IdChoice) => {
      setState((prev) => {
        const currentConfig = prev.idIntegrationConfig[category]
        const newDecisions = currentConfig.decisions.map((decision) => ({
          ...decision,
          idChoice:
            decision.decisionType === "same_person"
              ? idChoice
              : decision.idChoice,
        }))
        return {
          ...prev,
          idIntegrationConfig: {
            ...prev.idIntegrationConfig,
            [category]: { ...currentConfig, decisions: newDecisions },
          },
        }
      })
    },
    []
  )

  // 取り込みの方針（上書きする / 統合する / 別で追加する）を設定
  const setImportAction = useCallback((action: ImportAction) => {
    setState((prev) => ({ ...prev, action }))
  }, [])

  // 次のステップへ
  const goToNextStep = useCallback(() => {
    setState((prev) => {
      const currentIndex = STUDENT_IMPORT_STEP_ORDER.indexOf(
        prev.currentStep as (typeof STUDENT_IMPORT_STEP_ORDER)[number]
      )
      if (currentIndex < STUDENT_IMPORT_STEP_ORDER.length - 1) {
        return {
          ...prev,
          currentStep: STUDENT_IMPORT_STEP_ORDER[currentIndex + 1],
        }
      }
      return prev
    })
  }, [])

  // 前のステップへ（実行の段からは戻らない。戻って「実行」を押すと二重に取り込む）
  const goBack = useCallback(() => {
    setState((prev) => {
      const currentIndex = STUDENT_IMPORT_STEP_ORDER.indexOf(
        prev.currentStep as (typeof STUDENT_IMPORT_STEP_ORDER)[number]
      )
      if (currentIndex > 0 && prev.currentStep !== "execute") {
        return {
          ...prev,
          currentStep: STUDENT_IMPORT_STEP_ORDER[currentIndex - 1],
          error: null,
        }
      }
      return prev
    })
  }, [])

  // インポート実行。結果（成功・失敗）は importOutcome に持ち、返り値でも返す
  const executeImport =
    useCallback(async (): Promise<StudentImportOutcome | null> => {
      if (hasExecutedRef.current) return null
      hasExecutedRef.current = true

      const settle = (outcome: StudentImportOutcome) => {
        setImportOutcome(outcome)
        return outcome
      }

      // 「内容確認」に進めた時点で両方そろっている。欠けていたら実行中のまま待たせず失敗にする
      if (!state.archivePath || !state.fileOverviewData) {
        return settle({
          kind: "failed",
          error:
            "取り込むファイルが読み込まれていません。閉じてから、もう一度ファイルを選んでください。",
        })
      }

      setState((prev) => ({ ...prev, isProcessing: true, error: null }))
      try {
        const result = await runImport({
          archivePath: state.archivePath,
          preMatchResult: state.fileOverviewData,
          integrationConfig: state.idIntegrationConfig,
          action: state.action,
        })
        return settle({ kind: "ok", result })
      } catch (error) {
        return settle({
          kind: "failed",
          error:
            error instanceof Error ? error.message : "取り込みに失敗しました",
        })
      } finally {
        setState((prev) => ({ ...prev, isProcessing: false }))
      }
    }, [
      state.archivePath,
      state.fileOverviewData,
      state.idIntegrationConfig,
      state.action,
      runImport,
    ])

  // リセット
  const reset = useCallback(() => {
    setState(INITIAL_STUDENT_IMPORT_WIZARD_STATE)
    setImportOutcome(null)
    hasExecutedRef.current = false
  }, [])

  // エラーをクリア
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  return {
    state,
    importOutcome,
    selectFile,
    updateIdIntegrationConfig,
    updateIdIntegrationDecision,
    batchUpdateIdIntegrationDecisions,
    setImportAction,
    goToNextStep,
    goBack,
    executeImport,
    reset,
    clearError,
  }
}

export type StudentImportWizard = ReturnType<typeof useStudentImportWizard>
