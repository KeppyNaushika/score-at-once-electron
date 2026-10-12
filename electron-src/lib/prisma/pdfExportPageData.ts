import * as fsPromises from "fs/promises"
import * as path from "path"

import { calculateActualScore } from "@/lib/shared/actualScore"
import {
  isStatusCompatibleWithScoringMethod,
  toScoringMethod,
} from "@/types/rubric.types"

import type { EffectiveScore } from "../shared/calculations/scoreResolution"
import { calculateSubtotalScoreForStudent } from "../shared/calculations/subtotalCalculator"
import type { getCropRegionsByExamId } from "./cropRegion"
import { getDrawingAnnotationsByQuestionScore } from "./drawingAnnotation"
import type { PdfExportPageData } from "./pdfExport"

// ============================================================
// PDF出力の1ページ分（受験者×答案画像）のデータを組み立てる部品
// ============================================================

type ExamCropRegion = Awaited<ReturnType<typeof getCropRegionsByExamId>>[number]

/** このページの採点領域と、そこに解決済みの有効スコアの組 */
interface ScoredRegion {
  region: ExamCropRegion
  examPage: NonNullable<ExamCropRegion["examPage"]>
  effectiveScore: EffectiveScore
}

/**
 * このページの採点領域と、そこに解決済みの有効スコアがあるものだけを組にする。
 * 有効スコアが1件も無い領域はこの受験者について描くものが何も無い
 */
export function buildScoredRegions(
  pageRegions: ExamCropRegion[],
  allScores: EffectiveScore[],
  examStudentId: string
): ScoredRegion[] {
  return pageRegions.flatMap((region) => {
    // examPageは必ず存在する（getCropRegionsByExamIdでincludeしている）
    const { examPage } = region
    if (!examPage) {
      console.warn(`CropRegion ${region.id} has no examPage, skipping`)
      return []
    }
    const effectiveScore = allScores.find(
      (resolvedScore) =>
        resolvedScore.cropRegionId === region.id &&
        resolvedScore.examStudentId === examStudentId
    )
    if (!effectiveScore) return []
    return [{ region, examPage, effectiveScore }]
  })
}

/** 採点データを構築（提案行が無くても確定で採点済みのセルはマークを描画する） */
export function buildScoringData(
  scoredRegions: ScoredRegion[]
): PdfExportPageData["scoringData"] {
  return scoredRegions.map(({ region, examPage, effectiveScore }) => {
    const scoringMethod = toScoringMethod(region.scoringMethod)
    const isPrintableScaleLevel =
      effectiveScore.status === "evaluated" &&
      isStatusCompatibleWithScoringMethod(scoringMethod, effectiveScore.status)
    return {
      status: effectiveScore.status,
      partialScore: effectiveScore.partialScore,
      scaleLevel:
        isPrintableScaleLevel && effectiveScore.scaleLevel
          ? {
              label: effectiveScore.scaleLevel.label,
              score: effectiveScore.scaleLevel.score,
            }
          : null,
      cropRegion: {
        id: region.id,
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        label: region.label,
        maxScore: region.points !== null ? Number(region.points) : null,
        pageNumber: examPage.pageNumber,
        scoringMethod,
      },
    }
  })
}

/**
 * アノテーションを取得（行をそのまま持つ）。どの採点行の注釈を印刷するかは
 * リゾルバが決める（確定したセルはそのセルの全行 = 当面すべて表示する）
 */
export async function collectAnnotations(
  scoredRegions: ScoredRegion[]
): Promise<PdfExportPageData["annotations"]> {
  const annotations: PdfExportPageData["annotations"] = []
  for (const { effectiveScore } of scoredRegions) {
    for (const questionScoreId of effectiveScore.annotationQuestionScoreIds) {
      annotations.push(
        ...(await getDrawingAnnotationsByQuestionScore(questionScoreId))
      )
    }
  }
  return annotations
}

/**
 * 画像をbase64データURLに変換（Canvasのtainted問題を回避）。
 * 読めなければ null を返す（呼び出し側はこの画像をスキップする）
 */
export async function readImageAsDataUrl(
  imagePath: string
): Promise<string | null> {
  try {
    const imageBuffer = await fsPromises.readFile(imagePath)
    const ext = path.extname(imagePath).toLowerCase()
    const mimeType =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : "image/png"
    return `data:${mimeType};base64,${imageBuffer.toString("base64")}`
  } catch (imgError) {
    console.error(`Failed to read image: ${imagePath}`, imgError)
    return null
  }
}

/** このページのSUBTOTAL_SCORE領域ごとに小計点を計算する */
export async function buildSubtotalData(options: {
  examId: string
  examStudentId: string
  pageRegions: ExamCropRegion[]
  allScores: EffectiveScore[]
  cropRegions: ExamCropRegion[]
}): Promise<PdfExportPageData["subtotalData"]> {
  const { examId, examStudentId, pageRegions, allScores, cropRegions } = options

  // 小計点領域を取得（このページのSUBTOTAL_SCORE領域）
  const subtotalRegions = pageRegions.filter(
    (cropRegion) => cropRegion.type === "SUBTOTAL_SCORE"
  )

  const subtotalData: PdfExportPageData["subtotalData"] = []
  for (const subtotalRegion of subtotalRegions) {
    if (!subtotalRegion.examPage) continue

    // 小計点を計算
    const subtotalResult = await calculateSubtotalScoreForStudent(
      examStudentId,
      examId,
      subtotalRegion.id,
      allScores,
      cropRegions
    )

    subtotalData.push({
      regionId: subtotalRegion.id,
      label: subtotalRegion.label,
      score: subtotalResult.score,
      x: subtotalRegion.x,
      y: subtotalRegion.y,
      width: subtotalRegion.width,
      height: subtotalRegion.height,
      pageNumber: subtotalRegion.examPage.pageNumber,
    })
  }
  return subtotalData
}

/**
 * 合計点を計算（全設問の合計）。採点済みの設問が1つも無ければ totalScore は null
 */
export function calculateTotalScore(
  cropRegions: ExamCropRegion[],
  allScores: EffectiveScore[],
  examStudentId: string
): { totalScore: number | null; totalMaxScore: number } {
  const questionRegions = cropRegions.filter(
    (cropRegion) => cropRegion.type === "QUESTION_ANSWER"
  )
  let totalScore = 0
  let totalMaxScore = 0
  let hasScoredQuestion = false
  for (const region of questionRegions) {
    const score = allScores.find(
      (resolvedScore) =>
        resolvedScore.cropRegionId === region.id &&
        resolvedScore.examStudentId === examStudentId
    )
    if (score) {
      totalMaxScore += region.points ?? 0
      const actualScore = calculateActualScore(score, region)
      if (actualScore !== null) {
        hasScoredQuestion = true
        totalScore += actualScore
      }
    }
  }
  return { totalScore: hasScoredQuestion ? totalScore : null, totalMaxScore }
}

/** このページのTOTAL_SCORE領域ごとに合計点領域データを構築する */
export function buildTotalScoreData(
  pageRegions: ExamCropRegion[],
  totalScore: number | null,
  totalMaxScore: number
): PdfExportPageData["totalScoreData"] {
  // 合計点領域を取得（このページのTOTAL_SCORE領域）
  const totalScoreRegions = pageRegions.filter(
    (cropRegion) => cropRegion.type === "TOTAL_SCORE"
  )

  const totalScoreData: PdfExportPageData["totalScoreData"] = []
  for (const totalRegion of totalScoreRegions) {
    if (!totalRegion.examPage) continue

    totalScoreData.push({
      regionId: totalRegion.id,
      score: totalScore,
      maxScore: totalMaxScore,
      x: totalRegion.x,
      y: totalRegion.y,
      width: totalRegion.width,
      height: totalRegion.height,
      pageNumber: totalRegion.examPage.pageNumber,
    })
  }
  return totalScoreData
}
