"use client"

import { useState, useCallback } from "react"
import type {
  ImportWizardState,
  ImportWizardStep,
  ImportMode,
  MatchingConfig,
  ConflictResolutions,
  CategoryConflictResolution,
  ConflictCategory,
} from "@/types/projectArchive.types"
import { useAuth } from "@/contexts/AuthContext"

/**
 * インポートウィザードの状態管理フック
 */
export function useImportWizard() {
  const { user } = useAuth()
  const [state, setState] = useState<ImportWizardState>({
    currentStep: "file_select",
    archivePath: null,
    manifest: null,
    mode: null,
    matchingConfig: {
      student: "studentId",
      class: "name",
      user: "username",
      project: "always_new",
      subtotalGroup: "name",
    },
    conflictDetectionResult: null,
    conflictResolutions: {},
    isProcessing: false,
    error: null,
  })

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

      setState((prev) => ({
        ...prev,
        archivePath: result.filePath!,
        manifest: analyzeResult.manifest!,
        isProcessing: false,
        currentStep: "mode_select",
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

  // モード選択
  const selectMode = useCallback((mode: ImportMode) => {
    setState((prev) => ({
      ...prev,
      mode,
      currentStep: mode === "new" ? "execute" : "matching_config",
    }))
  }, [])

  // マッチング設定更新
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

  // 競合検出
  const detectConflicts = useCallback(async () => {
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
          error: result.error || "競合検出に失敗しました",
        }))
        return false
      }

      // デフォルトの競合解決設定を生成
      const defaultResolutions: ConflictResolutions = {}
      for (const categoryResult of result.results || []) {
        if (categoryResult.conflictItems.length > 0) {
          const category = categoryResult.category as ConflictCategory
          defaultResolutions[category] = {
            policy: "timestamp",
          }
        }
      }

      setState((prev) => ({
        ...prev,
        conflictDetectionResult: result,
        conflictResolutions: defaultResolutions,
        isProcessing: false,
        currentStep: "conflict_resolve",
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

  // 競合解決設定更新
  const updateConflictResolution = useCallback(
    (category: ConflictCategory, resolution: CategoryConflictResolution) => {
      setState((prev) => ({
        ...prev,
        conflictResolutions: {
          ...prev.conflictResolutions,
          [category]: resolution,
        },
      }))
    },
    []
  )

  // 実行へ進む
  const proceedToExecute = useCallback(() => {
    setState((prev) => ({ ...prev, currentStep: "execute" }))
  }, [])

  // インポート実行（新規作成モード）
  const executeImportAsNew = useCallback(async () => {
    if (!state.archivePath) return null
    if (!user?.id) {
      setState((prev) => ({
        ...prev,
        error: "ログインが必要です",
      }))
      return null
    }

    setState((prev) => ({ ...prev, isProcessing: true, error: null }))

    try {
      const result = await window.electronAPI.archive.importAsNew({
        archivePath: state.archivePath,
        currentUserId: user.id,
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
  }, [state.archivePath, user?.id])

  // インポート実行（マージモード）
  const executeMergeImport = useCallback(async () => {
    if (!state.archivePath) return null
    if (!user?.id) {
      setState((prev) => ({
        ...prev,
        error: "ログインが必要です",
      }))
      return null
    }

    setState((prev) => ({ ...prev, isProcessing: true, error: null }))

    try {
      const result = await window.electronAPI.archive.mergeImport({
        archivePath: state.archivePath,
        matchingConfig: state.matchingConfig,
        conflictResolutions: state.conflictResolutions,
        currentUserId: user.id,
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
    state.matchingConfig,
    state.conflictResolutions,
    user?.id,
  ])

  // ステップを戻る
  const goBack = useCallback(() => {
    setState((prev) => {
      const stepOrder: ImportWizardStep[] = [
        "file_select",
        "mode_select",
        "matching_config",
        "conflict_resolve",
        "execute",
      ]
      const currentIndex = stepOrder.indexOf(prev.currentStep)

      if (currentIndex <= 0) return prev

      // 新規作成モードの場合、mode_selectに戻る
      if (prev.mode === "new" && prev.currentStep === "execute") {
        return { ...prev, currentStep: "mode_select" }
      }

      return { ...prev, currentStep: stepOrder[currentIndex - 1] }
    })
  }, [])

  // リセット
  const reset = useCallback(() => {
    setState({
      currentStep: "file_select",
      archivePath: null,
      manifest: null,
      mode: null,
      matchingConfig: {
        student: "studentId",
        class: "name",
        user: "username",
        project: "always_new",
        subtotalGroup: "name",
      },
      conflictDetectionResult: null,
      conflictResolutions: {},
      isProcessing: false,
      error: null,
    })
  }, [])

  // エラーをクリア
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  return {
    state,
    selectFile,
    selectMode,
    updateMatchingConfig,
    detectConflicts,
    updateConflictResolution,
    proceedToExecute,
    executeImportAsNew,
    executeMergeImport,
    goBack,
    reset,
    clearError,
  }
}

export type UseImportWizardReturn = ReturnType<typeof useImportWizard>
