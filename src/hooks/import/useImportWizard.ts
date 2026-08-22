"use client"

import { useMutation } from "@tanstack/react-query"
import { useCallback, useState } from "react"

import { useCurrentUser } from "@/contexts/CurrentUserContext"
import {
  analyzeExamArchive,
  convertDatToScore,
  convertHszToScore,
  detectExamScoringConflicts,
  importExamArchiveMutation,
  preMatchExamArchive,
  selectExamArchiveFile,
} from "@/queries/archive"
import type {
  CategoryIdIntegrationConfig,
  FileOverviewData,
  IdChoice,
  IdIntegrationDecision,
  ImportWizardState,
} from "@/types/examArchive.types"
import type { ImportAction } from "@/types/importAction.types"

import { initialState, STEP_ORDER } from "./constants"

/**
 * インポートウィザードの状態管理フック
 *
 * フロー:
 * Step 1 (file_select): ファイル選択
 * Step 2 (file_overview): ファイル概要説明（ID一致数、判断必要数を表示）
 * Step 3 (id_integration): データの統合（レコードのIDをどうするか決める）
 * Step 4 (final_confirm): 最終確認（何が書き換わるかを読み取り専用で表示）
 * Step 5 (execute): 実行
 *
 * **ID以外の列をどうするかを選ぶ段は無い。** 値の扱いは Step 2 で選ぶ1つの方針で決まる。
 */
export function useImportWizard() {
  const currentUser = useCurrentUser()
  const { mutateAsync: runImport } = useMutation(importExamArchiveMutation())
  const [state, setState] = useState<ImportWizardState>(initialState)

  // アーカイブ解析 → 事前照合 → file_overview遷移（共通処理）
  const analyzeAndPreMatch = useCallback(async (archivePath: string) => {
    setState((prev) => ({ ...prev, isProcessing: true, error: null }))

    try {
      // アーカイブを解析
      const analyzeResult = await analyzeExamArchive(archivePath)

      // 事前照合を実行
      const fileOverviewData: FileOverviewData =
        await preMatchExamArchive(archivePath)

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
      const result = await selectExamArchiveFile()

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
          ? await convertDatToScore(hszPath)
          : await convertHszToScore(hszPath)

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
      const fileOverviewData = await preMatchExamArchive(state.archivePath)

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

  // 試験ID一致時の扱い（既存試験へ統合する / 別の試験として取り込む）を設定
  const setImportAction = useCallback((action: ImportAction) => {
    setState((prev) => ({
      ...prev,
      idIntegrationConfig: { ...prev.idIntegrationConfig, exam: action },
    }))
  }, [])

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

  // 採点の重なりを数える（id_integration → final_confirm 遷移時に実行）。
  // どう解決するかは取り込みの方針で決まっているので、ここで数えるのは
  // 最終確認に「何件が書き換わるか」を見せるため
  const detectAndAdvanceToFinalConfirm = useCallback(async () => {
    if (!state.archivePath || !state.fileOverviewData) return

    setState((prev) => ({ ...prev, isProcessing: true, error: null }))

    try {
      const scoringConflicts = await detectExamScoringConflicts({
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
          currentStep: "final_confirm",
        }))
      } else {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          currentStep: "final_confirm",
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
    // id_integration → final_confirm は採点の重なりの集計を挟む
    if (state.currentStep === "id_integration") {
      detectAndAdvanceToFinalConfirm()
      return
    }

    setState((prev) => {
      const currentIndex = STEP_ORDER.indexOf(prev.currentStep)
      if (currentIndex < 0 || currentIndex >= STEP_ORDER.length - 1) return prev
      return { ...prev, currentStep: STEP_ORDER[currentIndex + 1] }
    })
  }, [state.currentStep, detectAndAdvanceToFinalConfirm])

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
      const result = await runImport({
        archivePath: state.archivePath,
        preMatchResult: state.fileOverviewData,
        integrationConfig: state.idIntegrationConfig,
        currentUserId: currentUser.id,
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
    currentUser.id,
    runImport,
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
    setImportAction,
    updateIdIntegrationConfig,
    updateIdIntegrationDecision,
    batchUpdateIdIntegrationDecisions,
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
