"use client"

import { useMutation } from "@tanstack/react-query"
import { useCallback, useState } from "react"

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
import type { StudentImportWizardState } from "@/types/studentArchive.types"
import { INITIAL_STUDENT_IMPORT_WIZARD_STATE } from "@/types/studentArchive.types"

export const STUDENT_IMPORT_STEP_ORDER = [
  "file_select",
  "file_overview",
  "id_integration",
  "final_confirm",
  "execute",
] as const

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

  // 前のステップへ
  const goBack = useCallback(() => {
    setState((prev) => {
      const currentIndex = STUDENT_IMPORT_STEP_ORDER.indexOf(
        prev.currentStep as (typeof STUDENT_IMPORT_STEP_ORDER)[number]
      )
      if (currentIndex > 0) {
        return {
          ...prev,
          currentStep: STUDENT_IMPORT_STEP_ORDER[currentIndex - 1],
          error: null,
        }
      }
      return prev
    })
  }, [])

  // インポート実行
  const executeImport = useCallback(async () => {
    if (!state.archivePath || !state.fileOverviewData) return

    setState((prev) => ({ ...prev, isProcessing: true, error: null }))

    try {
      const result = await runImport({
        archivePath: state.archivePath,
        preMatchResult: state.fileOverviewData,
        integrationConfig: state.idIntegrationConfig,
        action: state.action,
      })

      return result
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "インポートに失敗しました"
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: errorMessage,
      }))
      return null
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
  }, [])

  // エラーをクリア
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  return {
    state,
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
