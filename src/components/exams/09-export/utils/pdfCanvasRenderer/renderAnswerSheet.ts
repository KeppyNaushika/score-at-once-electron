/**
 * 答案シートのCanvas描画オーケストレーション
 *
 * 答案画像・採点マーク・点数テキスト・アノテーションを1枚のCanvasに合成する。
 */

import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"
import type { AnswerOverlaySettings } from "@/types/scoringOverlay.types"
import { toScoringStatus } from "@/types/scoringStatus.types"

import { drawElement } from "./annotationRenderer"
import {
  drawScoreText,
  drawScoringMark,
  drawSubtotalScoreText,
  drawTotalScoreText,
} from "./scoreDrawing"
import type {
  ScoringDataForPdf,
  SubtotalDataForPdf,
  TotalScoreDataForPdf,
} from "./types"

/**
 * 答案シート1枚分をCanvas上に描画
 *
 * @param canvas - 描画先のCanvas要素
 * @param image - 答案画像
 * @param scoringDataList - 採点データのリスト（設問ごと）
 * @param annotations - 全アノテーション
 * @param config - 採点マーク設定
 * @param scoringMarkImages - 採点マーク画像のMap
 * @param subtotalDataList - 小計点データのリスト
 * @param totalScoreDataList - 合計点データのリスト
 * @param pageNumber - ページ番号（1-indexed、複数ページ対応用）
 *                     UI側で複数ページが縦に結合されたキャンバス上で描画された場合、
 *                     アノテーションのy座標は1ページ目の高さで正規化されるため
 *                     2ページ目以降のアノテーションはy > 1.0になる。
 *                     このページ番号を使ってオフセットを計算し正しい座標に変換する。
 * @returns PNG Blob
 */
export async function renderAnswerSheetToCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  scoringDataList: ScoringDataForPdf[],
  annotations: DrawingAnnotation[],
  config: AnswerOverlaySettings,
  scoringMarkImages: Map<string, HTMLImageElement>,
  subtotalDataList: SubtotalDataForPdf[] = [],
  totalScoreDataList: TotalScoreDataForPdf[] = [],
  pageNumber: number = 1,
  pageSize: string = "A4"
): Promise<Blob> {
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("Canvas context not available")
  }

  const imageWidth = image.naturalWidth
  const imageHeight = image.naturalHeight

  // Canvasサイズを画像サイズに設定
  canvas.width = imageWidth
  canvas.height = imageHeight

  // Canvasをクリア
  ctx.clearRect(0, 0, imageWidth, imageHeight)

  // Canvas Context設定
  ctx.globalCompositeOperation = "source-over"
  ctx.globalAlpha = 1.0
  ctx.lineCap = "butt"
  ctx.lineJoin = "miter"
  ctx.miterLimit = 10
  ctx.setLineDash([])

  // 1. 答案画像を描画
  ctx.drawImage(image, 0, 0)

  // 2. 各設問に対して採点マークと部分点を描画
  for (const scoringData of scoringDataList) {
    // ステータスごとのマーク表示判定
    const shouldShowMark =
      config.visibility[toScoringStatus(scoringData.status)].showMark
    if (!shouldShowMark) {
      // マークは非表示でも点数テキストは別途判定するため、マーク描画だけスキップ
    } else {
      // 採点マーク画像の取得
      const markKey =
        scoringData.status === "no_answer" ||
        scoringData.status === "double_mark"
          ? "incorrect"
          : scoringData.status
      const markImage = scoringMarkImages.get(markKey)

      if (markImage) {
        drawScoringMark(
          ctx,
          markImage,
          scoringData.cropRegion,
          config,
          imageWidth,
          imageHeight
        )
      }
    }

    // 点数テキストの描画
    const shouldShowScore =
      config.visibility[toScoringStatus(scoringData.status)].showScore

    if (shouldShowScore) {
      // ステータスに応じた点数を決定
      let scoreToDisplay: number | null = null
      if (scoringData.status === "correct") {
        // 正解: 配点を表示
        scoreToDisplay = scoringData.cropRegion.maxScore ?? null
      } else if (scoringData.status === "partial") {
        // 部分点: 部分点を表示
        scoreToDisplay = scoringData.partialScore ?? null
      } else if (
        scoringData.status === "incorrect" ||
        scoringData.status === "no_answer" ||
        scoringData.status === "double_mark"
      ) {
        // 誤答/無答/Wマーク: 0点を表示
        scoreToDisplay = 0
      }

      if (scoreToDisplay !== null) {
        drawScoreText(
          ctx,
          scoreToDisplay,
          scoringData.cropRegion,
          config,
          imageWidth,
          imageHeight
        )
      }
    }
  }

  // 3. 小計点を描画（青色）
  for (const subtotalData of subtotalDataList) {
    drawSubtotalScoreText(ctx, subtotalData, config, imageWidth, imageHeight)
  }

  // 4. 合計点を描画（青色）
  for (const totalScoreData of totalScoreDataList) {
    drawTotalScoreText(ctx, totalScoreData, config, imageWidth, imageHeight)
  }

  // 5. 全アノテーションを描画
  // 座標系の互換性処理:
  // - 旧データ: y座標がキャンバス全体に対する相対座標（2ページ目以降はy > 1.0）
  // - 新データ: y座標がページ内の相対座標（常に0.0 - 1.0）
  // y >= 1.0の場合は旧データとみなし、pageOffsetを引いて変換する
  // y < 1.0の場合は新データとみなし、そのまま使用する
  const basePageOffset = pageNumber - 1
  for (const annotation of annotations) {
    // y座標が1.0以上の場合のみpageOffsetを適用（旧座標系の互換性対応）
    const needsPageOffset = annotation.y >= 1.0 || annotation.endY >= 1.0
    const pageOffset = needsPageOffset ? basePageOffset : 0
    await drawElement(
      ctx,
      annotation,
      imageWidth,
      imageHeight,
      0,
      0,
      pageOffset,
      pageSize
    )
  }

  // Canvas結果をBlobとして取得
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error("Failed to create blob from canvas"))
        }
      },
      "image/png",
      1.0
    )
  })
}

/**
 * 採点マーク画像をプリロード
 *
 * fetchしてBlobからObjectURLを作成することで、Canvasのtainted問題を回避
 */
export async function preloadScoringMarkImages(): Promise<
  Map<string, HTMLImageElement>
> {
  const markTypes = ["correct", "partial", "pending", "incorrect"]
  const images = new Map<string, HTMLImageElement>()

  await Promise.all(
    markTypes.map(async (type) => {
      try {
        // fetchしてBlobとして取得
        const response = await fetch(`/score-assets/${type}.png`)
        const blob = await response.blob()
        const objectUrl = URL.createObjectURL(blob)

        const img = new Image()
        img.src = objectUrl
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            // ObjectURLを解放（画像は既にメモリにロード済み）
            URL.revokeObjectURL(objectUrl)
            resolve()
          }
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl)
            reject(new Error(`Failed to load ${type} mark image`))
          }
        })
        images.set(type, img)
      } catch (error) {
        console.error(`Failed to fetch ${type} mark image:`, error)
        // フォールバック: 直接読み込み
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.src = `/score-assets/${type}.png`
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () =>
            reject(new Error(`Failed to load ${type} mark image`))
        })
        images.set(type, img)
      }
    })
  )

  return images
}
