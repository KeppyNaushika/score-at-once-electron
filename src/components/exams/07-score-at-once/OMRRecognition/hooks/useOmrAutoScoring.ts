"use client"

import { useCallback, useEffect, useState } from "react"

import type { ComputedCell } from "@/types/answerSheetLayout.types"
import type {
  ComputedOMRBubble,
  ComputedOMRDigitBox,
  CropRegionOmrConfigWithOptions,
  OMRBatchProgress,
  OMRCellConfig,
  OMRSheetResult,
} from "@/types/omr.types"
import type { CropRegionWithDetails } from "@/types/prismaExtensions"

import {
  type AutoScoreEntry,
  recommendAreaThreshold,
  reevaluateWithThreshold,
  type ScoringResultSummary,
} from "../utils/reevaluateResults"

export interface OmrAutoScoringState {
  /** OMR設定リスト */
  omrConfigs: CropRegionOmrConfigWithOptions[]
  /** 認識処理中か */
  isRecognizing: boolean
  /** 採点反映中か */
  isApplying: boolean
  /** バッチ進捗 */
  progress: OMRBatchProgress | null
  /** 認識結果（生徒ごと） */
  sheetResults: OMRSheetResult[]
  /** 初回バッチの不変コピー（閾値再評価のソース） */
  originalSheetResults: OMRSheetResult[]
  /** 自動採点エントリ（全生徒分） */
  scoreEntries: Map<string, AutoScoreEntry[]>
  /** 結果サマリー */
  summary: ScoringResultSummary | null
  /** エラー */
  error: string | null
  /** 塗りつぶし判定閾値 */
  areaThreshold: number
  /** 信頼度閾値 */
  confidenceThreshold: number
  /** 配点マップ（cropRegionId → points） */
  pointsMap: Record<string, number>
  /** 推奨areaThreshold */
  recommendedAreaThreshold: number | null
}

/**
 * OMR自動採点のパイプラインを管理するフック
 */
export function useOmrAutoScoring(examId: string) {
  const [state, setState] = useState<OmrAutoScoringState>({
    omrConfigs: [],
    isRecognizing: false,
    isApplying: false,
    progress: null,
    sheetResults: [],
    originalSheetResults: [],
    scoreEntries: new Map(),
    summary: null,
    error: null,
    areaThreshold: 0.4,
    confidenceThreshold: 0.7,
    pointsMap: {},
    recommendedAreaThreshold: null,
  })

  /** OMR設定をDBから読み込み */
  const loadOmrConfigs = useCallback(async () => {
    try {
      const result = await window.electronAPI.omrConfig.getByExam(examId)
      if (result.success && result.configs) {
        setState((s) => ({ ...s, omrConfigs: result.configs!, error: null }))
        return result.configs
      }
      setState((s) => ({
        ...s,
        omrConfigs: [],
        error: result.error ?? "OMR設定が見つかりません",
      }))
      return []
    } catch (error) {
      setState((s) => ({
        ...s,
        error: error instanceof Error ? error.message : "OMR設定の取得に失敗",
      }))
      return []
    }
  }, [examId])

  /** マウント時にOMR設定を読み込み */
  useEffect(() => {
    loadOmrConfigs()
  }, [loadOmrConfigs])

  /** バッチ進捗リスナー */
  useEffect(() => {
    const unsubscribe = window.electronAPI.omr.onBatchProgress((progress) => {
      setState((s) => ({ ...s, progress }))
    })
    return unsubscribe
  }, [])

  /**
   * OMR認識実行
   * CropRegionOmrConfigからOMRCellConfigへの変換→バッチ認識→自動採点
   */
  const runRecognition = useCallback(async () => {
    setState((s) => ({
      ...s,
      isRecognizing: true,
      sheetResults: [],
      scoreEntries: new Map(),
      summary: null,
      error: null,
      progress: null,
    }))

    try {
      // 1. OMR設定を取得
      const configs = await loadOmrConfigs()
      if (configs.length === 0) {
        setState((s) => ({
          ...s,
          isRecognizing: false,
          error: "OMR設定がありません",
        }))
        return
      }

      // 2. マスターマーカー検出
      const markerResult =
        await window.electronAPI.omr.detectMasterMarkers(examId)
      if (!markerResult.success || markerResult.pages.length === 0) {
        setState((s) => ({
          ...s,
          isRecognizing: false,
          error: markerResult.error ?? "マーカーを検出できませんでした",
        }))
        return
      }

      // 3. DBからOMR設定を読み込み、cellConfigsを構築
      const cellConfigs: Record<string, OMRCellConfig> = {}
      for (const omrConfig of configs) {
        if (omrConfig.type === "choice") {
          const labels = omrConfig.choiceOptions.map((option) => option.label)
          const correctAnswers = omrConfig.choiceOptions
            .filter((option) => option.isCorrect)
            .map((option) => option.choiceIndex)
          cellConfigs[omrConfig.cropRegionId] = {
            type: "choice",
            numChoices: omrConfig.numChoices ?? labels.length,
            labels,
            correctAnswers,
            layout:
              (omrConfig.choiceLayout as "horizontal" | "vertical") ??
              "horizontal",
          }
        } else if (omrConfig.type === "handwritten-digit") {
          cellConfigs[omrConfig.cropRegionId] = {
            type: "handwritten-digit",
            numDigits: omrConfig.numDigits ?? 1,
            correctAnswer: omrConfig.correctAnswer ?? undefined,
          }
        }
      }
      const recognitionParams = {
        colorThreshold: configs[0].colorThreshold ?? 128,
        areaThreshold: configs[0].areaThreshold ?? 0.4,
        confidenceThreshold: 0.7,
      }

      // 4. 答案画像を取得（全生徒分）
      // ページ1のみ対応（OMR設定はページ1前提）
      const page1 = markerResult.pages.find((page) => page.pageNumber === 1)
      if (!page1 || !page1.result.success) {
        setState((s) => ({
          ...s,
          isRecognizing: false,
          error: "ページ1のマーカーが検出できません",
        }))
        return
      }

      // 期待されるコーナー座標を構築
      const expectedCorners: [
        { x: number; y: number },
        { x: number; y: number },
        { x: number; y: number },
        { x: number; y: number },
      ] = page1.result.markers
        .sort((markerA, markerB) => {
          const cornerOrder = { TL: 0, TR: 1, BL: 2, BR: 3 }
          return (
            cornerOrder[markerA.corner as keyof typeof cornerOrder] -
            cornerOrder[markerB.corner as keyof typeof cornerOrder]
          )
        })
        .map((marker) => ({
          x: marker.centerX / page1.result.imageWidth,
          y: marker.centerY / page1.result.imageHeight,
        })) as [
        { x: number; y: number },
        { x: number; y: number },
        { x: number; y: number },
        { x: number; y: number },
      ]

      // 5. 答案画像パスを収集
      const cropRegions =
        await window.electronAPI.getCropRegionsByExamId(examId)
      const page1Regions = cropRegions.filter(
        (cropRegion) => cropRegion.examPage?.pageNumber === 1
      )
      if (page1Regions.length === 0) {
        setState((s) => ({
          ...s,
          isRecognizing: false,
          error: "ページ1の領域が見つかりません",
        }))
        return
      }

      // 答案画像パス取得（全生徒、ページ1のみフィルタ）
      const allAnswerImages =
        await window.electronAPI.getStudentAnswerImagesByExamId(examId)

      const page1ExamPageId = page1Regions[0]?.examPage?.id
      const answerImages = allAnswerImages.filter(
        (answerImage) => answerImage.examPageId === page1ExamPageId
      )

      if (answerImages.length === 0) {
        setState((s) => ({
          ...s,
          isRecognizing: false,
          error: "答案画像が見つかりません",
        }))
        return
      }

      // 画像パス（DB相対パス）を収集 — メインプロセス側で絶対パスに解決
      const imagePaths = answerImages.map((answerImage) => ({
        path: answerImage.imagePath,
        studentId: answerImage.studentId,
        studentName: answerImage.student
          ? `${answerImage.student.lastName} ${answerImage.student.firstName}`
          : undefined,
      }))

      // 6. バッチ認識実行
      // CropRegion座標 + OMR設定からComputedCellを構築
      const cells = buildCellsFromRegions(page1Regions, configs, cellConfigs)

      const results = await window.electronAPI.omr.batchRecognize({
        imagePaths,
        cells,
        cellConfigs,
        expectedCorners,
        params: recognitionParams,
        pageIndex: 0,
      })

      // 7. 配点マップ構築
      const pointsMap: Record<string, number> = {}
      for (const region of page1Regions) {
        if (region.points != null) {
          pointsMap[region.id] = region.points
        }
      }

      // マーカー検出失敗の診断
      const failedSheets = results.filter((result) => !result.success)
      if (failedSheets.length > 0) {
        console.warn(
          `OMR: ${failedSheets.length}/${results.length} 枚でマーカー検出失敗`,
          failedSheets.map((sheet) => ({
            studentId: sheet.studentId,
            error: sheet.error,
          }))
        )
      }
      const emptyResultSheets = results.filter(
        (result) => result.success && result.cellResults.length === 0
      )
      if (emptyResultSheets.length > 0) {
        console.warn(
          `OMR: ${emptyResultSheets.length}/${results.length} 枚でセル認識結果が空`,
          { cellCount: cells.length, configKeys: Object.keys(cellConfigs) }
        )
      }

      // 再評価ユーティリティで採点結果を構築
      const initialAreaThreshold = recognitionParams.areaThreshold
      const initialConfidenceThreshold =
        recognitionParams.confidenceThreshold ?? 0.7

      const { updatedSheetResults, scoreEntries, summary } =
        reevaluateWithThreshold({
          sheetResults: results,
          omrConfigs: configs,
          pointsMap,
          areaThreshold: initialAreaThreshold,
          confidenceThreshold: initialConfidenceThreshold,
        })

      // 推奨閾値を算出
      const recommended = recommendAreaThreshold(results)

      setState((s) => ({
        ...s,
        isRecognizing: false,
        sheetResults: updatedSheetResults,
        originalSheetResults: results,
        scoreEntries,
        summary,
        pointsMap,
        areaThreshold: initialAreaThreshold,
        confidenceThreshold: initialConfidenceThreshold,
        recommendedAreaThreshold: recommended,
      }))
    } catch (error) {
      setState((s) => ({
        ...s,
        isRecognizing: false,
        error: error instanceof Error ? error.message : "OMR認識に失敗しました",
      }))
    }
  }, [examId, loadOmrConfigs])

  /**
   * 採点結果をQuestionScoreに反映
   */
  const applyScores = useCallback(
    async (userId: string) => {
      setState((s) => ({ ...s, isApplying: true, error: null }))
      try {
        const entries: Array<{
          studentId: string
          cropRegionId: string
          status: string
          partialScore: number | null
          userId: string
        }> = []

        for (const [studentId, scoreEntries] of state.scoreEntries) {
          for (const entry of scoreEntries) {
            entries.push({
              studentId,
              cropRegionId: entry.cropRegionId!,
              status: entry.status,
              partialScore: entry.status === "partial" ? entry.score : null,
              userId,
            })
          }
        }

        if (entries.length === 0) {
          setState((s) => ({
            ...s,
            isApplying: false,
            error: "反映する採点データがありません",
          }))
          return false
        }

        const result =
          await window.electronAPI.batchUpdateQuestionScores(entries)

        if (result.success) {
          setState((s) => ({ ...s, isApplying: false }))
          return true
        }

        setState((s) => ({
          ...s,
          isApplying: false,
          error: result.error ?? "採点反映に失敗しました",
        }))
        return false
      } catch (error) {
        setState((s) => ({
          ...s,
          isApplying: false,
          error:
            error instanceof Error ? error.message : "採点反映に失敗しました",
        }))
        return false
      }
    },
    [state.scoreEntries]
  )

  /** areaThresholdを変更し、キャッシュ済みfillRatiosから即座に再判定 */
  const updateAreaThreshold = useCallback(
    (newThreshold: number) => {
      if (state.originalSheetResults.length === 0) return
      const { updatedSheetResults, scoreEntries, summary } =
        reevaluateWithThreshold({
          sheetResults: state.originalSheetResults,
          omrConfigs: state.omrConfigs,
          pointsMap: state.pointsMap,
          areaThreshold: newThreshold,
          confidenceThreshold: state.confidenceThreshold,
        })
      setState((s) => ({
        ...s,
        areaThreshold: newThreshold,
        sheetResults: updatedSheetResults,
        scoreEntries,
        summary,
      }))
    },
    [
      state.originalSheetResults,
      state.omrConfigs,
      state.pointsMap,
      state.confidenceThreshold,
    ]
  )

  /** confidenceThresholdを変更し、即座に再判定 */
  const updateConfidenceThreshold = useCallback(
    (newThreshold: number) => {
      if (state.originalSheetResults.length === 0) return
      const { updatedSheetResults, scoreEntries, summary } =
        reevaluateWithThreshold({
          sheetResults: state.originalSheetResults,
          omrConfigs: state.omrConfigs,
          pointsMap: state.pointsMap,
          areaThreshold: state.areaThreshold,
          confidenceThreshold: newThreshold,
        })
      setState((s) => ({
        ...s,
        confidenceThreshold: newThreshold,
        sheetResults: updatedSheetResults,
        scoreEntries,
        summary,
      }))
    },
    [
      state.originalSheetResults,
      state.omrConfigs,
      state.pointsMap,
      state.areaThreshold,
    ]
  )

  /** 推奨areaThresholdを適用 */
  const applyRecommendedThreshold = useCallback(() => {
    if (state.recommendedAreaThreshold != null) {
      updateAreaThreshold(state.recommendedAreaThreshold)
    }
  }, [state.recommendedAreaThreshold, updateAreaThreshold])

  return {
    ...state,
    hasOmrConfigs: state.omrConfigs.length > 0,
    runRecognition,
    applyScores,
    updateAreaThreshold,
    updateConfidenceThreshold,
    applyRecommendedThreshold,
  }
}

/**
 * CropRegion座標 + OMR設定からComputedCellを構築
 * DBの正規化座標（0-1）を直接使用し、バブル/数字欄の位置を計算する
 */
function buildCellsFromRegions(
  regions: CropRegionWithDetails[],
  configs: CropRegionOmrConfigWithOptions[],
  cellConfigs: Record<string, OMRCellConfig>
): ComputedCell[] {
  const cells: ComputedCell[] = []

  for (const omrConfig of configs) {
    const region = regions.find(
      (candidateRegion) => candidateRegion.id === omrConfig.cropRegionId
    )
    if (!region) continue

    const config = cellConfigs[omrConfig.cropRegionId]
    if (!config) continue

    const cell: ComputedCell = {
      questionPath: [],
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      normalizedX: region.x,
      normalizedY: region.y,
      normalizedW: region.width,
      normalizedH: region.height,
      label: omrConfig.cropRegionId,
      points: region.points ?? 0,
      cellType: "answer",
      pageIndex: 0,
      textElements: [],
    }

    if (config.type === "choice") {
      // DB保存済みバブル位置を優先、なければ推定計算にフォールバック
      const hasSavedPositions = omrConfig.choiceOptions.some(
        (option) => option.normalizedCx != null
      )
      if (hasSavedPositions) {
        cell.omrBubbles = omrConfig.choiceOptions
          .filter((option) => option.normalizedCx != null)
          .map((option) => ({
            normalizedCx: option.normalizedCx!,
            normalizedCy: option.normalizedCy!,
            normalizedWidth: option.normalizedWidth!,
            normalizedHeight: option.normalizedHeight!,
            choiceIndex: option.choiceIndex,
            label: option.label,
          }))
      } else {
        cell.omrBubbles = computeBubblesFromRegion(region, config)
      }
    } else if (config.type === "handwritten-digit") {
      // DB保存済み数字欄位置を優先、なければ推定計算にフォールバック
      if (omrConfig.digitBoxes && omrConfig.digitBoxes.length > 0) {
        cell.omrDigitBoxes = omrConfig.digitBoxes.map((box) => ({
          normalizedX: box.normalizedX,
          normalizedY: box.normalizedY,
          normalizedW: box.normalizedW,
          normalizedH: box.normalizedH,
          digitIndex: box.digitIndex,
        }))
      } else {
        cell.omrDigitBoxes = computeDigitBoxesFromRegion(region, config)
      }
    }

    cells.push(cell)
  }

  return cells
}

/** CropRegionの正規化座標内にバブル位置を等間隔配置 */
function computeBubblesFromRegion(
  region: CropRegionWithDetails,
  config: OMRCellConfig & { type: "choice" }
): ComputedOMRBubble[] {
  const n = config.numChoices
  const bubbles: ComputedOMRBubble[] = []

  // バブルサイズ: 間隔の60%幅、高さは領域高さの70%（実際の印刷バブルに近似）
  const spacing =
    config.layout === "horizontal"
      ? region.width / (n + 1)
      : region.height / (n + 1)
  const bubbleW = spacing * 0.6
  const bubbleH = Math.min(bubbleW * 1.6, region.height * 0.7)

  if (config.layout === "horizontal") {
    const spacing = region.width / (n + 1)
    const cy = region.y + region.height / 2
    for (let i = 0; i < n; i++) {
      bubbles.push({
        normalizedCx: region.x + spacing * (i + 1),
        normalizedCy: cy,
        normalizedWidth: bubbleW,
        normalizedHeight: bubbleH,
        choiceIndex: i,
        label: config.labels[i] ?? String(i + 1),
      })
    }
  } else {
    const spacing = region.height / (n + 1)
    const cx = region.x + region.width / 2
    for (let i = 0; i < n; i++) {
      bubbles.push({
        normalizedCx: cx,
        normalizedCy: region.y + spacing * (i + 1),
        normalizedWidth: bubbleW,
        normalizedHeight: bubbleH,
        choiceIndex: i,
        label: config.labels[i] ?? String(i + 1),
      })
    }
  }

  return bubbles
}

/** CropRegionの正規化座標内に数字欄を等間隔配置 */
function computeDigitBoxesFromRegion(
  region: CropRegionWithDetails,
  config: OMRCellConfig & { type: "handwritten-digit" }
): ComputedOMRDigitBox[] {
  const n = config.numDigits
  const boxH = region.height * 0.8
  const boxW = Math.min(boxH, region.width / (n + 0.5))
  const totalW = boxW * n
  const startX = region.x + (region.width - totalW) / 2
  const startY = region.y + (region.height - boxH) / 2

  return Array.from({ length: n }, (_, i) => ({
    normalizedX: startX + boxW * i,
    normalizedY: startY,
    normalizedW: boxW,
    normalizedH: boxH,
    digitIndex: i,
  }))
}
