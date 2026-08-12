"use client"

import { useCallback, useState } from "react"

import { useAuth } from "@/contexts/AuthContext"
import type {
  CategoryIdIntegrationConfig,
  FileOverviewData,
  IdChoice,
  IdIntegrationDecision,
  ImportWizardState,
  ScoringConflictResolutionStrategy,
  UpdateStrategy,
} from "@/types/examArchive.types"

import { initialState, STEP_ORDER } from "./constants"

/**
 * インポートウィザードの状態管理フック
 *
 * フロー:
 * Step 1 (file_select): ファイル選択
 * Step 2 (file_overview): ファイル概要説明（ID一致数、判断必要数を表示）
 * Step 3 (id_integration): データの統合（レコードのIDをどうするか決める）
 * Step 4 (update_confirm): データの更新（ID以外のカラムをどうするか決める）
 * Step 5 (final_confirm): 最終確認
 * Step 6 (execute): 実行
 */
export function useImportWizard() {
  const { user } = useAuth()
  const [state, setState] = useState<ImportWizardState>(initialState)

  // アーカイブ解析 → 事前照合 → file_overview遷移（共通処理）
  const analyzeAndPreMatch = useCallback(async (archivePath: string) => {
    setState((prev) => ({ ...prev, isProcessing: true, error: null }))

    try {
      // アーカイブを解析
      const analyzeResult = await window.electronAPI.archive.analyzeArchive({
        archivePath,
      })

      // 事前照合を実行
      const fileOverviewData: FileOverviewData =
        await window.electronAPI.archive.preMatch({ archivePath })

      setState((prev) => ({
        ...prev,
        archivePath,
        manifest: analyzeResult.manifest,
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

  // ファイル選択
  const selectFile = useCallback(async () => {
    setState((prev) => ({ ...prev, isProcessing: true, error: null }))

    try {
      const result = await window.electronAPI.archive.selectImportFile()

      if (result.canceled) {
        setState((prev) => ({ ...prev, isProcessing: false }))
        return false
      }

      // .hsz/.datファイルの場合は免責事項モーダルを表示して停止
      if (result.sourceFormat === "hsz" || result.sourceFormat === "dat") {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          sourceFormat: result.sourceFormat,
          showHszDisclaimer: true,
          hszOriginalPath: result.filePath,
        }))
        return true
      }

      // .scoreファイルの場合は従来通り解析→事前照合
      return await analyzeAndPreMatch(result.filePath)
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : "エラーが発生しました",
      }))
      return false
    }
  }, [analyzeAndPreMatch])

  // .hsz免責事項を承認して変換開始
  const acceptHszDisclaimer = useCallback(async () => {
    const hszPath = state.hszOriginalPath
    if (!hszPath) return false

    setState((prev) => ({
      ...prev,
      isProcessing: true,
      showHszDisclaimer: false,
      error: null,
    }))

    try {
      // 外部フォーマット → .score 変換
      const convertResult =
        state.sourceFormat === "dat"
          ? await window.electronAPI.archive.convertDatToScore({
              datPath: hszPath,
            })
          : await window.electronAPI.archive.convertHszToScore({ hszPath })

      setState((prev) => ({
        ...prev,
        hszOriginalTitle: convertResult.originalTitle,
        // 外部フォーマット時は小計グループ戦略を by_name にデフォルト設定
        idIntegrationConfig: {
          ...prev.idIntegrationConfig,
          subtotalGroup: { strategy: "by_name", decisions: [] },
        },
      }))

      // 変換後の.scoreファイルで解析→事前照合
      return await analyzeAndPreMatch(convertResult.scorePath)
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : "エラーが発生しました",
      }))
      return false
    }
  }, [state.hszOriginalPath, state.sourceFormat, analyzeAndPreMatch])

  // .hsz免責事項をキャンセル
  const dismissHszDisclaimer = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showHszDisclaimer: false,
      sourceFormat: undefined,
      hszOriginalPath: undefined,
    }))
  }, [])

  // 事前照合を実行（Step 2で使用）
  const performPreMatching = useCallback(async () => {
    if (!state.archivePath) return false

    setState((prev) => ({ ...prev, isProcessing: true, error: null }))

    try {
      const fileOverviewData = await window.electronAPI.archive.preMatch({
        archivePath: state.archivePath,
      })

      setState((prev) => ({
        ...prev,
        fileOverviewData,
        isProcessing: false,
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
  }, [state.archivePath])

  /** カテゴリキーの型（subtotalMappingsを除く） */
  type IdIntegrationCategoryKey = "student" | "classroom" | "subtotalGroup"

  // ID統合設定を更新
  const updateIdIntegrationConfig = useCallback(
    (
      category: IdIntegrationCategoryKey,
      config: CategoryIdIntegrationConfig
    ) => {
      setState((prev) => ({
        ...prev,
        idIntegrationConfig: {
          ...prev.idIntegrationConfig,
          [category]: config,
        },
      }))
    },
    []
  )

  // 個別のID統合決定を更新
  const updateIdIntegrationDecision = useCallback(
    (
      category: IdIntegrationCategoryKey,
      importId: string,
      decision: IdIntegrationDecision
    ) => {
      setState((prev) => {
        const currentConfig = prev.idIntegrationConfig[category]
        const existingDecisions = currentConfig.decisions.filter(
          (d) => d.importId !== importId
        )
        return {
          ...prev,
          idIntegrationConfig: {
            ...prev.idIntegrationConfig,
            [category]: {
              ...currentConfig,
              decisions: [...existingDecisions, decision],
            },
          },
        }
      })
    },
    []
  )

  // ID統合決定を一括更新（一括ID選択用）
  const batchUpdateIdIntegrationDecisions = useCallback(
    (
      category: IdIntegrationCategoryKey,
      items: Array<{ importId: string; existingId: string }>,
      decisionType: "same_person" | "create_new" | "skip",
      idChoice?: IdChoice
    ) => {
      setState((prev) => {
        const currentConfig = prev.idIntegrationConfig[category]
        const newDecisions = items.map((item) => ({
          importId: item.importId,
          decisionType,
          existingId: item.existingId,
          idChoice,
        }))
        const targetIds = new Set(items.map((item) => item.importId))
        const otherDecisions = currentConfig.decisions.filter(
          (decision) => !targetIds.has(decision.importId)
        )
        return {
          ...prev,
          idIntegrationConfig: {
            ...prev.idIntegrationConfig,
            [category]: {
              ...currentConfig,
              decisions: [...otherDecisions, ...newDecisions],
            },
          },
        }
      })
    },
    []
  )

  // フィールド単位の更新決定を設定
  const setFieldUpdateDecision = useCallback(
    (itemKey: string, field: string, strategy: UpdateStrategy) => {
      setState((prev) => ({
        ...prev,
        updateDecisions: {
          ...prev.updateDecisions,
          [itemKey]: {
            ...prev.updateDecisions[itemKey],
            [field]: strategy,
          },
        },
      }))
    },
    []
  )

  // カテゴリ一括の更新戦略を設定
  const setBulkUpdateStrategy = useCallback(
    (itemKeys: string[], fields: string[], strategy: UpdateStrategy) => {
      setState((prev) => {
        const newDecisions = { ...prev.updateDecisions }
        for (const key of itemKeys) {
          const existing = newDecisions[key] || {}
          const updated = { ...existing }
          for (const field of fields) {
            updated[field] = strategy
          }
          newDecisions[key] = updated
        }
        return {
          ...prev,
          updateDecisions: newDecisions,
        }
      })
    },
    []
  )

  // 採点競合解決の方針を設定
  const setScoringConflictStrategy = useCallback(
    (strategy: ScoringConflictResolutionStrategy) => {
      setState((prev) => ({
        ...prev,
        scoringConflictConfig: {
          ...prev.scoringConflictConfig,
          strategy,
        },
      }))
    },
    []
  )

  // 採点競合の個別解決を設定
  const setScoringConflictResolution = useCallback(
    (conflictId: string, resolution: "import" | "existing") => {
      setState((prev) => ({
        ...prev,
        scoringConflictConfig: {
          ...prev.scoringConflictConfig,
          manualResolutions: {
            ...prev.scoringConflictConfig.manualResolutions,
            [conflictId]: resolution,
          },
        },
      }))
    },
    []
  )

  // 小計項目の直接マッピングを更新
  const updateSubtotalMapping = useCallback(
    (importSubtotalId: string, targetId: string) => {
      setState((prev) => ({
        ...prev,
        idIntegrationConfig: {
          ...prev.idIntegrationConfig,
          subtotalMappings: {
            ...prev.idIntegrationConfig.subtotalMappings,
            [importSubtotalId]: targetId,
          },
        },
      }))
    },
    []
  )

  // 小計項目の直接マッピングを一括クリア（グループ変更時など）
  const clearSubtotalMappings = useCallback((importSubtotalIds: string[]) => {
    setState((prev) => {
      const currentMappings = { ...prev.idIntegrationConfig.subtotalMappings }
      for (const id of importSubtotalIds) {
        delete currentMappings[id]
      }
      return {
        ...prev,
        idIntegrationConfig: {
          ...prev.idIntegrationConfig,
          subtotalMappings:
            Object.keys(currentMappings).length > 0
              ? currentMappings
              : undefined,
        },
      }
    })
  }, [])

  // 複数の採点競合を一括解決
  const setAllScoringConflictResolutions = useCallback(
    (conflictIds: string[], resolution: "import" | "existing") => {
      setState((prev) => {
        const newResolutions = {
          ...prev.scoringConflictConfig.manualResolutions,
        }
        for (const id of conflictIds) {
          newResolutions[id] = resolution
        }
        return {
          ...prev,
          scoringConflictConfig: {
            ...prev.scoringConflictConfig,
            manualResolutions: newResolutions,
          },
        }
      })
    },
    []
  )

  // 採点競合検出（id_integration → update_confirm 遷移時に実行）
  const detectAndAdvanceToUpdateConfirm = useCallback(async () => {
    if (!state.archivePath || !state.fileOverviewData) return

    setState((prev) => ({ ...prev, isProcessing: true, error: null }))

    try {
      const scoringConflicts =
        await window.electronAPI.archive.detectScoringConflicts({
          archivePath: state.archivePath,
          preMatchResult: state.fileOverviewData,
          integrationConfig: state.idIntegrationConfig,
        })

      if (scoringConflicts) {
        setState((prev) => ({
          ...prev,
          fileOverviewData: prev.fileOverviewData
            ? { ...prev.fileOverviewData, scoringConflicts }
            : prev.fileOverviewData,
          isProcessing: false,
          currentStep: "update_confirm",
        }))
      } else {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          currentStep: "update_confirm",
        }))
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error:
          error instanceof Error
            ? error.message
            : "採点競合の検出中にエラーが発生しました",
      }))
    }
  }, [state.archivePath, state.fileOverviewData, state.idIntegrationConfig])

  // 次のステップへ進む
  const goToNextStep = useCallback(() => {
    // id_integration → update_confirm は採点競合検出を挟む
    if (state.currentStep === "id_integration") {
      detectAndAdvanceToUpdateConfirm()
      return
    }

    setState((prev) => {
      const currentIndex = STEP_ORDER.indexOf(prev.currentStep)
      if (currentIndex < 0 || currentIndex >= STEP_ORDER.length - 1) return prev
      return { ...prev, currentStep: STEP_ORDER[currentIndex + 1] }
    })
  }, [state.currentStep, detectAndAdvanceToUpdateConfirm])

  // ステップを戻る
  const goBack = useCallback(() => {
    setState((prev) => {
      const currentIndex = STEP_ORDER.indexOf(prev.currentStep)
      if (currentIndex <= 0) return prev
      return { ...prev, currentStep: STEP_ORDER[currentIndex - 1] }
    })
  }, [])

  // インポート実行
  const executeImport = useCallback(async () => {
    if (!state.archivePath) return null
    if (!user?.id) {
      setState((prev) => ({
        ...prev,
        error: "ログインが必要です",
      }))
      return null
    }
    if (!state.fileOverviewData) {
      setState((prev) => ({
        ...prev,
        error: "事前照合データがありません",
      }))
      return null
    }

    setState((prev) => ({ ...prev, isProcessing: true, error: null }))

    try {
      // ID統合インポートを実行
      const result = await window.electronAPI.archive.idIntegrationImport({
        archivePath: state.archivePath,
        preMatchResult: state.fileOverviewData,
        integrationConfig: state.idIntegrationConfig,
        currentUserId: user.id,
        scoringConflictConfig: state.scoringConflictConfig,
        updateDecisions: state.updateDecisions,
      })

      setState((prev) => ({ ...prev, isProcessing: false }))

      return result
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : "エラーが発生しました",
      }))
      return null
    }
  }, [
    state.archivePath,
    state.fileOverviewData,
    state.idIntegrationConfig,
    state.scoringConflictConfig,
    state.updateDecisions,
    user?.id,
  ])

  // リセット
  const reset = useCallback(() => {
    setState(initialState)
  }, [])

  // エラーをクリア
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  return {
    state,
    selectFile,
    performPreMatching,
    updateIdIntegrationConfig,
    updateIdIntegrationDecision,
    batchUpdateIdIntegrationDecisions,
    setFieldUpdateDecision,
    setBulkUpdateStrategy,
    setScoringConflictStrategy,
    setScoringConflictResolution,
    setAllScoringConflictResolutions,
    acceptHszDisclaimer,
    dismissHszDisclaimer,
    updateSubtotalMapping,
    clearSubtotalMappings,

    goToNextStep,
    goBack,
    executeImport,
    reset,
    clearError,
  }
}

export type UseImportWizardReturn = ReturnType<typeof useImportWizard>
