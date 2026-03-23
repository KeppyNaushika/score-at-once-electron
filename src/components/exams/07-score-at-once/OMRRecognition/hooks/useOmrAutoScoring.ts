"use client"

import { useCallback, useEffect, useState } from "react"

import type { ComputedCell } from "@/types/answerSheetLayout.types"
import type {
  ComputedOMRBubble,
  ComputedOMRDigitBox,
  CropRegionOmrConfigWithOptions,
  OMRBatchProgress,
  OMRCellConfig,
  OMRCellResult,
  OMRSheetResult,
} from "@/types/omr.types"
import type { CropRegionWithDetails } from "@/types/prismaExtensions"

/** 自動採点エントリ（rendererプロセス用） */
interface AutoScoreEntry {
  label: string
  cropRegionId?: string
  questionPath: number[]
  status:
    | "correct"
    | "incorrect"
    | "partial"
    | "no_answer"
    | "ambiguous"
    | "pending"
  score: number
  maxPoints: number
  recognizedValues: string[]
}

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
  /** 自動採点エントリ（全生徒分） */
  scoreEntries: Map<string, AutoScoreEntry[]>
  /** 結果サマリー */
  summary: {
    correct: number
    incorrect: number
    noAnswer: number
    ambiguous: number
    partial: number
    pending: number
    total: number
  } | null
  /** エラー */
  error: string | null
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
    scoreEntries: new Map(),
    summary: null,
    error: null,
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
      for (const cfg of configs) {
        if (cfg.type === "choice") {
          const labels = cfg.choiceOptions.map((opt) => opt.label)
          const correctAnswers = cfg.choiceOptions
            .filter((opt) => opt.isCorrect)
            .map((opt) => opt.choiceIndex)
          cellConfigs[cfg.cropRegionId] = {
            type: "choice",
            numChoices: cfg.numChoices ?? labels.length,
            labels,
            correctAnswers,
            layout:
              (cfg.choiceLayout as "horizontal" | "vertical") ?? "horizontal",
          }
        } else if (cfg.type === "handwritten-digit") {
          cellConfigs[cfg.cropRegionId] = {
            type: "handwritten-digit",
            numDigits: cfg.numDigits ?? 1,
            correctAnswer: cfg.correctAnswer ?? undefined,
          }
        }
      }
      const recognitionParams = {
        colorThreshold: configs[0].colorThreshold ?? 25,
        areaThreshold: configs[0].areaThreshold ?? 0.4,
        confidenceThreshold: 0.7,
      }

      // 4. 答案画像を取得（全生徒分）
      // ページ1のみ対応（OMR設定はページ1前提）
      const page1 = markerResult.pages.find((p) => p.pageNumber === 1)
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
        .sort((a, b) => {
          const cornerOrder = { TL: 0, TR: 1, BL: 2, BR: 3 }
          return (
            cornerOrder[a.corner as keyof typeof cornerOrder] -
            cornerOrder[b.corner as keyof typeof cornerOrder]
          )
        })
        .map((m) => ({
          x: m.centerX / page1.result.imageWidth,
          y: m.centerY / page1.result.imageHeight,
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
        (r) => r.examPage?.pageNumber === 1
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
        (img) => img.examPageId === page1ExamPageId
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
      const imagePaths = answerImages.map((img) => ({
        path: img.imagePath,
        studentId: img.studentId,
        studentName: img.student
          ? `${img.student.lastName} ${img.student.firstName}`
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

      // 7. 自動採点エントリの構築
      const allEntries = new Map<string, AutoScoreEntry[]>()
      let correct = 0,
        incorrect = 0,
        noAnswer = 0,
        ambiguous = 0,
        partial = 0,
        pending = 0

      // CropRegionの配点マップ
      const pointsMap: Record<string, number> = {}
      for (const r of page1Regions) {
        if (r.points != null) {
          pointsMap[r.id] = r.points
        }
      }

      // マーカー検出失敗の診断
      const failedSheets = results.filter((r) => !r.success)
      if (failedSheets.length > 0) {
        console.warn(
          `OMR: ${failedSheets.length}/${results.length} 枚でマーカー検出失敗`,
          failedSheets.map((r) => ({
            studentId: r.studentId,
            error: r.error,
          }))
        )
      }
      const emptyResultSheets = results.filter(
        (r) => r.success && r.cellResults.length === 0
      )
      if (emptyResultSheets.length > 0) {
        console.warn(
          `OMR: ${emptyResultSheets.length}/${results.length} 枚でセル認識結果が空`,
          { cellCount: cells.length, configKeys: Object.keys(cellConfigs) }
        )
      }

      for (const sheetResult of results) {
        if (!sheetResult.success || !sheetResult.studentId) continue

        const entries: AutoScoreEntry[] = sheetResult.cellResults.map(
          (cellResult: OMRCellResult) => {
            const cropRegionId = cellResult.label
            const maxPoints = pointsMap[cropRegionId] ?? 0
            const cfg = configs.find((c) => c.cropRegionId === cropRegionId)

            let status: AutoScoreEntry["status"]
            let score: number

            switch (cellResult.autoScoreStatus) {
              case "correct":
                status = "correct"
                score = maxPoints
                correct++
                break
              case "incorrect":
                status = "incorrect"
                score = 0
                incorrect++
                break
              case "no_answer":
                status = "no_answer"
                score = 0
                noAnswer++
                break
              case "ambiguous":
                status = "ambiguous"
                score = 0
                ambiguous++
                break
              default:
                status = "no_answer"
                score = 0
                noAnswer++
            }

            // 部分点チェック
            if (
              cfg?.type === "choice" &&
              status === "incorrect" &&
              cellResult.recognizedValues.length > 0
            ) {
              const correctLabels = cfg.choiceOptions
                .filter((o) => o.isCorrect)
                .map((o) => o.label)
              if (correctLabels.length > 1) {
                const correctCount = cellResult.recognizedValues.filter((v) =>
                  correctLabels.includes(v)
                ).length
                if (correctCount > 0 && correctCount < correctLabels.length) {
                  status = "partial"
                  score = Math.floor(
                    (maxPoints * correctCount) / correctLabels.length
                  )
                  incorrect--
                  partial++
                }
              }
            }

            // 低信頼チェック: 閾値未満は保留にしてレビュー対象にする
            const confidenceThreshold =
              recognitionParams.confidenceThreshold ?? 0.7
            if (
              cellResult.confidence < confidenceThreshold &&
              status !== "no_answer" &&
              status !== "ambiguous"
            ) {
              // カウンターを元に戻してpendingに振り替え
              if (status === "correct") correct--
              else if (status === "incorrect") incorrect--
              else if (status === "partial") partial--
              status = "pending"
              score = 0
              pending++
            }

            return {
              label: cellResult.label,
              cropRegionId,
              questionPath: cellResult.questionPath,
              status,
              score,
              maxPoints,
              recognizedValues: cellResult.recognizedValues,
            }
          }
        )

        allEntries.set(sheetResult.studentId, entries)
      }

      setState((s) => ({
        ...s,
        isRecognizing: false,
        sheetResults: results,
        scoreEntries: allEntries,
        summary: {
          correct,
          incorrect,
          noAnswer,
          ambiguous,
          partial,
          pending,
          total: correct + incorrect + noAnswer + ambiguous + partial + pending,
        },
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
            if (entry.status === "ambiguous") continue // 曖昧な結果はスキップ
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

  return {
    ...state,
    hasOmrConfigs: state.omrConfigs.length > 0,
    runRecognition,
    applyScores,
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

  for (const cfg of configs) {
    const region = regions.find((r) => r.id === cfg.cropRegionId)
    if (!region) continue

    const config = cellConfigs[cfg.cropRegionId]
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
      label: cfg.cropRegionId,
      points: region.points ?? 0,
      cellType: "answer",
      pageIndex: 0,
      textElements: [],
    }

    if (config.type === "choice") {
      // DB保存済みバブル位置を優先、なければ推定計算にフォールバック
      const hasSavedPositions = cfg.choiceOptions.some(
        (opt) => opt.normalizedCx != null
      )
      if (hasSavedPositions) {
        cell.omrBubbles = cfg.choiceOptions
          .filter((opt) => opt.normalizedCx != null)
          .map((opt) => ({
            normalizedCx: opt.normalizedCx!,
            normalizedCy: opt.normalizedCy!,
            normalizedWidth: opt.normalizedWidth!,
            normalizedHeight: opt.normalizedHeight!,
            choiceIndex: opt.choiceIndex,
            label: opt.label,
          }))
      } else {
        cell.omrBubbles = computeBubblesFromRegion(region, config)
      }
    } else if (config.type === "handwritten-digit") {
      // DB保存済み数字欄位置を優先、なければ推定計算にフォールバック
      if (cfg.digitBoxes && cfg.digitBoxes.length > 0) {
        cell.omrDigitBoxes = cfg.digitBoxes.map((box) => ({
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
