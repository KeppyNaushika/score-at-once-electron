"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"

import type { CropRegionWithSubtotals } from "@/electron-src/lib/prisma/cropRegion"
import { cropRegionsQuery } from "@/queries/cropRegion"
import { studentAnswerImagesQuery } from "@/queries/exam"
import {
  batchRecognizeOmr,
  detectMasterMarkers,
  omrConfigsQuery,
  subscribeOmrBatchProgress,
} from "@/queries/omr"
import { batchUpdateQuestionScoresMutation } from "@/queries/scoring"
import type { ComputedCell } from "@/types/answerSheetLayout.types"
import type {
  ComputedOMRBubble,
  CropRegionOmrConfigWithOptions,
  OMRBatchProgress,
  OMRCellConfig,
  OMRSheetResult,
} from "@/types/omr.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import {
  recommendAreaThreshold,
  recommendMinInkDarkness,
  type ReevaluatedScoreEntry,
  reevaluateWithThreshold,
  type ScoringResultSummary,
} from "../utils/reevaluateResults"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_OMR_CONFIGS: CropRegionOmrConfigWithOptions[] = []

/** 分布から算出できなかったときに使う塗りつぶし判定閾値 */
const DEFAULT_AREA_THRESHOLD = 0.4

/** 低信頼として保留に落とす閾値 */
const DEFAULT_CONFIDENCE_THRESHOLD = 0.7

interface OmrAutoScoringState {
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
  scoreEntries: Map<string, ReevaluatedScoreEntry[]>
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
  /** 分布から算出した推奨areaThreshold（算出不能なら null） */
  recommendedAreaThreshold: number | null
  /** 分布から算出したマークと見なす濃さの下限（消し跡が無ければ null） */
  minInkDarkness: number | null
}

/**
 * OMR自動採点のパイプラインを管理するフック
 */
export function useOmrAutoScoring(examId: string) {
  const queryClient = useQueryClient()
  const { mutateAsync: batchUpdateQuestionScores } = useMutation(
    batchUpdateQuestionScoresMutation(examId)
  )

  // OMR設定はキャッシュが持つ。認識の途中でも同じキーから引く
  const { data: omrConfigs = EMPTY_OMR_CONFIGS } = useQuery(
    omrConfigsQuery(examId)
  )

  const [state, setState] = useState<OmrAutoScoringState>({
    isRecognizing: false,
    isApplying: false,
    progress: null,
    sheetResults: [],
    originalSheetResults: [],
    scoreEntries: new Map(),
    summary: null,
    error: null,
    areaThreshold: DEFAULT_AREA_THRESHOLD,
    confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
    pointsMap: {},
    recommendedAreaThreshold: null,
    minInkDarkness: null,
  })

  /** バッチ進捗リスナー */
  useEffect(() => {
    const unsubscribe = subscribeOmrBatchProgress((progress) => {
      setState((prev) => ({ ...prev, progress }))
    })
    return unsubscribe
  }, [])

  /**
   * OMR認識実行
   * CropRegionOmrConfigからOMRCellConfigへの変換→バッチ認識→自動採点
   */
  const runRecognition = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isRecognizing: true,
      sheetResults: [],
      scoreEntries: new Map(),
      summary: null,
      error: null,
      progress: null,
    }))

    try {
      // 1. OMR設定を取得（キャッシュ経由。表示と同じ行を使う）
      const configs = await queryClient.fetchQuery(omrConfigsQuery(examId))
      if (configs.length === 0) {
        setState((prev) => ({
          ...prev,
          isRecognizing: false,
          error: "OMR設定がありません",
        }))
        return
      }

      // 2. マスターマーカー検出
      const markerResult = await detectMasterMarkers(examId)
      // 4マーカー揃ったページが1枚も無ければ認識できない
      if (markerResult.pages.every((page) => !page.result.success)) {
        setState((prev) => ({
          ...prev,
          isRecognizing: false,
          error: "マーカーを検出できませんでした",
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
        }
      }
      // null は「自動算出」。ユーザーが明示した上書き値だけをそのまま渡す
      const recognitionParams = {
        colorThreshold: configs[0].colorThreshold,
        areaThreshold: configs[0].areaThreshold ?? DEFAULT_AREA_THRESHOLD,
        confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
      }

      // 4. 答案画像を取得（全生徒分）
      // ページ1のみ対応（OMR設定はページ1前提）
      const page1 = markerResult.pages.find((page) => page.pageNumber === 1)
      if (!page1 || !page1.result.success) {
        setState((prev) => ({
          ...prev,
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
      const cropRegions = await queryClient.fetchQuery(cropRegionsQuery(examId))
      const page1Regions = cropRegions.filter(
        (cropRegion) => cropRegion.examPage?.pageNumber === 1
      )
      if (page1Regions.length === 0) {
        setState((prev) => ({
          ...prev,
          isRecognizing: false,
          error: "ページ1の領域が見つかりません",
        }))
        return
      }

      // 答案画像パス取得（全生徒、ページ1のみフィルタ）
      const allAnswerImages = await queryClient.fetchQuery(
        studentAnswerImagesQuery(examId)
      )

      const page1ExamPageId = page1Regions[0]?.examPage?.id
      const answerImages = allAnswerImages.filter(
        (answerImage) => answerImage.examPageId === page1ExamPageId
      )

      if (answerImages.length === 0) {
        setState((prev) => ({
          ...prev,
          isRecognizing: false,
          error: "答案画像が見つかりません",
        }))
        return
      }

      // 画像パス（DB相対パス）を収集 — メインプロセス側で絶対パスに解決
      const imagePaths = answerImages.map((answerImage) => ({
        path: answerImage.imagePath,
        examStudentId: answerImage.examStudentId,
        studentName: `${answerImage.examStudent.student.lastName} ${answerImage.examStudent.student.firstName}`,
      }))

      // 6. バッチ認識実行
      // CropRegion座標 + OMR設定からComputedCellを構築
      const cells = buildCellsFromRegions(page1Regions, configs, cellConfigs)

      const results = await batchRecognizeOmr({
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
            examStudentId: sheet.examStudentId,
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

      // 塗りつぶし閾値を分布から算出。ユーザーが明示した上書き値があればそれを優先し、
      // 算出できなければ既定値のままにする
      const recommended = recommendAreaThreshold(results)
      const initialAreaThreshold =
        configs[0].areaThreshold ?? recommended ?? DEFAULT_AREA_THRESHOLD
      const initialConfidenceThreshold =
        recognitionParams.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD

      // 消し跡の棄却基準も答案群の濃さ分布から決める
      const minInkDarkness = recommendMinInkDarkness(
        results,
        initialAreaThreshold
      )

      const { updatedSheetResults, scoreEntries, summary } =
        reevaluateWithThreshold({
          sheetResults: results,
          omrConfigs: configs,
          pointsMap,
          areaThreshold: initialAreaThreshold,
          confidenceThreshold: initialConfidenceThreshold,
          minInkDarkness,
        })

      setState((prev) => ({
        ...prev,
        isRecognizing: false,
        sheetResults: updatedSheetResults,
        originalSheetResults: results,
        scoreEntries,
        summary,
        pointsMap,
        areaThreshold: initialAreaThreshold,
        confidenceThreshold: initialConfidenceThreshold,
        recommendedAreaThreshold: recommended,
        minInkDarkness,
      }))
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isRecognizing: false,
        error: error instanceof Error ? error.message : "OMR認識に失敗しました",
      }))
    }
  }, [examId, queryClient])

  /**
   * 採点結果をQuestionScoreに反映
   */
  const applyScores = useCallback(
    async (userId: string) => {
      setState((prev) => ({ ...prev, isApplying: true, error: null }))
      try {
        const entries: Array<{
          examStudentId: string
          cropRegionId: string
          status: ScoringStatus
          partialScore: number | null
          userId: string
        }> = []

        for (const [examStudentId, scoreEntries] of state.scoreEntries) {
          for (const entry of scoreEntries) {
            entries.push({
              examStudentId,
              cropRegionId: entry.cropRegionId!,
              status: entry.status,
              partialScore: entry.status === "partial" ? entry.score : null,
              userId,
            })
          }
        }

        if (entries.length === 0) {
          setState((prev) => ({
            ...prev,
            isApplying: false,
            error: "反映する採点データがありません",
          }))
          return false
        }

        await batchUpdateQuestionScores(entries)
        setState((prev) => ({ ...prev, isApplying: false }))
        return true
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isApplying: false,
          error:
            error instanceof Error ? error.message : "採点反映に失敗しました",
        }))
        return false
      }
    },
    [batchUpdateQuestionScores, state.scoreEntries]
  )

  /** areaThresholdを変更し、キャッシュ済みfillRatiosから即座に再判定 */
  const updateAreaThreshold = useCallback(
    (newThreshold: number) => {
      if (state.originalSheetResults.length === 0) return
      // 塗りつぶし閾値が変われば濃さ判定の母集団も変わるので引き直す
      const minInkDarkness = recommendMinInkDarkness(
        state.originalSheetResults,
        newThreshold
      )
      const { updatedSheetResults, scoreEntries, summary } =
        reevaluateWithThreshold({
          sheetResults: state.originalSheetResults,
          omrConfigs,
          pointsMap: state.pointsMap,
          areaThreshold: newThreshold,
          confidenceThreshold: state.confidenceThreshold,
          minInkDarkness,
        })
      setState((prev) => ({
        ...prev,
        areaThreshold: newThreshold,
        sheetResults: updatedSheetResults,
        scoreEntries,
        summary,
        minInkDarkness,
      }))
    },
    [
      omrConfigs,
      state.originalSheetResults,
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
          omrConfigs,
          pointsMap: state.pointsMap,
          areaThreshold: state.areaThreshold,
          confidenceThreshold: newThreshold,
          minInkDarkness: state.minInkDarkness,
        })
      setState((prev) => ({
        ...prev,
        confidenceThreshold: newThreshold,
        sheetResults: updatedSheetResults,
        scoreEntries,
        summary,
      }))
    },
    [
      omrConfigs,
      state.originalSheetResults,
      state.pointsMap,
      state.areaThreshold,
      state.minInkDarkness,
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
    omrConfigs,
    hasOmrConfigs: omrConfigs.length > 0,
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
  regions: CropRegionWithSubtotals[],
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
    }

    cells.push(cell)
  }

  return cells
}

/** CropRegionの正規化座標内にバブル位置を等間隔配置 */
function computeBubblesFromRegion(
  region: CropRegionWithSubtotals,
  config: OMRCellConfig & { type: "choice" }
): ComputedOMRBubble[] {
  const numChoices = config.numChoices
  const bubbles: ComputedOMRBubble[] = []

  // バブルサイズ: 間隔の60%幅、高さは領域高さの70%（実際の印刷バブルに近似）
  const spacing =
    config.layout === "horizontal"
      ? region.width / (numChoices + 1)
      : region.height / (numChoices + 1)
  const bubbleW = spacing * 0.6
  const bubbleH = Math.min(bubbleW * 1.6, region.height * 0.7)

  if (config.layout === "horizontal") {
    const spacing = region.width / (numChoices + 1)
    const cy = region.y + region.height / 2
    for (let i = 0; i < numChoices; i++) {
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
    const spacing = region.height / (numChoices + 1)
    const cx = region.x + region.width / 2
    for (let i = 0; i < numChoices; i++) {
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
