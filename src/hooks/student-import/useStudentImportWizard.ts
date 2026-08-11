"use client"

import { useCallback, useState } from "react"

import type {
  CategoryIdIntegrationConfig,
  IdChoice,
  IdIntegrationDecision,
  UpdateStrategy,
} from "@/types/examArchive.types"
import type {
  StudentArchiveFileOverviewData,
  StudentImportWizardState,
} from "@/types/studentArchive.types"
import { INITIAL_STUDENT_IMPORT_WIZARD_STATE } from "@/types/studentArchive.types"

export const STUDENT_IMPORT_STEP_ORDER = [
  "file_select",
  "file_overview",
  "id_integration",
  "update_confirm",
  "final_confirm",
  "execute",
] as const

/**
 * 生徒インポートウィザードの状態管理フック
 */
export function useStudentImportWizard() {
  const [state, setState] = useState<StudentImportWizardState>(
    INITIAL_STUDENT_IMPORT_WIZARD_STATE
  )

  // ファイル選択
  const selectFile = useCallback(async () => {
    setState((prev) => ({ ...prev, isProcessing: true, error: null }))

    try {
      const result = await window.electronAPI.studentArchive.selectImportFile()

      if (result.canceled) {
        setState((prev) => ({ ...prev, isProcessing: false }))
        return false
      }

      const archivePath = result.filePath

      // アーカイブ解析
      const manifest = await window.electronAPI.studentArchive.analyzeArchive({
        archivePath,
      })

      // 事前照合
      const fileOverviewData: StudentArchiveFileOverviewData =
        await window.electronAPI.studentArchive.preMatch({ archivePath })

      setState((prev) => ({
        ...prev,
        archivePath,
        manifest,
        fileOverviewData,
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

  // フィールド更新決定を設定
  const setFieldUpdateDecision = useCallback(
    (key: string, field: string, strategy: UpdateStrategy) => {
      setState((prev) => ({
        ...prev,
        updateDecisions: {
          ...prev.updateDecisions,
          [key]: {
            ...(prev.updateDecisions[key] || {}),
            [field]: strategy,
          },
        },
      }))
    },
    []
  )

  // 一括更新戦略を設定
  const setBulkUpdateStrategy = useCallback((strategy: UpdateStrategy) => {
    setState((prev) => {
      const newDecisions = { ...prev.updateDecisions }
      for (const key of Object.keys(newDecisions)) {
        const fields = newDecisions[key]
        const updatedFields = { ...fields }
        for (const field of Object.keys(updatedFields)) {
          updatedFields[field] = strategy
        }
        newDecisions[key] = updatedFields
      }
      return { ...prev, updateDecisions: newDecisions }
    })
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
      const result = await window.electronAPI.studentArchive.import({
        archivePath: state.archivePath,
        preMatchResult: state.fileOverviewData,
        integrationConfig: state.idIntegrationConfig,
        updateDecisions:
          Object.keys(state.updateDecisions).length > 0
            ? state.updateDecisions
            : undefined,
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
      return { success: false, error: errorMessage }
    } finally {
      setState((prev) => ({ ...prev, isProcessing: false }))
    }
  }, [
    state.archivePath,
    state.fileOverviewData,
    state.idIntegrationConfig,
    state.updateDecisions,
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
    setFieldUpdateDecision,
    setBulkUpdateStrategy,
    goToNextStep,
    goBack,
    executeImport,
    reset,
    clearError,
  }
}

export type StudentImportWizard = ReturnType<typeof useStudentImportWizard>
