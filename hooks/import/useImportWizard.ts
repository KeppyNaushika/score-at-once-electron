"use client"

import { useCallback, useState } from "react"

import { useAuth } from "@/contexts/AuthContext"
import type {
  CategoryIdIntegrationConfig,
  CategoryMatchingSummary,
  FileOverviewData,
  IdIntegrationConfig,
  IdIntegrationDecision,
  ImportWizardState,
  ImportWizardStep,
  MatchingConfig,
  MatchingDecisionType,
  ScoringConflictConfig,
  ScoringConflictResolutionStrategy,
} from "@/types/projectArchive.types"

/**
 * インポートウィザードの初期状態
 */
const initialState: ImportWizardState = {
  currentStep: "file_select",
  archivePath: null,
  manifest: null,
  fileOverviewData: null,
  idIntegrationConfig: {
    student: { strategy: "by_student_number", decisions: [] },
    class: { strategy: "by_name", decisions: [] },
    subtotalGroup: { strategy: "by_name", decisions: [] },
  },
  scoringConflictConfig: {
    strategy: "newer_wins",
    manualResolutions: {},
  },
  matchingConfig: {
    student: "studentNumber",
    class: "name",
    user: "username",
    project: "always_new",
    subtotalGroup: "name",
  },
  isProcessing: false,
  error: null,
  matchingSummaries: [],
  matchingDecisions: {},
  updateDecisions: {},
}

/**
 * ステップの順序
 * file_select → file_overview → id_integration → scoring_conflict → update_confirm → final_confirm → execute
 */
const STEP_ORDER: ImportWizardStep[] = [
  "file_select",
  "file_overview",
  "id_integration",
  "scoring_conflict",
  "update_confirm",
  "final_confirm",
  "execute",
]

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

  // ファイル選択
  const selectFile = useCallback(async () => {
    setState((prev) => ({ ...prev, isProcessing: true, error: null }))

    try {
      const result = await window.electronAPI.archive.selectImportFile()

      if (!result.success) {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: result.error || "ファイル選択に失敗しました",
        }))
        return false
      }

      if (result.canceled) {
        setState((prev) => ({ ...prev, isProcessing: false }))
        return false
      }

      // アーカイブを解析
      const analyzeResult = await window.electronAPI.archive.analyzeArchive({
        archivePath: result.filePath!,
      })

      if (!analyzeResult.success) {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: analyzeResult.error || "アーカイブの解析に失敗しました",
        }))
        return false
      }

      // 事前照合を実行
      const preMatchResult = await window.electronAPI.archive.preMatch({
        archivePath: result.filePath!,
      })

      const fileOverviewData: FileOverviewData | null = preMatchResult.success
        ? (preMatchResult.data ?? null)
        : null

      setState((prev) => ({
        ...prev,
        archivePath: result.filePath!,
        manifest: analyzeResult.manifest!,
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

  // 事前照合を実行（Step 2で使用）
  const performPreMatching = useCallback(async () => {
    if (!state.archivePath) return false

    setState((prev) => ({ ...prev, isProcessing: true, error: null }))

    try {
      const result = await window.electronAPI.archive.preMatch({
        archivePath: state.archivePath,
      })

      if (!result.success) {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: result.error || "事前照合に失敗しました",
        }))
        return false
      }

      setState((prev) => ({
        ...prev,
        fileOverviewData: result.data ?? null,
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

  // ID統合設定を更新
  const updateIdIntegrationConfig = useCallback(
    <K extends keyof IdIntegrationConfig>(
      category: K,
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
      category: keyof IdIntegrationConfig,
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

  // マッチング設定更新（後方互換用）
  const updateMatchingConfig = useCallback(
    <K extends keyof MatchingConfig>(key: K, value: MatchingConfig[K]) => {
      setState((prev) => ({
        ...prev,
        matchingConfig: {
          ...prev.matchingConfig,
          [key]: value,
        },
      }))
    },
    []
  )

  // 照合を実行してdata_matchingへ進む（後方互換用）
  const performMatching = useCallback(async () => {
    if (!state.archivePath) return false

    setState((prev) => ({ ...prev, isProcessing: true, error: null }))

    try {
      const result = await window.electronAPI.archive.detectConflicts({
        archivePath: state.archivePath,
        matchingConfig: state.matchingConfig,
      })

      if (!result.success) {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: result.error || "照合に失敗しました",
        }))
        return false
      }

      // 結果をCategoryMatchingSummary形式に変換
      const summaries: CategoryMatchingSummary[] = (result.results || []).map(
        (categoryResult) => ({
          category: categoryResult.category,
          autoMatched: categoryResult.summary.matched,
          newItems: categoryResult.summary.newItems,
          needsConfirmation: categoryResult.summary.conflicts,
          hasConflict: 0,
          autoMatchedItems: [],
          newItemsList: [],
          confirmationItems: categoryResult.conflictItems.map((item) => ({
            ...item,
            fieldChanges: [],
            isImportNewer: false,
            importUpdatedAt: "",
            existingUpdatedAt: "",
            matchReason: "データが一致",
          })),
          conflictItems: [],
        })
      )

      // デフォルトの照合判断を設定（全て「同じ人」）
      const defaultDecisions: Record<string, MatchingDecisionType> = {}
      for (const summary of summaries) {
        for (const item of summary.confirmationItems) {
          defaultDecisions[item.id] = "same_person"
        }
      }

      setState((prev) => ({
        ...prev,
        matchingSummaries: summaries,
        matchingDecisions: defaultDecisions,
        isProcessing: false,
        currentStep: "id_integration",
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
  }, [state.archivePath, state.matchingConfig])

  // 照合判断を設定
  const setMatchingDecision = useCallback(
    (itemId: string, decision: MatchingDecisionType) => {
      setState((prev) => ({
        ...prev,
        matchingDecisions: {
          ...prev.matchingDecisions,
          [itemId]: decision,
        },
      }))
    },
    []
  )

  // 複数の照合判断を一括設定
  const setAllMatchingDecisions = useCallback(
    (itemIds: string[], decision: MatchingDecisionType) => {
      setState((prev) => {
        const newDecisions = { ...prev.matchingDecisions }
        for (const itemId of itemIds) {
          newDecisions[itemId] = decision
        }
        return {
          ...prev,
          matchingDecisions: newDecisions,
        }
      })
    },
    []
  )

  // 更新判断を設定
  const setUpdateDecision = useCallback(
    (itemId: string, shouldUpdate: boolean) => {
      setState((prev) => ({
        ...prev,
        updateDecisions: {
          ...prev.updateDecisions,
          [itemId]: shouldUpdate,
        },
      }))
    },
    []
  )

  // 複数の更新判断を一括設定
  const setAllUpdateDecisions = useCallback(
    (itemIds: string[], shouldUpdate: boolean) => {
      setState((prev) => {
        const newDecisions = { ...prev.updateDecisions }
        for (const itemId of itemIds) {
          newDecisions[itemId] = shouldUpdate
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

  // 複数の採点競合を一括解決
  const setAllScoringConflictResolutions = useCallback(
    (conflictIds: string[], resolution: "import" | "existing") => {
      setState((prev) => {
        const newResolutions = { ...prev.scoringConflictConfig.manualResolutions }
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

  // 採点競合を検出（id_integrationからscoring_conflictへの遷移時に呼び出す）
  const detectScoringConflicts = useCallback(async () => {
    if (!state.archivePath || !state.fileOverviewData) return false

    setState((prev) => ({ ...prev, isProcessing: true, error: null }))

    try {
      const result = await window.electronAPI.archive.detectScoringConflicts({
        archivePath: state.archivePath,
        preMatchResult: state.fileOverviewData,
        integrationConfig: state.idIntegrationConfig,
      })

      if (!result.success) {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: result.error || "採点競合の検出に失敗しました",
        }))
        return false
      }

      // 検出結果をfileOverviewDataに保存してステップを進める
      setState((prev) => ({
        ...prev,
        fileOverviewData: prev.fileOverviewData
          ? {
              ...prev.fileOverviewData,
              scoringConflicts: result.data,
            }
          : null,
        isProcessing: false,
        currentStep: "scoring_conflict",
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
  }, [state.archivePath, state.fileOverviewData, state.idIntegrationConfig])

  // 次のステップへ進む
  const goToNextStep = useCallback(() => {
    setState((prev) => {
      const currentIndex = STEP_ORDER.indexOf(prev.currentStep)
      if (currentIndex < 0 || currentIndex >= STEP_ORDER.length - 1) return prev
      return { ...prev, currentStep: STEP_ORDER[currentIndex + 1] }
    })
  }, [])

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
      })

      setState((prev) => ({ ...prev, isProcessing: false }))

      if (!result.success) {
        setState((prev) => ({
          ...prev,
          error: result.error || "インポートに失敗しました",
        }))
        return null
      }

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
    updateMatchingConfig,
    performMatching,
    setMatchingDecision,
    setAllMatchingDecisions,
    setUpdateDecision,
    setAllUpdateDecisions,
    setScoringConflictStrategy,
    setScoringConflictResolution,
    setAllScoringConflictResolutions,
    detectScoringConflicts,
    goToNextStep,
    goBack,
    executeImport,
    reset,
    clearError,
  }
}

export type UseImportWizardReturn = ReturnType<typeof useImportWizard>
